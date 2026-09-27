/**
 * State store: node:sqlite, zero dependencies. Schema is versioned with
 * PRAGMA user_version; migrations are additive and run at boot.
 *
 * What lives here (SPECS/target-architecture.md §Data ownership): OUR state
 * only (settings, loops, runs later, audit). Linear's data never persists here.
 */

import { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 2;

/** Raw loops-table row: config/draft are LoopConfig JSON (src/model/loop.ts). */
export interface LoopRow {
  id: string;
  config: string;
  draft: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  lastExecutedAt: string | null;
}

interface LoopRowSql {
  id: string;
  config: string;
  draft: string;
  version: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  last_executed_at: string | null;
}

function toLoopRow(r: LoopRowSql): LoopRow {
  return {
    id: r.id,
    config: r.config,
    draft: r.draft,
    version: r.version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
    lastExecutedAt: r.last_executed_at,
  };
}

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
    }
    if (v.user_version < 2) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS loops (
          id TEXT PRIMARY KEY,
          config TEXT NOT NULL,
          draft TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          published_at TEXT,
          last_executed_at TEXT
        );
      `);
    }
    if (v.user_version < SCHEMA_VERSION) {
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

  // --- loops (R4.1a) -------------------------------------------------------

  listLoops(): LoopRow[] {
    const rows = this.db
      .prepare("SELECT * FROM loops ORDER BY created_at ASC, id ASC")
      .all() as unknown as LoopRowSql[];
    return rows.map(toLoopRow);
  }

  getLoop(id: string): LoopRow | undefined {
    const row = this.db.prepare("SELECT * FROM loops WHERE id = ?").get(id) as
      | LoopRowSql
      | undefined;
    return row ? toLoopRow(row) : undefined;
  }

  insertLoop(row: LoopRow): void {
    this.db
      .prepare(
        "INSERT INTO loops (id, config, draft, version, created_at, updated_at, published_at, last_executed_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(row.id, row.config, row.draft, row.version, row.createdAt, row.updatedAt, row.publishedAt, row.lastExecutedAt);
  }

  updateLoopDraft(id: string, draft: string, updatedAt: string): void {
    this.db.prepare("UPDATE loops SET draft = ?, updated_at = ? WHERE id = ?").run(draft, updatedAt, id);
  }

  /** Publish: the live config becomes the draft; version bumps; timestamps stamp. */
  publishLoop(id: string, at: string): void {
    this.db
      .prepare("UPDATE loops SET config = draft, version = version + 1, published_at = ?, updated_at = ? WHERE id = ?")
      .run(at, at, id);
  }

  /** Rewrite both config and draft (used by setEnabled so a later publish cannot revert the toggle). */
  writeLoopConfigs(id: string, config: string, draft: string, updatedAt: string): void {
    this.db
      .prepare("UPDATE loops SET config = ?, draft = ?, updated_at = ? WHERE id = ?")
      .run(config, draft, updatedAt, id);
  }

  close(): void {
    this.db.close();
  }
}
