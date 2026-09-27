/**
 * T-603 verification: usage counters — the UsageLedger (per-run and per-day
 * aggregates) and the trackUsage stream wrapper that folds adapter `usage`
 * events into one totals object. node:sqlite in-memory; no network.
 * Run: npm test
 */

import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  createUsageTotals,
  trackUsage,
  UsageLedger,
  type InferenceStreamEvent,
} from "../src/index.ts";

async function* fakeStream(events: InferenceStreamEvent[]) {
  for (const e of events) yield e;
}

test("trackUsage: passes events through and folds usage frames (latest non-null wins)", async () => {
  const totals = createUsageTotals();
  const seen: InferenceStreamEvent[] = [];
  const stream = trackUsage(
    fakeStream([
      { type: "usage", inputTokens: 25, outputTokens: null }, // anthropic message_start
      { type: "reasoning", text: "hmm" },
      { type: "text", text: "hi" },
      { type: "usage", inputTokens: null, outputTokens: 12 }, // anthropic message_delta
      { type: "done", finishReason: "end_turn" },
    ]),
    totals,
  );
  for await (const e of stream) seen.push(e);
  assert.equal(seen.length, 5); // nothing swallowed
  assert.deepEqual(totals, { inputTokens: 25, outputTokens: 12 });
});

test("ledger: records calls and sums them per run", () => {
  const ledger = new UsageLedger(new DatabaseSync(":memory:"));
  ledger.record({ runId: "run_1", harness: "or", model: "m1", totals: { inputTokens: 10, outputTokens: 5 } });
  ledger.record({ runId: "run_1", harness: "or", model: "m1", totals: { inputTokens: 20, outputTokens: 7 } });
  ledger.record({ runId: "run_2", harness: "claude", model: "m2", totals: { inputTokens: 99, outputTokens: 1 } });

  assert.deepEqual(ledger.totalsForRun("run_1"), { calls: 2, inputTokens: 30, outputTokens: 12 });
  assert.deepEqual(ledger.totalsForRun("run_2"), { calls: 1, inputTokens: 99, outputTokens: 1 });
  assert.deepEqual(ledger.totalsForRun("run_nope"), { calls: 0, inputTokens: 0, outputTokens: 0 });
});

test("ledger: per-day totals feed the global daily cap", () => {
  const ledger = new UsageLedger(new DatabaseSync(":memory:"));
  const today = new Date().toISOString().slice(0, 10);
  ledger.record({ runId: "run_1", harness: "or", model: "m", totals: { inputTokens: 3, outputTokens: 4 } });
  ledger.record({ runId: "run_2", harness: "or", model: "m", totals: { inputTokens: 1, outputTokens: 2 } });

  assert.deepEqual(ledger.totalsForUtcDay(today), { calls: 2, inputTokens: 4, outputTokens: 6 });
  assert.deepEqual(ledger.totalsForUtcDay("1999-01-01"), { calls: 0, inputTokens: 0, outputTokens: 0 });
});
