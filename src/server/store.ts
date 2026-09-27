/**
 * State store: node:sqlite, zero dependencies. Schema is versioned with
 * PRAGMA user_version; migrations are additive and run at boot.
 *
 * What lives here (SPECS/target-architecture.md §Data ownership): OUR state
 * only (settings, loops, runs later, audit). Linear's data never persists here.
 */

import { DatabaseSync } from "node:sqlite";

const SCHEMA_VERSION = 2;

/** A loop row: JSON columns hold the live config and the draft working copy
 * (src/model/loop.ts owns the shapes; the store stays dumb SQL). */
export interface StoredLoop {
  id: string;
  slugId: string;
  liveJson: string;
  draftJson: string;
  version: number;
  statsJson: string;
  createdAt: string;
  updatedAt: string;
  lastPublishedAt?: string;
  lastExecutedAt?: string;
}

interface LoopRow {
  id: string;
  slug_id: string;
  live_json: string;
  draft_json: string;
  version: number;
  stats_json: string;
  created_at: string;
  updated_at: string;
  last_published_at: string | null;
  last_executed_at: string | null;
}

function rowToLoop(row: LoopRow): StoredLoop {
  return {
    id: row.id,
    slugId: row.slug_id,
    liveJson: row.live_json,
    draftJson: row.draft_json,
    version: row.version,
    statsJson: row.stats_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastPublishedAt: row.last_published_at ?? undefined,
    lastExecutedAt: row.last_executed_at ?? undefined,
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
    // Migrations are additive; each lands once, in version order.
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
          slug_id TEXT NOT NULL UNIQUE,
          live_json TEXT NOT NULL,
          draft_json TEXT NOT NULL,
          version INTEGER NOT NULL,
          stats_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_published_at TEXT,
          last_executed_at TEXT
        );
      `);
    }
    this.db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
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

  // --- Loops (R4.1) ---------------------------------------------------------

  putLoop(loop: StoredLoop): void {
    this.db
      .prepare(
        `INSERT INTO loops (id, slug_id, live_json, draft_json, version, stats_json,
                            created_at, updated_at, last_published_at, last_executed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           live_json = excluded.live_json, draft_json = excluded.draft_json,
           version = excluded.version, stats_json = excluded.stats_json,
           updated_at = excluded.updated_at,
           last_published_at = excluded.last_published_at,
           last_executed_at = excluded.last_executed_at`,
      )
      .run(
        loop.id,
        loop.slugId,
        loop.liveJson,
        loop.draftJson,
        loop.version,
        loop.statsJson,
        loop.createdAt,
        loop.updatedAt,
        loop.lastPublishedAt ?? null,
        loop.lastExecutedAt ?? null,
      );
  }

  getLoop(id: string): StoredLoop | undefined {
    const row = this.db.prepare("SELECT * FROM loops WHERE id = ?").get(id) as LoopRow | undefined;
    return row ? rowToLoop(row) : undefined;
  }

  allLoops(): StoredLoop[] {
    const rows = this.db.prepare("SELECT * FROM loops ORDER BY created_at ASC, id ASC").all() as LoopRow[];
    return rows.map(rowToLoop);
  }

  close(): void {
    this.db.close();
  }
}
