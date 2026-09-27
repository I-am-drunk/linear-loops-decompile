/**
 * State store: node:sqlite, zero dependencies. Schema is versioned with
 * PRAGMA user_version; migrations are additive and run at boot.
 *
 * What lives here (SPECS/target-architecture.md §Data ownership): OUR state
 * only (settings, loops, runs later, audit). Linear's data never persists here.
 */

import { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 1;

export class Store {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    const v = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
    if (v.user_version < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          at TEXT NOT NULL,
          kind TEXT NOT NULL,
          json TEXT NOT NULL
        );
      `);
      this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    }
  }

  getSetting(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      )
      .run(key, value, new Date().toISOString());
  }

  /** Append-only audit log: every trigger, decision, brain call, write. */
  audit(kind: string, data: unknown): void {
    this.db
      .prepare("INSERT INTO audit_events (at, kind, json) VALUES (?, ?, ?)")
      .run(new Date().toISOString(), kind, JSON.stringify(data));
  }

  auditTail(limit = 50): Array<{ id: number; at: string; kind: string; json: string }> {
    return this.db
      .prepare("SELECT id, at, kind, json FROM audit_events ORDER BY id DESC LIMIT ?")
      .all(limit) as Array<{ id: number; at: string; kind: string; json: string }>;
  }

  close(): void {
    this.db.close();
  }
}
