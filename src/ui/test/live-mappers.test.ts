/**
 * T-1104 unit tests for the wire→view-model mappers. Runs under
 * `node --experimental-strip-types --test` (imported modules stay free of
 * enums/namespaces).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  createRunDetailReducer,
  isWireRunEvent,
  turnsToActivities,
  wireLoopToSummary,
  wireRunToDetail,
  wireRunToSummary,
} from "../src/live/mappers.ts";
import type { WireLoop, WireRun, WireRunEvent, WireTurn } from "../src/live/contract.ts";
import type { LoopConfig } from "../../model/index.ts";

const mkConfig = (over: Partial<LoopConfig>): LoopConfig => ({
  name: over.name ?? "Triage digest",
  prompt: { format: "markdown", markdown: "Summarize new issues" },
  trigger: {
    type: "schedule",
    schedule: { rrule: "FREQ=DAILY;BYHOUR=9", timezone: "UTC" },
  },
  conditions: [],
  enabled: true,
  applyToSubTeams: false,
  activities: ["comment"],
  trustedSourceKeys: [],
  codeAccess: "none",
  editAccess: "team",
  subscriberIds: [],
  ...over,
});

const mkRun = (over: Partial<WireRun>): WireRun => ({
  id: over.id ?? "run-1",
  loopId: over.loopId ?? "loop-1",
  status: over.status ?? "complete",
  iteration: over.iteration ?? 1,
  createdAt: over.createdAt ?? "2026-09-27T10:00:00.000Z",
  usage: over.usage ?? { inputTokens: 120, outputTokens: 45, costUsd: 0.0042 },
  ...over,
});

test("wireRunToSummary: finished run maps target, duration, cost", () => {
  const s = wireRunToSummary(
    mkRun({
      target: { entity: "issue", id: "abc", label: "SUP-214" },
      startedAt: "2026-09-27T10:00:01.000Z",
      endedAt: "2026-09-27T10:00:42.000Z",
    }),
    "Triage digest",
  );
  assert.equal(s.loopName, "Triage digest");
  assert.deepEqual(s.target, { entityType: "issue", label: "SUP-214" });
  assert.equal(s.durationMs, 41_000);
  assert.equal(s.costUsd, 0.0042);
});

test("wireRunToSummary: pending run omits optional fields; target label falls back to id", () => {
  const s = wireRunToSummary(
    mkRun({ status: "pending", usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }, target: { entity: "issue", id: "xyz" } }),
    "SLA watch",
  );
  assert.equal(s.startedAt, undefined);
  assert.equal(s.durationMs, undefined);
  assert.equal(s.costUsd, undefined);
  assert.deepEqual(s.target, { entityType: "issue", label: "xyz" });
});

test("wireLoopToSummary: config display fields + last-run chip + owner fallback", () => {
  const loop: WireLoop = {
    id: "loop-1",
    name: "Triage digest",
    enabled: true,
    version: 3,
    config: mkConfig({ icon: "📋", color: "#ff8800", description: "Morning summary", groupName: "Ops" }),
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
  };
  const lastRun = mkRun({
    status: "error",
    startedAt: "2026-09-27T08:00:00.000Z",
    endedAt: "2026-09-27T08:00:12.000Z",
  });
  const s = wireLoopToSummary(loop, lastRun);
  assert.equal(s.icon, "📋");
  assert.equal(s.color, "#ff8800");
  assert.equal(s.groupName, "Ops");
  assert.equal(s.ownerName, ""); // no server-side join yet
  assert.deepEqual(s.lastRun, { status: "error", at: "2026-09-27T08:00:12.000Z", durationMs: 12_000 });
  // never-run loop: no chip
  assert.equal(wireLoopToSummary(loop, undefined).lastRun, undefined);
});

test("turnsToActivities: out-of-order turns sort by position; ids carry the turn", () => {
  const turns: WireTurn[] = [
    {
      id: "t2", runId: "run-1", position: 1, role: "agent", status: "complete",
      startedAt: "2026-09-27T10:00:05.000Z",
      parts: [{ kind: "response", text: "Posted the summary." }],
    },
    {
      id: "t1", runId: "run-1", position: 0, role: "agent", status: "complete",
      startedAt: "2026-09-27T10:00:01.000Z",
      parts: [
        { kind: "thought", text: "Reading the issue." },
        { kind: "action", tool: "linear.comment", label: "Write comment", resultSummary: "ok" },
      ],
    },
  ];
  const items = turnsToActivities(turns);
  assert.deepEqual(items.map((i) => i.id), ["t1#0", "t1#1", "t2#0"]);
  assert.deepEqual(items.map((i) => i.kind), ["thought", "action", "response"]);
  const action = items[1]!;
  assert.equal(action.kind, "action");
  if (action.kind === "action") {
    assert.equal(action.resultSummary, "ok");
    assert.equal(action.argsSummary, undefined);
  }
});

test("reducer: live parts land after history; status + usage fold in", () => {
  const run = mkRun({ status: "active", startedAt: "2026-09-27T10:00:01.000Z" });
  const turns: WireTurn[] = [
    {
      id: "t1", runId: "run-1", position: 0, role: "agent", status: "streaming",
      startedAt: "2026-09-27T10:00:01.000Z",
      parts: [{ kind: "thought", text: "Drafting." }],
    },
  ];
  const initial = wireRunToDetail(run, turns, "Triage digest");
  const reducer = createRunDetailReducer(initial);

  const at = "2026-09-27T10:00:09.000Z";
  const e1: WireRunEvent = { seq: 7, runId: "run-1", at, type: "partAppended", turnId: "t1", part: { kind: "response", text: "Hi" } };
  const d1 = reducer.apply(e1);
  assert.deepEqual(d1.activities.map((i) => i.id), ["t1#0", "t1#1"]);
  assert.equal(d1.activities[1]!.kind, "response");

  const finished = mkRun({
    status: "complete",
    startedAt: "2026-09-27T10:00:01.000Z",
    endedAt: "2026-09-27T10:00:42.000Z",
    summary: "Posted the standup summary.",
  });
  const d2 = reducer.apply({ seq: 9, runId: "run-1", at, type: "runStatus", status: "complete", run: finished });
  assert.equal(d2.status, "complete");
  assert.equal(d2.summary, "Posted the standup summary.");
  assert.equal(d2.durationMs, 41_000);

  const d3 = reducer.apply({ seq: 10, runId: "run-1", at, type: "usage", usage: { inputTokens: 500, outputTokens: 120, costUsd: 0.011 } });
  assert.equal(d3.usage?.inputTokens, 500);
  assert.equal(d3.costUsd, 0.011);
});

test("reducer: turnStarted with inline parts renders them once; later parts index after", () => {
  const initial = wireRunToDetail(mkRun({ status: "active" }), [], "Loop");
  const reducer = createRunDetailReducer(initial);
  const at = "2026-09-27T10:00:09.000Z";
  reducer.apply({
    seq: 2, runId: "run-1", at, type: "turnStarted",
    turn: {
      id: "t9", runId: "run-1", position: 3, role: "agent", status: "streaming", startedAt: at,
      parts: [{ kind: "thought", text: "inline" }],
    },
  });
  const d = reducer.apply({ seq: 3, runId: "run-1", at, type: "partAppended", turnId: "t9", part: { kind: "error", message: "boom" } });
  assert.deepEqual(d.activities.map((i) => i.id), ["t9#0", "t9#1"]);
  assert.equal(d.activities[1]!.position, 3 * 1000 + 1);
});

test("isWireRunEvent: per-type required fields; malformed and unknown kinds rejected", () => {
  const run = mkRun({});
  assert.equal(isWireRunEvent({ type: "runStatus", run }), true);
  assert.equal(isWireRunEvent({ type: "runStatus", run: { status: "complete" } }), false); // no usage
  assert.equal(
    isWireRunEvent({ type: "turnStarted", turn: { id: "t", position: 0, parts: [] } }),
    true,
  );
  assert.equal(isWireRunEvent({ type: "turnStarted", turn: { id: "t" } }), false);
  assert.equal(isWireRunEvent({ type: "partAppended", turnId: "t", part: { kind: "thought", text: "x" } }), true);
  assert.equal(isWireRunEvent({ type: "partAppended", turnId: "t" }), false);
  assert.equal(isWireRunEvent({ type: "turnCompleted", turnId: "t", status: "complete" }), true);
  assert.equal(isWireRunEvent({ type: "usage", usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.1 } }), true);
  assert.equal(isWireRunEvent({ type: "usage", usage: {} }), false);
  assert.equal(isWireRunEvent({ type: "somethingElse" }), false);
});
