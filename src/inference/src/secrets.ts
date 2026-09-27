/**
 * Secret store — write-only credential storage (house convention).
 *
 * Plaintext secrets go in via `put()` and can only come back out via `get()`,
 * which exists SOLELY for server-side adapter use (making the actual provider
 * call). There is deliberately no list/export path: settings reads return
 * only `hasApiKey` booleans, so a key can never be echoed back through the
 * settings UI or RPC surface.
 *
 * At rest, values are AES-256-GCM encrypted under an installation master key.
 * The key comes from the LOOPS_SECRET_KEY environment variable (64 hex chars)
 * or is generated once and kept in a 0600 file next to the database — the
 * standard pattern for a single-user self-hosted service. Each row also
 * carries a random nonce; GCM's auth tag makes tampering detectable.
 */

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  SecretNotFoundError,
  SecretUndecryptableError,
} from "./errors.ts";

/** Storage backend for secrets. `get` is @internal — adapters only. */
export interface SecretStore {
  /** Encrypt and store a plaintext secret; returns its opaque reference. */
  put(plaintext: string): string;
  /**
   * @internal Decrypt a secret for server-side use (adapters). Never call
   * this from settings-read or RPC code paths.
   */
  get(ref: string): string;
  /** True when a secret exists for the reference. */
  has(ref: string): boolean;
  /** Remove a secret. Returns false when the reference was unknown. */
  delete(ref: string): boolean;
  /** @internal All stored refs — for the store's orphan sweep only. */
  listRefs(): string[];
}

const NONCE_BYTES = 12; // AES-GCM standard nonce size
const MASTER_KEY_BYTES = 32; // AES-256

/**
 * Resolve the installation master key: LOOPS_SECRET_KEY (hex) wins, otherwise
 * a generated key persisted with owner-only permissions beside the database.
 */
export function loadMasterKey(dbPath: string): Buffer {
  const fromEnv = process.env.LOOPS_SECRET_KEY?.trim();
  if (fromEnv) {
    if (!/^[0-9a-fA-F]{64}$/.test(fromEnv)) {
      throw new Error(
        "LOOPS_SECRET_KEY must be 64 hex characters (32 bytes) — e.g. `openssl rand -hex 32`",
      );
    }
    return Buffer.from(fromEnv, "hex");
  }
  const keyPath = path.join(path.dirname(dbPath), ".master-key");
  if (existsSync(keyPath)) {
    const hex = readFileSync(keyPath, "utf8").trim();
    if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, "hex");
    throw new Error(`${keyPath} is corrupted (expected 64 hex chars)`);
  }
  const key = randomBytes(MASTER_KEY_BYTES);
  mkdirSync(path.dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, key.toString("hex"), { mode: 0o600 });
  chmodSync(keyPath, 0o600); // in case umask widened it anyway
  return key;
}

/** SQLite-backed SecretStore (node:sqlite, house style). */
export class SqliteSecretStore implements SecretStore {
  readonly #db: DatabaseSync;
  readonly #masterKey: Buffer;

  constructor(db: DatabaseSync, masterKey: Buffer) {
    if (masterKey.length !== MASTER_KEY_BYTES) {
      throw new Error("master key must be 32 bytes");
    }
    this.#db = db;
    this.#masterKey = masterKey;
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS secrets (
        ref        TEXT PRIMARY KEY,
        nonce      BLOB NOT NULL,
        ciphertext BLOB NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  put(plaintext: string): string {
    const ref = `sec_${randomUUID()}`;
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.#masterKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    // Append the auth tag to the ciphertext so one column carries everything.
    const sealed = Buffer.concat([ciphertext, cipher.getAuthTag()]);
    const now = new Date().toISOString();
    this.#db
      .prepare(
        "INSERT INTO secrets (ref, nonce, ciphertext, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(ref, nonce, sealed, now, now);
    return ref;
  }

  get(ref: string): string {
    const row = this.#db
      .prepare("SELECT nonce, ciphertext FROM secrets WHERE ref = ?")
      .get(ref) as { nonce: Uint8Array; ciphertext: Uint8Array } | undefined;
    if (!row) throw new SecretNotFoundError(ref);
    const sealed = Buffer.from(row.ciphertext);
    const tag = sealed.subarray(sealed.length - 16);
    const ciphertext = sealed.subarray(0, sealed.length - 16);
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.#masterKey,
        Buffer.from(row.nonce),
      );
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8",
      );
    } catch {
      throw new SecretUndecryptableError(ref);
    }
  }

  has(ref: string): boolean {
    return (
      this.#db.prepare("SELECT 1 AS x FROM secrets WHERE ref = ?").get(ref) !== undefined
    );
  }

  delete(ref: string): boolean {
    const result = this.#db.prepare("DELETE FROM secrets WHERE ref = ?").run(ref);
    return Number(result.changes) > 0;
  }

  /**
   * @internal All stored refs — exists ONLY for the orphan sweep in
   * HarnessSettingsStore (ref is opaque; no plaintext is exposed).
   */
  listRefs(): string[] {
    const rows = this.#db.prepare("SELECT ref FROM secrets").all() as { ref: string }[];
    return rows.map((r) => r.ref);
  }
}

