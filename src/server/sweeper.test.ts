/**
 * Tests for the M6 run sweeper (T-504's markStale consumer).
 * Zero-dep: node --experimental-strip-types --test.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ScriptBrain } from "../runtime/brain.ts";
import type { Brain } from "../runtime/brain.ts";
import { Runner } from "../runtime/runner.ts";
import type { EntityId, Part, RunEvent } from "../runtime/types.ts";
import { createRunSweeper } from "./sweeper.ts";

/** Deterministic clock shared by a test. */
function clock(start = Date.UTC(2026, 8, 27, 12, 0, 0)) {
  let t = start;
  return {
    now: () => new Date(t),
    advance: (ms: number) => { t += ms; },
  };
}

/** A publish sink recorder (stands in for createRunEventPublisher). */
function recorder() {
  const events: { runId: EntityId; type: RunEvent["type"] }[] = [];
  return {
    events,
    sink: (runId: EntityId, event: RunEvent) => { events.push({ runId, type: event.type }); },
  };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("run sweeper (M6)", () => {
  it("marks a hung ACTIVE run stale after the threshold, with the audit hook", async () => {
    const hung: Brain = {
      async *stream(): AsyncIterable<Part> {
        yield { kind: "thought", text: "starting…" };
        await new Promise<void>(() => {}); // wedged forever
      },
    };
    const runner = new Runner();
    const clockCtl = clock();
    const marked: [EntityId, number][] = [];
    const sweeper = createRunSweeper({
      runner,
      staleAfterMs: 60_000,
      now: clockCtl.now,
      onMark: (runId, silentMs) => marked.push([runId, silentMs]),
    });
    const rec = recorder();
    const publish = sweeper.trackPublish(rec.sink);

    const run = runner.start({ loopId: "loop-1", message: "go", brain: hung });
    runner.subscribe(run.id, (e) => publish(run.id, e));
    await tick(); // the first part streams, then the brain wedges

    // First sweep registers first-sight grace; second sweep inside the window: untouched.
    assert.deepEqual(sweeper.sweep(), []);
    clockCtl.advance(30_000);
    assert.deepEqual(sweeper.sweep(), []);
    // Past the threshold: marked stale, audited with the silent duration, wrapped sink saw every event.
    clockCtl.advance(31_000);
    assert.deepEqual(sweeper.sweep(), [run.id]);
    assert.equal(runner.getRun(run.id).status, "stale");
    assert.equal(marked.length, 1);
    assert.equal(marked[0]![0], run.id);
    assert.ok(marked[0]![1] > 60_000);
    assert.ok(rec.events.length >= 3, "the wrapped sink still received every event");
    // Terminal now — subsequent sweeps ignore it.
    assert.deepEqual(sweeper.sweep(), []);
  });

  it("never marks a run that keeps making progress", async () => {
    let openGate!: () => void;
    const gate = new Promise<void>((r) => { openGate = r; });
    const slow: Brain = {
      async *stream(): AsyncIterable<Part> {
        yield { kind: "thought", text: "one" };
        await gate;
        yield { kind: "response", text: "done" };
      },
    };
    const runner = new Runner();
    const clockCtl = clock();
    const sweeper = createRunSweeper({ runner, staleAfterMs: 60_000, now: clockCtl.now });
    const rec = recorder();
    const publish = sweeper.trackPublish(rec.sink);
    const run = runner.start({ loopId: "loop-1", message: "go", brain: slow });
    runner.subscribe(run.id, (e) => publish(run.id, e));
    await tick();
    sweeper.sweep(); // grace registered
    clockCtl.advance(50_000);
    openGate(); // progress inside the window
    await tick();
    clockCtl.advance(50_000); // 50s since the last event — inside the window
    assert.deepEqual(sweeper.sweep(), []);
    assert.equal(runner.getRun(run.id).status, "complete", "the run finished normally");
  });

  it("never marks parked (awaitingInput) runs — user-time silence is by design", async () => {
    const runner = new Runner();
    const clockCtl = clock();
    const sweeper = createRunSweeper({ runner, staleAfterMs: 1_000, now: clockCtl.now });
    const run = runner.start({
      loopId: "loop-1",
      message: "go",
      brain: new ScriptBrain([[{ kind: "elicitation", elicitationKind: "auth", prompt: "connect X" }]]),
    });
    await runner.whenIdle(run.id);
    assert.equal(runner.getRun(run.id).status, "awaitingInput");
    clockCtl.advance(3_600_000); // an hour of user silence
    assert.deepEqual(sweeper.sweep(), []);
    assert.equal(runner.getRun(run.id).status, "awaitingInput");
  });

  it("a revive resets the clock: the new exchange is not instantly re-marked", async () => {
    const hung: Brain = {
      async *stream(): AsyncIterable<Part> {
        yield { kind: "thought", text: "partial" };
        await new Promise<void>(() => {});
      },
    };
    const runner = new Runner();
    const clockCtl = clock();
    const sweeper = createRunSweeper({ runner, staleAfterMs: 60_000, now: clockCtl.now });
    const rec = recorder();
    const publish = sweeper.trackPublish(rec.sink);
    const run = runner.start({ loopId: "loop-1", message: "go", brain: hung });
    runner.subscribe(run.id, (e) => publish(run.id, e));
    await tick();
    sweeper.sweep(); // grace
    clockCtl.advance(61_000);
    assert.deepEqual(sweeper.sweep(), [run.id]);
    // Revive; the new exchange streams promptly and must not be re-marked.
    runner.continueRun(run.id, "retry", new ScriptBrain([[{ kind: "response", text: "recovered" }]]));
    await runner.whenIdle(run.id);
    assert.equal(runner.getRun(run.id).status, "complete");
    assert.deepEqual(sweeper.sweep(), []);
  });

  it("a run that finishes between the live-scan and markStale simply wins the race", async () => {
    const runner = new Runner();
    const clockCtl = clock();
    // A sabotaged runner double: activeRunIds reports a run that is terminal by markStale time.
    const run = runner.start({
      loopId: "loop-1",
      message: "go",
      brain: new ScriptBrain([[{ kind: "response", text: "instant" }]]),
    });
    await runner.whenIdle(run.id); // complete
    const sweeper = createRunSweeper({ runner, staleAfterMs: 0, now: clockCtl.now });
    assert.deepEqual(sweeper.sweep(), [], "complete runs are never swept");
    assert.equal(runner.getRun(run.id).status, "complete");
  });
});
