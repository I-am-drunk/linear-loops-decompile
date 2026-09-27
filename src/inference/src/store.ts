/**
 * Harness settings store — CRUD for named inference harnesses over
 * node:sqlite, with the secret store holding all key material.
 *
 * Guarantees:
 * - Writes are validated with the zod schemas in settings.ts.
 * - Reads return PublicHarness DTOs only: no plaintext keys, no key refs.
 * - Key rotation replaces the secret and destroys the old one; deleting a
 *   harness destroys its secret too (no orphan credentials).
 * - At most one harness carries isDefault; the first harness created becomes
 *   the default automatically so a fresh install always has one.
 */

import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  HarnessNotFoundError,
  SettingsValidationError,
} from "./errors.ts";
import {
  DEFAULT_BASE_URLS,
  CreateHarnessInputSchema,
  HarnessSettingsSchema,
  UpdateHarnessInputSchema,
  formatZodIssues,
  type CreateHarnessInput,
  type Effort,
  type HarnessSettings,
  type InferenceProvider,
  type PublicHarness,
  type UpdateHarnessInput,
} from "./settings.ts";
import type { SecretStore } from "./secrets.ts";

/** Raw row shape in `harness_settings` (snake_case columns). */
interface HarnessRow {
  id: string;
  name: string;
  provider: string;
  base_url: string;
  api_key_ref: string | null;
  model: string;
  effort: string;
  extra_headers: string;
  allow_insecure_http: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function rowToSettings(row: HarnessRow): HarnessSettings {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as InferenceProvider,
    baseUrl: row.base_url,
    apiKeyRef: row.api_key_ref,
    model: row.model,
    effort: row.effort as Effort,
    extraHeaders: JSON.parse(row.extra_headers) as Record<string, string>,
    allowInsecureHttp: row.allow_insecure_http === 1,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublic(settings: HarnessSettings): PublicHarness {
  const { apiKeyRef, ...rest } = settings;
  return { ...rest, hasApiKey: apiKeyRef !== null };
}

export class HarnessSettingsStore {
  readonly #db: DatabaseSync;
  readonly #secrets: SecretStore;

  constructor(db: DatabaseSync, secrets: SecretStore) {
    this.#db = db;
    this.#secrets = secrets;
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS harness_settings (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
        provider      TEXT NOT NULL,
        base_url      TEXT NOT NULL,
        api_key_ref   TEXT,
        model         TEXT NOT NULL,
        effort        TEXT NOT NULL,
        extra_headers TEXT NOT NULL DEFAULT '{}',
        allow_insecure_http INTEGER NOT NULL DEFAULT 0,
        is_default    INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      )
    `);
    // Pre-T-603 databases lack the column; add it in place (no data change).
    const cols = this.#db.prepare("PRAGMA table_info(harness_settings)").all() as {
      name: string;
    }[];
    if (!cols.some((c) => c.name === "allow_insecure_http")) {
      this.#db.exec(
        "ALTER TABLE harness_settings ADD COLUMN allow_insecure_http INTEGER NOT NULL DEFAULT 0",
      );
    }
    this.sweepOrphanSecrets();
  }

  /**
   * Delete secrets no harness references (agent-09 review: rotation had a
   * crash window that could strand one). Runs on boot; returns the count.
   */
  sweepOrphanSecrets(): number {
    const referenced = new Set(
      (
        this.#db
          .prepare("SELECT api_key_ref FROM harness_settings WHERE api_key_ref IS NOT NULL")
          .all() as { api_key_ref: string }[]
      ).map((r) => r.api_key_ref),
    );
    let removed = 0;
    for (const ref of this.#secrets.listRefs()) {
      if (!referenced.has(ref) && this.#secrets.delete(ref)) removed += 1;
    }
    return removed;
  }

  /** Create a harness. Returns the public DTO (key material never returned). */
  create(input: CreateHarnessInput): PublicHarness {
    const parsed = CreateHarnessInputSchema.safeParse(input);
    if (!parsed.success) throw new SettingsValidationError(formatZodIssues(parsed.error));
    const data = parsed.data;

    const now = new Date().toISOString();
    const id = `har_${randomUUID()}`;
    const apiKeyRef = data.apiKey !== undefined ? this.#secrets.put(data.apiKey) : null;
    const baseUrl = data.baseUrl ?? DEFAULT_BASE_URLS[data.provider];
    if (baseUrl === null) {
      // Unreachable (superRefine guards it), but keep the invariant explicit.
      throw new SettingsValidationError([`baseUrl: required for provider "${data.provider}"`]);
    }

    const becomeDefault = data.makeDefault || this.getDefault() === null;
    this.#db.exec("BEGIN");
    try {
      if (becomeDefault) this.#db.exec("UPDATE harness_settings SET is_default = 0");
      this.#db
        .prepare(
          `INSERT INTO harness_settings
             (id, name, provider, base_url, api_key_ref, model, effort, extra_headers, allow_insecure_http, is_default, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          data.name,
          data.provider,
          baseUrl,
          apiKeyRef,
          data.model,
          data.effort,
          JSON.stringify(data.extraHeaders),
          data.allowInsecureHttp ? 1 : 0,
          becomeDefault ? 1 : 0,
          now,
          now,
        );
      this.#db.exec("COMMIT");
    } catch (err) {
      this.#db.exec("ROLLBACK");
      if (apiKeyRef !== null) this.#secrets.delete(apiKeyRef); // no orphan secret
      throw err;
    }
    const created = this.#getSettings(id);
    if (!created) throw new HarnessNotFoundError(id);
    return toPublic(created);
  }

  /** Patch a harness. Key rotation destroys the previous secret. */
  update(id: string, input: UpdateHarnessInput): PublicHarness {
    const existing = this.#getSettings(id);
    if (!existing) throw new HarnessNotFoundError(id);
    const parsed = UpdateHarnessInputSchema.safeParse(input);
    if (!parsed.success) throw new SettingsValidationError(formatZodIssues(parsed.error));
    const data = parsed.data;

    // Resolve key material changes first so a failed row update cannot strand secrets.
    let apiKeyRef = existing.apiKeyRef;
    if (data.clearApiKey) {
      apiKeyRef = null;
    } else if (data.apiKey !== undefined) {
      apiKeyRef = this.#secrets.put(data.apiKey);
    }

    const next: HarnessSettings = {
      ...existing,
      name: data.name ?? existing.name,
      provider: data.provider ?? existing.provider,
      baseUrl: data.baseUrl ?? existing.baseUrl,
      apiKeyRef,
      model: data.model ?? existing.model,
      effort: data.effort ?? existing.effort,
      extraHeaders: data.extraHeaders ?? existing.extraHeaders,
      allowInsecureHttp: data.allowInsecureHttp ?? existing.allowInsecureHttp,
      updatedAt: new Date().toISOString(),
    };
    // Validate the MERGED record: catches cross-field rules the patch schema
    // cannot see (e.g. relaxing baseUrl without the allowInsecureHttp flag).
    const merged = HarnessSettingsSchema.safeParse(next);
    if (!merged.success) throw new SettingsValidationError(formatZodIssues(merged.error));

    this.#db.exec("BEGIN");
    try {
      if (data.makeDefault) this.#db.exec("UPDATE harness_settings SET is_default = 0");
      this.#db
        .prepare(
          `UPDATE harness_settings
             SET name = ?, provider = ?, base_url = ?, api_key_ref = ?, model = ?,
                 effort = ?, extra_headers = ?, allow_insecure_http = ?, is_default = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          next.name,
          next.provider,
          next.baseUrl,
          next.apiKeyRef,
          next.model,
          next.effort,
          JSON.stringify(next.extraHeaders),
          next.allowInsecureHttp ? 1 : 0,
          data.makeDefault || existing.isDefault ? 1 : 0,
          next.updatedAt,
          id,
        );
      this.#db.exec("COMMIT");
    } catch (err) {
      this.#db.exec("ROLLBACK");
      throw err;
    }

    // Post-commit secret cleanup: old ref is gone from the row, safe to destroy.
    if (existing.apiKeyRef !== null && existing.apiKeyRef !== next.apiKeyRef) {
      this.#secrets.delete(existing.apiKeyRef);
    }
    const updated = this.#getSettings(id);
    if (!updated) throw new HarnessNotFoundError(id);
    return toPublic(updated);
  }

  /** Delete a harness and its stored key. */
  remove(id: string): boolean {
    const existing = this.#getSettings(id);
    if (!existing) return false;
    this.#db.prepare("DELETE FROM harness_settings WHERE id = ?").run(id);
    if (existing.apiKeyRef !== null) this.#secrets.delete(existing.apiKeyRef);
    return true;
  }

  get(id: string): PublicHarness | null {
    const s = this.#getSettings(id);
    return s ? toPublic(s) : null;
  }

  getByName(name: string): PublicHarness | null {
    const row = this.#db
      .prepare("SELECT * FROM harness_settings WHERE name = ? COLLATE NOCASE")
      .get(name) as HarnessRow | undefined;
    return row ? toPublic(rowToSettings(row)) : null;
  }

  list(): PublicHarness[] {
    const rows = this.#db
      .prepare("SELECT * FROM harness_settings ORDER BY created_at ASC")
      .all() as unknown as HarnessRow[];
    return rows.map((row) => toPublic(rowToSettings(row)));
  }

  getDefault(): PublicHarness | null {
    const row = this.#db
      .prepare("SELECT * FROM harness_settings WHERE is_default = 1")
      .get() as HarnessRow | undefined;
    return row ? toPublic(rowToSettings(row)) : null;
  }

  /** Mark an existing harness as the installation default. */
  setDefault(id: string): PublicHarness {
    if (!this.#getSettings(id)) throw new HarnessNotFoundError(id);
    this.#db.exec("BEGIN");
    try {
      this.#db.exec("UPDATE harness_settings SET is_default = 0");
      this.#db.prepare("UPDATE harness_settings SET is_default = 1 WHERE id = ?").run(id);
      this.#db.exec("COMMIT");
    } catch (err) {
      this.#db.exec("ROLLBACK");
      throw err;
    }
    const updated = this.#getSettings(id);
    if (!updated) throw new HarnessNotFoundError(id);
    return toPublic(updated);
  }

  /**
   * @internal Resolve full settings plus the decrypted API key. This is the
   * ONLY method adapters (T-602/T-603) may use to reach key material, and it
   * must never be wired into settings-read RPC paths.
   */
  resolveForAdapter(idOrName: string): { settings: HarnessSettings; apiKey: string | null } {
    const s = this.#getSettings(idOrName) ?? this.#getSettingsByName(idOrName);
    if (!s) throw new HarnessNotFoundError(idOrName);
    return {
      settings: s,
      apiKey: s.apiKeyRef !== null ? this.#secrets.get(s.apiKeyRef) : null,
    };
  }

  #getSettings(id: string): HarnessSettings | null {
    const row = this.#db
      .prepare("SELECT * FROM harness_settings WHERE id = ?")
      .get(id) as HarnessRow | undefined;
    return row ? rowToSettings(row) : null;
  }

  #getSettingsByName(name: string): HarnessSettings | null {
    const row = this.#db
      .prepare("SELECT * FROM harness_settings WHERE name = ? COLLATE NOCASE")
      .get(name) as HarnessRow | undefined;
    return row ? rowToSettings(row) : null;
  }
}

