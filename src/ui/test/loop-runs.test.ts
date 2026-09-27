/**
 * T-703 unit tests for the pure runs modules. Strip-types safe.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { filterRuns } from "../src/features/loops/runs/runsFilter.ts";
import {
  formatCost,
  formatDuration,
  formatTokens,
  isCancelable,
  isLiveStatus,
  statusLabel,
} from "../src/features/loops/runs/format.ts";
import { followUpCopy } from "../src/features/loops/runs/format.ts";
import type { RunSummary } from "../src/features/loops/runs/types.ts";

const mk = (id: string, status: RunSummary["status"], createdAt: string): RunSummary => ({
  id, loopId: "l", loopName: "L", status, createdAt,
});

test("format: duration, cost, tokens, status labels", () => {
  assert.equal(formatDuration(41_000), "41s");
  assert.equal(formatDuration(130_000), "2m 10s");
  assert.equal(formatDuration(3_600_000), "1h");
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatCost(0), "$0.00");
  assert.equal(formatCost(0.0042), "$0.0042");
  assert.equal(formatCost(1.234), "$1.23");
  assert.equal(formatTokens(340), "340");
  assert.equal(formatTokens(1240), "1.2k");
  assert.equal(statusLabel("awaitingInput"), "Waiting for input");
  assert.equal(statusLabel("waiting"), "Queued");
});

test("live + cancelable statuses", () => {
  for (const s of ["pending", "waiting", "active", "awaitingInput"] as const) {
    assert.ok(isLiveStatus(s));
    assert.ok(isCancelable(s));
  }
  for (const s of ["complete", "error", "canceled"] as const) {
    assert.ok(!isLiveStatus(s));
    assert.ok(!isCancelable(s));
  }
});

test("filterRuns: newest first; active = live statuses; failed = error only", () => {
  const runs = [
    mk("old", "complete", "2026-09-25T00:00:00Z"),
    mk("live", "active", "2026-09-27T00:00:00Z"),
    mk("mid", "error", "2026-09-26T00:00:00Z"),
    mk("canceled", "canceled", "2026-09-26T12:00:00Z"),
    mk("queued", "waiting", "2026-09-27T01:00:00Z"),
  ];
  assert.deepEqual(filterRuns(runs, "all").map((r) => r.id), ["queued", "live", "canceled", "mid", "old"]);
  assert.deepEqual(filterRuns(runs, "active").map((r) => r.id), ["queued", "live"]);
  assert.deepEqual(filterRuns(runs, "failed").map((r) => r.id), ["mid"]); // canceled is NOT failed
});

test("follow-up box copy states", () => {
  assert.deepEqual(followUpCopy("awaitingInput"), { placeholder: "Answer the loop…", button: "Send answer" });
  assert.equal(followUpCopy("active").button, "Steer");
  assert.equal(followUpCopy("pending").button, "Steer");
  assert.equal(followUpCopy("waiting").button, "Steer");
  assert.equal(followUpCopy("complete").button, "Continue");
  assert.equal(followUpCopy("error").button, "Continue");
  assert.equal(followUpCopy("canceled").button, "Continue");
});
