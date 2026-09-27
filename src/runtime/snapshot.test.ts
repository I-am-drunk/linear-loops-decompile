/**
 * Tests for run snapshots: round-trip fidelity, interrupted mid-exchange
 * resume, parked-run resume, junk rejection. Zero-dep.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ScriptBrain } from "./brain.ts";
import { Runner } from "./runner.ts";
import { fromSnapshot, SnapshotError, toSnapshot } from "./snapshot.ts";

function deps() {
  let tick = 0;
  let id = 0;
  return {
    now: () => new Date(Date.UTC(2026, 8, 26, 23, 30, tick++)),
    idgen: () => `id-${id++}`,
  };
}

describe("snapshots", () => {
  it("round-trips a complete run and continues it after restore", async () => {
    const brain = new ScriptBrain([
      [{ kind: "response", text: "first" }],
      [{ kind: "response", text: "second" }],
    ]);
    const runnerA = new Runner(deps());
    const run = runnerA.start({ loopId: "loop-1", message: "q1", brain });
    await runnerA.whenIdle(run.id);
    const snap = toSnapshot(runnerA.getRun(run.id), runnerA.getTurns(run.id), "2026-09-26T23:45:00.000Z");
    const json = JSON.parse(JSON.stringify(snap)) as unknown; // prove JSON-safety

    // New process: fresh Runner, restore, continue.
    const runnerB = new Runner(deps());
    const restored = runnerB.restore(json as never);
    assert.equal(restored.status, "complete");
    assert.equal(runnerB.getTurns(run.id).length, 1);
    runnerB.continueRun(run.id, "follow-up", brain);
    const done = await runnerB.whenIdle(run.id);
    assert.equal(done.status, "complete");
    assert.deepEqual(
      runnerB.getTurns(run.id).map((t) => t.role),
      ["agent", "user", "agent"],
    );
  });

  it("restores a parked run still parked, and respond drives it on", async () => {
    const runnerA = new Runner(deps());
    const brainA = new ScriptBrain([
      [{ kind: "elicitation", elicitationKind: "freeText", prompt: "name?" }],
    ]);
    const run = runnerA.start({ loopId: "loop-1", message: "go", brain: brainA });
    const parked = await runnerA.whenIdle(run.id);
    assert.equal(parked.status, "awaitingInput");
    const snap = JSON.parse(JSON.stringify(toSnapshot(parked, runnerA.getTurns(run.id), "2026-09-26T23:46:00.000Z"))) as never;

    const runnerB = new Runner(deps());
    const restored = runnerB.restore(snap);
    assert.equal(restored.status, "awaitingInput");
    assert.equal(restored.pendingElicitation?.prompt, "name?");
    const brainB = new ScriptBrain([[{ kind: "response", text: "hello agent-03" }]]);
    runnerB.respond(run.id, "agent-03", brainB);
    const done = await runnerB.whenIdle(run.id);
    assert.equal(done.status, "complete");
    assert.equal(brainB.seen[0]!.message, "agent-03");
    assert.equal(brainB.seen[0]!.history.length, 2, "history survived the restore");
  });

  it("restores a mid-exchange (active) snapshot as retryable error: interrupted", async () => {
    // Simulate: server snapshotted while a run was mid-stream.
    const runnerA = new Runner(deps());
    const brain = new ScriptBrain([[{ kind: "thought", text: "partial" }]]);
    const run = runnerA.start({ loopId: "loop-1", message: "go", brain });
    await runnerA.whenIdle(run.id);
    // Forge the mid-exchange state: take the completed run but flip to active
    // with a streaming turn, as a snapshot taken mid-exchange would look.
    const snap = toSnapshot(
      { ...runnerA.getRun(run.id), status: "active", endedAt: undefined },
      runnerA.getTurns(run.id).map((t) => ({ ...t, status: "streaming" as const, endedAt: undefined })),
      "2026-09-26T23:47:00.000Z",
    );
    const { run: restoredRun, turns } = fromSnapshot(JSON.parse(JSON.stringify(snap)));
    assert.equal(restoredRun.status, "error");
    assert.equal(restoredRun.error, "interrupted");
    assert.equal(restoredRun.endedAt, "2026-09-26T23:47:00.000Z");
    assert.equal(turns[0]!.status, "error");
    assert.equal(turns[0]!.endedAt, "2026-09-26T23:47:00.000Z");
  });

  it("rejects junk snapshots with SnapshotError", () => {
    for (const junk of [null, 42, [], {}, { version: 99 }, { version: 1, savedAt: "x" }]) {
      assert.throws(() => fromSnapshot(junk), SnapshotError, JSON.stringify(junk));
    }
  });

  it("rejects an awaitingInput snapshot without its pendingElicitation", () => {
    const snap = {
      version: 1,
      savedAt: "2026-09-26T23:48:00.000Z",
      run: {
        id: "r", loopId: "l", status: "awaitingInput", iteration: 1,
        createdAt: "x", startedAt: "y", usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      },
      turns: [],
    };
    assert.throws(() => fromSnapshot(snap), SnapshotError);
  });
});
