/**
 * Tests for the Runner: streaming, elicitation pause/resume, steer-drain,
 * cooperative cancel with partial parts, continuation, error surface, and
 * subscriber replay. Zero-dep: node --experimental-strip-types --test.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ScriptBrain } from "./brain.ts";
import type { Brain, BrainInput } from "./brain.ts";
import { Runner, RunBusyError, RunNotFoundError } from "./runner.ts";
import { IllegalRunTransitionError } from "./run-machine.ts";
import type { Part, RunEvent } from "./types.ts";

/** Deterministic clock/id factory per test. */
function deps() {
  let tick = 0;
  let id = 0;
  return {
    now: () => new Date(Date.UTC(2026, 8, 26, 23, 0, tick++)),
    idgen: () => `id-${id++}`,
  };
}

/** Collects every event for assertions. */
function recorder(runner: Runner, runId: string) {
  const events: RunEvent[] = [];
  runner.subscribe(runId, (e) => events.push(e));
  return events;
}

function statuses(events: RunEvent[]): string[] {
  return events.filter((e) => e.type === "runStatus").map((e) => (e as Extract<RunEvent, { type: "runStatus" }>).status);
}

describe("Runner", () => {
  it("runs a happy-path exchange to complete with ordered, gapless events", async () => {
    const brain = new ScriptBrain([[{ kind: "thought", text: "hmm" }, { kind: "response", text: "done" }]]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "do the thing", brain });
    const events = recorder(runner, run.id);
    const final = await runner.whenIdle(run.id);
    assert.equal(final.status, "complete");
    assert.deepEqual(statuses(events), ["pending", "active", "complete"]);
    const seqs = events.map((e) => e.seq);
    assert.deepEqual(seqs, [...Array(seqs.length).keys()].map((i) => i + 1), "gapless 1-based seq");
    const turns = runner.getTurns(run.id);
    assert.equal(turns.length, 1);
    assert.equal(turns[0]!.role, "agent");
    assert.deepEqual(turns[0]!.parts.map((p) => p.kind), ["thought", "response"]);
    assert.equal(turns[0]!.status, "complete");
  });

  it("parks on elicitation and resumes on respond", async () => {
    const brain = new ScriptBrain([
      [{ kind: "elicitation", elicitationKind: "select", prompt: "which?", choices: ["a", "b"] }],
      [{ kind: "response", text: "ok, b it is" }],
    ]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "start", brain });
    const parked = await runner.whenIdle(run.id);
    assert.equal(parked.status, "awaitingInput");
    assert.equal(parked.pendingElicitation?.prompt, "which?");
    runner.respond(run.id, "b");
    const done = await runner.whenIdle(run.id);
    assert.equal(done.status, "complete");
    const turns = runner.getTurns(run.id);
    assert.deepEqual(turns.map((t) => t.role), ["agent", "user", "agent"]);
    assert.deepEqual(turns[1]!.parts, [{ kind: "steered", text: "b" }]);
    // the brain saw the answer as the next exchange's message
    assert.equal(brain.seen[1]!.message, "b");
    assert.equal(brain.seen[1]!.history.length, 2, "history carried into the exchange");
  });

  it("drains a steer between exchanges without a complete flicker", async () => {
    // Brain waits on a gate so the test can steer mid-stream.
    let openGate!: () => void;
    const gate = new Promise<void>((r) => { openGate = r; });
    const seen: BrainInput[] = [];
    const brain: Brain = {
      async *stream(input: BrainInput, _signal: AbortSignal) {
        seen.push(input);
        yield { kind: "thought", text: `working on ${input.message}` };
        await gate;
        yield { kind: "response", text: "first pass done" };
      },
    };
    const runner = new Runner(deps());
    const events: RunEvent[] = [];
    const run = runner.start({ loopId: "loop-1", message: "build it", brain });
    runner.subscribe(run.id, (e) => events.push(e));
    runner.steer(run.id, "actually, also fix tests");
    openGate();
    const done = await runner.whenIdle(run.id);
    assert.equal(done.status, "complete");
    assert.deepEqual(statuses(events), ["pending", "active", "complete"], "no complete→active flicker");
    const userTurns = runner.getTurns(run.id).filter((t) => t.role === "user");
    assert.deepEqual(userTurns[0]!.parts, [{ kind: "steered", text: "actually, also fix tests" }]);
  });

  it("cancels mid-stream cooperatively and keeps partial parts", async () => {
    let openGate!: () => void;
    const gate = new Promise<void>((r) => { openGate = r; });
    const brain: Brain = {
      async *stream(_input: BrainInput, signal: AbortSignal) {
        yield { kind: "thought", text: "partial reasoning" };
        await gate;
        if (signal.aborted) return; // cooperative exit
        yield { kind: "response", text: "should never arrive" };
      },
    };
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    runner.cancel(run.id);
    openGate();
    const done = await runner.whenIdle(run.id);
    assert.equal(done.status, "canceled");
    const turns = runner.getTurns(run.id);
    assert.deepEqual(turns[0]!.parts, [{ kind: "thought", text: "partial reasoning" }], "partial kept");
  });

  it("cancels a parked (awaitingInput) run immediately", async () => {
    const brain = new ScriptBrain([
      [{ kind: "elicitation", elicitationKind: "auth", prompt: "connect X" }],
    ]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    await runner.whenIdle(run.id);
    runner.cancel(run.id);
    assert.equal(runner.getRun(run.id).status, "canceled");
  });

  it("records the user's stop signal on the canceled run (T-504)", async () => {
    const brain = new ScriptBrain([
      [{ kind: "elicitation", elicitationKind: "auth", prompt: "connect X" }],
    ]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    await runner.whenIdle(run.id);
    runner.cancel(run.id);
    const done = runner.getRun(run.id);
    assert.equal(done.status, "canceled");
    assert.equal(done.stopSignal?.source, "user");
    assert.equal(typeof done.stopSignal?.at, "string");
  });

  it("records the stop signal on a mid-stream cancel too (T-504)", async () => {
    let openGate!: () => void;
    const gate = new Promise<void>((r) => { openGate = r; });
    const brain: Brain = {
      async *stream(_input: BrainInput, signal: AbortSignal) {
        yield { kind: "thought", text: "partial reasoning" };
        await gate;
        if (signal.aborted) return;
        yield { kind: "response", text: "should never arrive" };
      },
    };
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    runner.cancel(run.id);
    openGate();
    const done = await runner.whenIdle(run.id);
    assert.equal(done.status, "canceled");
    assert.equal(done.stopSignal?.source, "user");
  });

  it("marks a parked run stale immediately (T-504)", async () => {
    const brain = new ScriptBrain([
      [{ kind: "elicitation", elicitationKind: "auth", prompt: "connect X" }],
    ]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    await runner.whenIdle(run.id);
    runner.markStale(run.id);
    const stale = runner.getRun(run.id);
    assert.equal(stale.status, "stale");
    assert.ok(stale.endedAt !== undefined, "stale is terminal: endedAt set");
    assert.equal(stale.pendingElicitation, undefined, "parked elicitation cleared");
    assert.equal(stale.stopSignal, undefined, "a sweeper halt is not a user stop");
  });

  it("markStale settles a HUNG brain immediately and fences late output (T-504)", async () => {
    let openGate!: () => void;
    const gate = new Promise<void>((r) => { openGate = r; });
    const brain: Brain = {
      async *stream(_input: BrainInput, _signal: AbortSignal) {
        yield { kind: "thought", text: "partial reasoning" };
        await gate; // the hung provider: wakes long after abort, ignoring it
        yield { kind: "response", text: "late output" }; // fenced on arrival
      },
    };
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    await new Promise((r) => setTimeout(r, 0)); // the first part lands on the run
    runner.markStale(run.id);
    // Settles NOW — never waiting on the brain that went silent.
    const stale = await runner.whenIdle(run.id);
    assert.equal(stale.status, "stale");
    assert.ok(stale.endedAt !== undefined);
    const turns = runner.getTurns(run.id);
    assert.equal(turns[0]!.status, "error", "dangling turn closed (interrupted rule)");
    assert.deepEqual(turns[0]!.parts, [{ kind: "thought", text: "partial reasoning" }], "partial kept");
    // The dead stream wakes later: fenced — nothing changes.
    openGate();
    await new Promise((r) => setTimeout(r, 10));
    const after = runner.getRun(run.id);
    assert.equal(after.status, "stale");
    assert.equal(runner.getTurns(run.id)[0]!.parts.length, 1, "late output never appended");
  });

  it("markStale inside a runStatus callback stops the drive before the brain starts (T-504)", async () => {
    let streamStarted = false;
    const parked = new ScriptBrain([
      [{ kind: "elicitation", elicitationKind: "auth", prompt: "connect X" }],
    ]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain: parked });
    await runner.whenIdle(run.id);
    const turnCount = runner.getTurns(run.id).length;
    let skippedReplay = false;
    runner.subscribe(run.id, (e) => {
      if (e.type === "runStatus" && e.status === "active") {
        // The subscription replays the first exchange's buffered active
        // event — only the LIVE one (from respond's drive) is the test target.
        if (!skippedReplay) { skippedReplay = true; return; }
        runner.markStale(run.id);
      }
    });
    const brain2: Brain = {
      async *stream(): AsyncIterable<Part> {
        streamStarted = true;
        yield { kind: "response", text: "should never stream" };
      },
    };
    runner.respond(run.id, "connected", brain2);
    await runner.whenIdle(run.id);
    assert.equal(runner.getRun(run.id).status, "stale");
    assert.equal(streamStarted, false, "no exchange starts for a dead run");
    const turns = runner.getTurns(run.id);
    assert.equal(turns.length, turnCount + 1, "only the user's answer turn is appended");
    assert.equal(turns[turns.length - 1]!.role, "user");
  });

  it("revives a stale run via continueRun with its full history (T-504)", async () => {
    const parked = new ScriptBrain([
      [{ kind: "elicitation", elicitationKind: "auth", prompt: "connect X" }],
    ]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain: parked });
    await runner.whenIdle(run.id);
    const startedAt = runner.getRun(run.id).startedAt;
    runner.markStale(run.id);
    const events = recorder(runner, run.id);
    runner.continueRun(run.id, "retry the exchange", new ScriptBrain([[{ kind: "response", text: "recovered" }]]));
    const done = await runner.whenIdle(run.id);
    assert.equal(done.status, "complete");
    assert.equal(done.startedAt, startedAt, "the original start survives the revive");
    assert.ok(done.endedAt !== undefined, "re-terminated cleanly");
    assert.deepEqual(statuses(events).slice(-3), ["stale", "active", "complete"], "stale → active → complete");
    const turns = runner.getTurns(run.id);
    assert.equal(turns[turns.length - 1]!.parts[0]!.kind, "response");
  });

  it("refuses cancel/markStale on terminal runs, finished runs are never stale (T-504)", async () => {
    const brain = new ScriptBrain([[{ kind: "response", text: "done" }]]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    await runner.whenIdle(run.id);
    assert.equal(runner.getRun(run.id).status, "complete");
    assert.throws(() => runner.markStale(run.id), IllegalRunTransitionError);

    const brain2 = new ScriptBrain([
      [{ kind: "elicitation", elicitationKind: "auth", prompt: "connect X" }],
    ]);
    const run2 = runner.start({ loopId: "loop-1", message: "go", brain: brain2 });
    await runner.whenIdle(run2.id);
    runner.markStale(run2.id);
    assert.equal(runner.getRun(run2.id).status, "stale");
    assert.throws(() => runner.cancel(run2.id), IllegalRunTransitionError, "a stale run cannot be canceled");
    assert.throws(() => runner.markStale(run2.id), IllegalRunTransitionError, "stale is idempotent-terminal");
  });

  it("surfaces a brain throw as run error with the message", async () => {
    const brain: Brain = {
      async *stream(): AsyncIterable<Part> {
        yield { kind: "thought", text: "about to fail" };
        throw new Error("provider 500");
      },
    };
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    const done = await runner.whenIdle(run.id);
    assert.equal(done.status, "error");
    assert.match(done.error ?? "", /provider 500/);
    assert.equal(runner.getTurns(run.id)[0]!.status, "error");
  });

  it("continues a complete run with its full history", async () => {
    const brain = new ScriptBrain([
      [{ kind: "response", text: "first answer" }],
      [{ kind: "response", text: "second answer" }],
    ]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "q1", brain });
    await runner.whenIdle(run.id);
    runner.continueRun(run.id, "follow-up", brain);
    const done = await runner.whenIdle(run.id);
    assert.equal(done.status, "complete");
    assert.deepEqual(runner.getTurns(run.id).map((t) => t.role), ["agent", "user", "agent"]);
    assert.equal(brain.seen[1]!.message, "follow-up");
    assert.equal(brain.seen[1]!.history.length, 2);
  });

  it("rejects steer/respond/continue in the wrong state", async () => {
    const brain = new ScriptBrain([[{ kind: "response", text: "x" }]]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    await runner.whenIdle(run.id); // complete
    assert.throws(() => runner.steer(run.id, "late"), IllegalRunTransitionError);
    assert.throws(() => runner.respond(run.id, "late"), IllegalRunTransitionError);
    assert.throws(() => runner.cancel(run.id), IllegalRunTransitionError);
    assert.throws(() => runner.getRun("nope"), RunNotFoundError);
  });

  it("replays missed events to a late subscriber via sinceSeq", async () => {
    const brain = new ScriptBrain([[{ kind: "response", text: "hi" }]]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    await runner.whenIdle(run.id);
    const all = runner.getRun(run.id);
    assert.equal(all.status, "complete");
    const replayed: RunEvent[] = [];
    const unsub = runner.subscribe(run.id, (e) => replayed.push(e), 0);
    unsub();
    assert.ok(replayed.length >= 4, "runStatus+turnStarted+partAppended+turnCompleted+complete");
    assert.deepEqual(replayed.map((e) => e.seq), replayed.map((_, i) => i + 1));
    const tail: RunEvent[] = [];
    runner.subscribe(run.id, (e) => tail.push(e), replayed.length - 1);
    assert.equal(tail.length, 1, "only the events after sinceSeq");
  });

  it("accumulates usage reports", async () => {
    const brain = new ScriptBrain([[{ kind: "response", text: "hi" }]]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    runner.recordUsage(run.id, { inputTokens: 100, outputTokens: 20, costUsd: 0.001 });
    runner.recordUsage(run.id, { outputTokens: 5 });
    await runner.whenIdle(run.id);
    assert.deepEqual(runner.getRun(run.id).usage, { inputTokens: 100, outputTokens: 25, costUsd: 0.001 });
  });
});
