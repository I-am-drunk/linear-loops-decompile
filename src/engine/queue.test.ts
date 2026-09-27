/** T-403 run-queue tests — node:test, in-memory store, fixed ids. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  MemoryRunQueueStore,
  RunQueue,
  idempotencyKeyFor,
  type RunRequest,
} from "./queue.ts";

let counter = 0;
const ids = () => `run-${++counter}`;
const NOW = new Date("2026-02-01T12:00:00Z");

function req(over: Partial<RunRequest> = {}): RunRequest {
  return { loopId: "loop-1", kind: "event", requestedAt: NOW.toISOString(), ...over };
}

test("idempotency: the same event delivered twice enqueues once", () => {
  const q = new RunQueue(new MemoryRunQueueStore(), {}, ids);
  const a = q.enqueue(req({ triggerEventId: "evt-42" }));
  const b = q.enqueue(req({ triggerEventId: "evt-42" }));
  assert.equal(a.outcome, "queued");
  assert.deepEqual(b, { outcome: "duplicate", existingRunId: (a as { run: { id: string } }).run.id });
});

test("scheduled runs dedupe by (loopId, scheduledAt) — tick replay is safe", () => {
  const q = new RunQueue(new MemoryRunQueueStore(), {}, ids);
  q.enqueue(req({ kind: "scheduled", scheduledAt: "2026-02-01T09:00:00Z" }));
  const replay = q.enqueue(req({ kind: "scheduled", scheduledAt: "2026-02-01T09:00:00Z" }));
  assert.equal(replay.outcome, "duplicate");
  const nextOccurrence = q.enqueue(req({ kind: "scheduled", scheduledAt: "2026-02-02T09:00:00Z" }));
  assert.equal(nextOccurrence.outcome, "queued");
});

test("manual runs always enqueue (no accidental dedup)", () => {
  const q = new RunQueue(new MemoryRunQueueStore(), {}, ids);
  assert.equal(q.enqueue(req({ kind: "manual" })).outcome, "queued");
  assert.equal(q.enqueue(req({ kind: "manual" })).outcome, "queued");
});

test("per-loop concurrency: one active run per loop by default", () => {
  const q = new RunQueue(new MemoryRunQueueStore(), {}, ids);
  q.enqueue(req({ triggerEventId: "a" }));
  q.enqueue(req({ triggerEventId: "b" }));
  const started = q.startNext(NOW);
  assert.equal(started.length, 1);
  assert.equal(started[0]!.triggerEventId, "a"); // FIFO
  assert.equal(q.startNext(NOW).length, 0); // still blocked
  q.markFinished(started[0]!.id);
  const next = q.startNext(NOW);
  assert.equal(next.length, 1);
  assert.equal(next[0]!.triggerEventId, "b");
});

test("different loops run concurrently; the global cap binds", () => {
  const q = new RunQueue(new MemoryRunQueueStore(), { maxConcurrentTotal: 2 }, ids);
  q.enqueue(req({ loopId: "loop-1", triggerEventId: "a" }));
  q.enqueue(req({ loopId: "loop-2", triggerEventId: "b" }));
  q.enqueue(req({ loopId: "loop-3", triggerEventId: "c" }));
  assert.equal(q.startNext(NOW).length, 2); // global cap
});

test("cancel removes only waiting runs", () => {
  const q = new RunQueue(new MemoryRunQueueStore(), {}, ids);
  const r1 = q.enqueue(req({ triggerEventId: "a" }));
  const r2 = q.enqueue(req({ loopId: "loop-2", triggerEventId: "b" }));
  const run1 = (r1 as { run: { id: string } }).run.id;
  const run2 = (r2 as { run: { id: string } }).run.id;
  q.startNext(NOW); // both active (different loops)
  assert.equal(q.cancel(run1), false); // active: runtime's business
  const r3 = q.enqueue(req({ triggerEventId: "c" })); // waiting behind r1
  assert.equal(q.cancel((r3 as { run: { id: string } }).run.id), true);
  assert.equal(q.list().find((r) => r.id === run2)?.state, "active");
  assert.equal(q.list().length, 2);
});

test("runs-per-hour budget: over-budget loops wait, others proceed", () => {
  const q = new RunQueue(new MemoryRunQueueStore(), { maxRunsPerLoopPerHour: 2 }, ids);
  q.enqueue(req({ triggerEventId: "a" }));
  q.markFinished(q.startNext(NOW)[0]!.id);
  q.enqueue(req({ triggerEventId: "b" }));
  q.markFinished(q.startNext(new Date(NOW.getTime() + 60_000))[0]!.id);
  q.enqueue(req({ triggerEventId: "c" }));
  assert.equal(q.startNext(new Date(NOW.getTime() + 120_000)).length, 0); // budget hit, still waiting
  // one hour later the window has slid
  const later = new Date(NOW.getTime() + 3_700_000);
  assert.equal(q.startNext(later).length, 1);
});

test("daily cost budget gates starts and resets the next UTC day", () => {
  const q = new RunQueue(new MemoryRunQueueStore(), { maxCostPerLoopPerDayUsd: 1.0 }, ids);
  q.recordCost("loop-1", 1.0, NOW);
  q.enqueue(req({ triggerEventId: "a" }));
  assert.equal(q.startNext(NOW).length, 0); // over budget
  q.enqueue(req({ loopId: "loop-2", triggerEventId: "b" }));
  assert.equal(q.startNext(NOW).length, 1); // loop-2 unaffected
  const tomorrow = new Date("2026-02-02T00:00:05Z");
  assert.equal(q.startNext(tomorrow).length, 1); // new day → budget reset
});

test("drain stops starts; resume re-enables them", () => {
  const q = new RunQueue(new MemoryRunQueueStore(), {}, ids);
  q.enqueue(req({ triggerEventId: "a" }));
  q.drain();
  assert.equal(q.startNext(NOW).length, 0);
  q.resume();
  assert.equal(q.startNext(NOW).length, 1);
});

test("idempotency keys are stable, readable, and distinguishable", () => {
  const k1 = idempotencyKeyFor(req({ triggerEventId: "evt-1" }));
  const k2 = idempotencyKeyFor(req({ triggerEventId: "evt-1" }));
  const k3 = idempotencyKeyFor(req({ triggerEventId: "evt-2" }));
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
  assert.ok(k1.startsWith("evt:loop-1:"));
  const callerKey = idempotencyKeyFor(req({ idempotencyKey: "caller-supplied" }));
  assert.equal(callerKey, "caller-supplied");
});
