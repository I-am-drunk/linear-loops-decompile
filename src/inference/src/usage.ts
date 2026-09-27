/**
 * Usage counters (T-603) — one row per brain call, summed per run and per
 * UTC day (the numbers SPECS/agent.md's `Run.usage` and
 * SPECS/target-architecture.md's "global daily cap" budget check read).
 *
 * Tokens only, deliberately no cost column: pricing drifts per provider and
 * model, and a wrong dollar figure is worse than none. If a provider ever
 * returns its own cost figure, record it as a new column then — YAGNI now.
 *
 * Shape: adapters emit `usage` stream events (input tokens once, output
 * tokens once at the end — Anthropic) or a single combined frame (OpenAI
 * shape). `trackUsage` wraps a stream and folds those into one totals object;
 * the runtime records it with `UsageLedger.record` when the call ends.
 */

import { DatabaseSync } from "node:sqlite";

import type { InferenceStreamEvent } from "./adapters/openai-compatible.ts";

/** Accumulated token counters for one brain call. */
export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
}

/** Fresh zeroed totals, for passing to `trackUsage`. */
export function createUsageTotals(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0 };
}

/**
 * Wrap an inference stream, passing every event through unchanged while
 * folding `usage` events into `totals` (latest non-null value of each kind
 * wins — Anthropic reports input and output in separate frames). Read
 * `totals` after the stream ends and hand it to UsageLedger.record.
 */
export async function* trackUsage(
  stream: AsyncGenerator<InferenceStreamEvent>,
  totals: UsageTotals,
): AsyncGenerator<InferenceStreamEvent> {
  for await (const event of stream) {
    if (event.type === "usage") {
      if (event.inputTokens !== null) totals.inputTokens = event.inputTokens;
      if (event.outputTokens !== null) totals.outputTokens = event.outputTokens;
    }
    yield event;
  }
}

/** Row shape of `usage_events`. */
interface UsageRow {
  run_id: string;
  harness: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

/** Aggregate over a set of rows. */
export interface UsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

function summarize(rows: UsageRow[]): UsageSummary {
  const out: UsageSummary = { calls: rows.length, inputTokens: 0, outputTokens: 0 };
  for (const r of rows) {
    out.inputTokens += r.input_tokens;
    out.outputTokens += r.output_tokens;
  }
  return out;
}

/** SQLite-backed per-run usage counters (node:sqlite, house style). */
export class UsageLedger {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id        TEXT NOT NULL,
        harness       TEXT NOT NULL,
        model         TEXT NOT NULL,
        input_tokens  INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        created_at    TEXT NOT NULL
      )
    `);
    this.#db.exec(
      "CREATE INDEX IF NOT EXISTS usage_events_run ON usage_events(run_id)",
    );
    this.#db.exec(
      "CREATE INDEX IF NOT EXISTS usage_events_day ON usage_events(created_at)",
    );
  }

  /** Record one finished brain call against its run. */
  record(entry: {
    runId: string;
    harness: string;
    model: string;
    totals: UsageTotals;
  }): void {
    this.#db
      .prepare(
        `INSERT INTO usage_events (run_id, harness, model, input_tokens, output_tokens, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.runId,
        entry.harness,
        entry.model,
        entry.totals.inputTokens,
        entry.totals.outputTokens,
        new Date().toISOString(),
      );
  }

  /** Totals for one run — feeds Run.usage in the runtime. */
  totalsForRun(runId: string): UsageSummary {
    const rows = this.#db
      .prepare("SELECT * FROM usage_events WHERE run_id = ?")
      .all(runId) as unknown as UsageRow[];
    return summarize(rows);
  }

  /**
   * Global totals for one UTC day (YYYY-MM-DD; defaults to today) — the
   * input to the daily-cap budget check.
   */
  totalsForUtcDay(day?: string): UsageSummary {
    const d = day ?? new Date().toISOString().slice(0, 10);
    const rows = this.#db
      .prepare("SELECT * FROM usage_events WHERE substr(created_at, 1, 10) = ?")
      .all(d) as unknown as UsageRow[];
    return summarize(rows);
  }
}
