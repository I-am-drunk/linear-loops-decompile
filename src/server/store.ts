/**
 * State store: node:sqlite, zero dependencies. Schema is versioned with
 * PRAGMA user_version; migrations are additive and run at boot.
 *
 * What lives here (SPECS/target-architecture.md §Data ownership): OUR state
 * only (settings, loops, runs later, audit). Linear's data never persists here.
 */

import { DatabaseSync } from "node:sqlite";
import type { LoopConfig, LoopRecord } from "../model/loop.ts";

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
      this.db.exec("PRAGMA user_version = 1");
    }
    if (v.user_version < 2) {
      // R4.1 loops domain. `live_json` is null until first publish; `draft_json`
      // is null when no unpublished edits exist (WorkflowDefinitionDraft model).
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS loops (
          id TEXT PRIMARY KEY,
          slug_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          live_json TEXT,
          draft_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          published_at TEXT,
          version INTEGER NOT NULL DEFAULT 0
        );
      `);
      this.db.exec("PRAGMA user_version = 2");
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

  // --- loops (R4.1) ---------------------------------------------------------

  insertLoop(rec: LoopRecord): void {
    this.db
      .prepare(
        "INSERT INTO loops (id, slug_id, name, live_json, draft_json, created_at, updated_at, published_at, version) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(rec.id, rec.slugId, rec.name, rec.live ? JSON.stringify(rec.live) : null,
        rec.draft ? JSON.stringify(rec.draft) : null, rec.createdAt, rec.updatedAt,
        rec.publishedAt ?? null, rec.version);
  }

  updateLoop(rec: LoopRecord): void {
    this.db
      .prepare(
        "UPDATE loops SET name = ?, live_json = ?, draft_json = ?, updated_at = ?, published_at = ?, version = ? WHERE id = ?",
      )
      .run(rec.name, rec.live ? JSON.stringify(rec.live) : null,
        rec.draft ? JSON.stringify(rec.draft) : null, rec.updatedAt,
        rec.publishedAt ?? null, rec.version, rec.id);
  }

  /** Accepts the internal id or the route-facing slugId. */
  getLoop(idOrSlug: string): LoopRecord | undefined {
    const row = this.db
      .prepare("SELECT * FROM loops WHERE id = ? OR slug_id = ?")
      .get(idOrSlug, idOrSlug) as unknown as LoopRow | undefined;
    return row ? loopFromRow(row) : undefined;
  }

  listLoops(): LoopRecord[] {
    const rows = this.db.prepare("SELECT * FROM loops ORDER BY created_at ASC").all() as unknown as LoopRow[];
    return rows.map(loopFromRow);
  }

  close(): void {
    this.db.close();
  }
}

interface LoopRow {
  id: string;
  slug_id: string;
  name: string;
  live_json: string | null;
  draft_json: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  version: number;
}

function loopFromRow(row: LoopRow): LoopRecord {
  return {
    id: row.id,
    slugId: row.slug_id,
    name: row.name,
    live: row.live_json ? (JSON.parse(row.live_json) as LoopConfig) : null,
    draft: row.draft_json ? (JSON.parse(row.draft_json) as LoopConfig) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at ?? undefined,
    version: row.version,
  };
}
