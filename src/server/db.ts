/**
 * Database layer — node:sqlite (house style: zero deps, Node 22+).
 *
 * One file, one schema. Migrations are idempotent DDL executed at open; bump
 * `SCHEMA_VERSION` and append a new block when the shape changes. Data
 * ownership per SPECS/target-architecture.md §data-ownership: loops, runs,
 * turns/parts, settings, audit events, idempotency keys, usage are OURS;
 * Linear stays read-via-dataplane.
 *
 * Secrets are NOT here: secret material lives in src/inference's write-only
 * store (R6); this schema only ever holds non-secret settings and secret
 * REFERENCES. `store.setSetting` refuses obviously-secret keys.
 *
 * Original code.
 */

import { DatabaseSync } from "node:sqlite";

export const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS loops (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  version      INTEGER NOT NULL DEFAULT 1,
  config_json  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id               TEXT PRIMARY KEY,
  loop_id          TEXT NOT NULL REFERENCES loops(id),
  status           TEXT NOT NULL,
  iteration        INTEGER NOT NULL,
  target_json      TEXT,
  created_at       TEXT NOT NULL,
  started_at       TEXT,
  ended_at         TEXT,
  summary          TEXT,
  error            TEXT,
  usage_json       TEXT NOT NULL DEFAULT '{"inputTokens":0,"outputTokens":0,"costUsd":0}',
  conversation_id  TEXT,
  idempotency_key  TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS runs_by_loop ON runs(loop_id, created_at);

CREATE TABLE IF NOT EXISTS turns (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES runs(id),
  position    INTEGER NOT NULL,
  role        TEXT NOT NULL,
  status      TEXT NOT NULL,
  parts_json  TEXT NOT NULL DEFAULT '[]',
  started_at  TEXT NOT NULL,
  ended_at    TEXT,
  UNIQUE(run_id, position)
);

CREATE TABLE IF NOT EXISTS snapshots (
  run_id    TEXT PRIMARY KEY REFERENCES runs(id),
  saved_at  TEXT NOT NULL,
  json      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value_json  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  kind        TEXT NOT NULL,
  loop_id     TEXT,
  run_id      TEXT,
  detail_json TEXT
);

-- The key is claimed BEFORE the run row exists (claim decides whether the
-- run happens at all), so no FK to runs.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
`;

export type Database = DatabaseSync;

/** Open (and migrate) the loops database. `:memory:` for tests. */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  return db;
}
