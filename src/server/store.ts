/**
 * Typed store over the loops database. The only code that touches SQL.
 *
 * Conventions:
 * - Loops are validated on write through the model package's zod schema
 *   (parseLoopConfig) — the DB never holds a config the editor couldn't
 *   have produced.
 * - Runs/turns rows mirror the runtime's records (src/runtime/types.ts);
 *   `upsertRun`/`upsertTurn` are called by the persistence bridge
 *   (persistence.ts) off Runner events.
 * - audit_events is append-only by construction: no update/delete methods
 *   exist (SPECS/target-architecture.md §safety-rails).
 * - `claimRunKey` implements the idempotency rail: run key =
 *   hash(loopId, triggerEventId); duplicate events never double-run.
 *
 * Original code.
 */

import { parseLoopConfig } from "../model/loop-config.ts";
import type { ISODateTime } from "../model/loop.ts";
import type { Run, Turn } from "../runtime/types.ts";
import type { Database } from "./db.ts";

export interface LoopRow {
  id: string;
  name: string;
  enabled: boolean;
  version: number;
  configJson: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type AuditKind =
  | "loop.created"
  | "loop.updated"
  | "loop.enabled"
  | "loop.disabled"
  | "run.created"
  | "run.status"
  | "run.usage"
  | "linear.write"
  | "linear.session"
  | "linear.activity";

export class Store {
  readonly db: Database;
  readonly now: () => Date;

  constructor(db: Database, now: () => Date = () => new Date()) {
    this.db = db;
    this.now = now;
  }

  // ---- loops -----------------------------------------------------------

  /** Create or replace a loop's config. Zod-validated; bumps version. */
  saveLoop(id: string, configInput: unknown): LoopRow {
    const parsed = parseLoopConfig(configInput);
    if (!parsed.ok) {
      throw new StoreValidationError(
        `invalid loop config: ${parsed.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`,
      );
    }
    const config = parsed.config;
    const at = this.#iso();
    const existing = this.getLoop(id);
    if (existing === null) {
      this.db
        .prepare(
          "INSERT INTO loops (id, name, enabled, version, config_json, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)",
        )
        .run(id, config.name, 1, JSON.stringify(config), at, at);
      this.appendAudit("loop.created", { loopId: id, detail: { name: config.name } });
    } else {
      this.db
        .prepare("UPDATE loops SET name = ?, config_json = ?, version = version + 1, updated_at = ? WHERE id = ?")
        .run(config.name, JSON.stringify(config), at, id);
      this.appendAudit("loop.updated", { loopId: id, detail: { name: config.name } });
    }
    return this.getLoop(id)!;
  }

  getLoop(id: string): LoopRow | null {
    const row = this.db.prepare("SELECT * FROM loops WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row === undefined ? null : loopRow(row);
  }

  listLoops(): LoopRow[] {
    const rows = this.db.prepare("SELECT * FROM loops ORDER BY created_at ASC").all() as Record<string, unknown>[];
    return rows.map(loopRow);
  }

  setLoopEnabled(id: string, enabled: boolean): void {
    this.db.prepare("UPDATE loops SET enabled = ?, updated_at = ? WHERE id = ?").run(enabled ? 1 : 0, this.#iso(), id);
    this.appendAudit(enabled ? "loop.enabled" : "loop.disabled", { loopId: id });
  }

  // ---- runs / turns ------------------------------------------------------

  /** Insert the run row (once, at creation). Idempotency key optional. */
  insertRun(run: Run): void {
    this.db
      .prepare(
        `INSERT INTO runs (id, loop_id, status, iteration, target_json, created_at, started_at, ended_at, summary, error, usage_json, conversation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.id,
        run.loopId,
        run.status,
        run.iteration,
        run.target === undefined ? null : JSON.stringify(run.target),
        run.createdAt,
        run.startedAt ?? null,
        run.endedAt ?? null,
        run.summary ?? null,
        run.error ?? null,
        JSON.stringify(run.usage),
        run.conversationId ?? null,
      );
  }

  /** Mirror the run's mutable fields (status/timestamps/summary/error/usage). */
  updateRun(run: Run): void {
    this.db
      .prepare(
        `UPDATE runs SET status = ?, started_at = ?, ended_at = ?, summary = ?, error = ?, usage_json = ?, conversation_id = ? WHERE id = ?`,
      )
      .run(
        run.status,
        run.startedAt ?? null,
        run.endedAt ?? null,
        run.summary ?? null,
        run.error ?? null,
        JSON.stringify(run.usage),
        run.conversationId ?? null,
        run.id,
      );
  }

  upsertTurn(turn: Turn): void {
    this.db
      .prepare(
        `INSERT INTO turns (id, run_id, position, role, status, parts_json, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, parts_json = excluded.parts_json, ended_at = excluded.ended_at`,
      )
      .run(
        turn.id,
        turn.runId,
        turn.position,
        turn.role,
        turn.status,
        JSON.stringify(turn.parts),
        turn.startedAt,
        turn.endedAt ?? null,
      );
  }

  // ---- snapshots ---------------------------------------------------------

  saveSnapshot(runId: string, savedAt: ISODateTime, json: string): void {
    this.db
      .prepare(
        `INSERT INTO snapshots (run_id, saved_at, json) VALUES (?, ?, ?)
         ON CONFLICT(run_id) DO UPDATE SET saved_at = excluded.saved_at, json = excluded.json`,
      )
      .run(runId, savedAt, json);
  }

  /** All stored snapshots (boot restore), oldest first. */
  listSnapshots(): { runId: string; savedAt: ISODateTime; json: string }[] {
    const rows = this.db.prepare("SELECT run_id, saved_at, json FROM snapshots ORDER BY saved_at ASC").all() as Record<string, unknown>[];
    return rows.map((r) => ({ runId: String(r["run_id"]), savedAt: String(r["saved_at"]), json: String(r["json"]) }));
  }

  // ---- settings (non-secret ONLY) ----------------------------------------

  /**
   * Non-secret settings. REFUSES keys that look like credentials — secret
   * material belongs to src/inference's write-only SecretStore, referenced
   * here by ref string at most.
   */
  setSetting(key: string, value: unknown): void {
    if (/(api[-_]?key|secret|token|password)/i.test(key)) {
      throw new StoreValidationError(
        `setting key "${key}" looks like a credential; secrets live in src/inference's write-only store`,
      );
    }
    this.db
      .prepare(
        `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value), this.#iso());
  }

  getSetting<T>(key: string): T | null {
    const row = this.db.prepare("SELECT value_json FROM settings WHERE key = ?").get(key) as Record<string, unknown> | undefined;
    return row === undefined ? null : (JSON.parse(String(row["value_json"])) as T);
  }

  // ---- idempotency --------------------------------------------------------

  /**
   * Claim an idempotency key for a new run. Returns true if the key was
   * free (run may proceed), false if this exact trigger event already
   * produced a run (the duplicate is dropped).
   */
  claimRunKey(key: string, runId: string): boolean {
    const result = this.db
      .prepare("INSERT OR IGNORE INTO idempotency_keys (key, run_id, created_at) VALUES (?, ?, ?)")
      .run(key, runId, this.#iso());
    return result.changes > 0;
  }

  // ---- audit ---------------------------------------------------------------

  appendAudit(kind: AuditKind, refs?: { loopId?: string | undefined; runId?: string | undefined; detail?: unknown }): void {
    this.db
      .prepare("INSERT INTO audit_events (at, kind, loop_id, run_id, detail_json) VALUES (?, ?, ?, ?, ?)")
      .run(
        this.#iso(),
        kind,
        refs?.loopId ?? null,
        refs?.runId ?? null,
        refs?.detail === undefined ? null : JSON.stringify(refs.detail),
      );
  }

  /** Audit reads are allowed; writes are append-only (no update/delete). */
  listAudit(filter?: { loopId?: string; runId?: string }): Record<string, unknown>[] {
    if (filter?.runId !== undefined) {
      return this.db.prepare("SELECT * FROM audit_events WHERE run_id = ? ORDER BY id ASC").all(filter.runId) as Record<string, unknown>[];
    }
    if (filter?.loopId !== undefined) {
      return this.db.prepare("SELECT * FROM audit_events WHERE loop_id = ? ORDER BY id ASC").all(filter.loopId) as Record<string, unknown>[];
    }
    return this.db.prepare("SELECT * FROM audit_events ORDER BY id ASC").all() as Record<string, unknown>[];
  }

  #iso(): ISODateTime {
    return this.now().toISOString();
  }
}

export class StoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreValidationError";
  }
}

function loopRow(row: Record<string, unknown>): LoopRow {
  return {
    id: String(row["id"]),
    name: String(row["name"]),
    enabled: row["enabled"] === 1,
    version: Number(row["version"]),
    configJson: String(row["config_json"]),
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  };
}
