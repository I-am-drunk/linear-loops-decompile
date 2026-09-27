/**
 * Tests for the run state machine (pure transition table + invariants).
 * Zero-dep: node --experimental-strip-types --test.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertRunInvariants,
  canTransitionRunStatus,
  IllegalRunTransitionError,
  isTerminalStatus,
  transitionRun,
} from "./run-machine.ts";
import type { Run } from "./types.ts";

const T0 = "2026-09-26T23:00:00.000Z";
const T1 = "2026-09-26T23:00:01.000Z";
const T2 = "2026-09-26T23:00:02.000Z";
const T3 = "2026-09-26T23:00:03.000Z";

function makeRun(status: Run["status"] = "pending"): Run {
  return {
    id: "run-1",
    loopId: "loop-1",
    status,
    iteration: 1,
    createdAt: T0,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  };
}

describe("transition table", () => {
  it("walks the happy path pending → waiting → active → awaitingInput → active → complete", () => {
    let run = makeRun();
    run = transitionRun(run, "waiting", T0);
    run = transitionRun(run, "active", T1);
    assert.equal(run.startedAt, T1, "startedAt set on first activation");
    run = transitionRun(run, "awaitingInput", T2, {
      pendingElicitation: { kind: "elicitation", elicitationKind: "freeText", prompt: "?" },
    });
    assert.equal(run.endedAt, undefined, "parked is not ended");
    assertRunInvariants(run);
    run = transitionRun(run, "active", T2, { pendingElicitation: undefined });
    assert.equal(run.startedAt, T1, "startedAt survives re-activation");
    run = transitionRun(run, "complete", T3);
    assert.equal(run.endedAt, T3, "endedAt set on terminal");
    assertRunInvariants(run);
  });

  it("allows the steer-drain self-transition active → active", () => {
    assert.equal(canTransitionRunStatus("active", "active"), true);
  });

  it("allows continuation complete → active and clears endedAt", () => {
    let run = makeRun();
    run = transitionRun(run, "active", T1);
    run = transitionRun(run, "complete", T2);
    run = transitionRun(run, "active", T3);
    assert.equal(run.endedAt, undefined);
    assert.equal(run.startedAt, T1);
    assertRunInvariants(run);
  });

  it("allows cancel from every non-terminal state", () => {
    for (const from of ["pending", "waiting", "active", "awaitingInput"] as const) {
      assert.equal(canTransitionRunStatus(from, "canceled"), true, `${from} → canceled`);
    }
  });

  it("allows stale from every non-terminal state (T-504)", () => {
    for (const from of ["pending", "waiting", "active", "awaitingInput"] as const) {
      assert.equal(canTransitionRunStatus(from, "stale"), true, `${from} → stale`);
    }
  });

  it("stale is terminal: sets endedAt and clears a parked elicitation", () => {
    let run = makeRun("active");
    run = transitionRun(run, "awaitingInput", T1, {
      pendingElicitation: { kind: "elicitation", elicitationKind: "freeText", prompt: "?" },
    });
    run = transitionRun(run, "stale", T2);
    assert.equal(run.endedAt, T2, "endedAt set on the unresponsive terminal");
    assert.equal(run.pendingElicitation, undefined, "a parked elicitation cannot outlive its run");
    assert.equal(isTerminalStatus("stale"), true);
    assertRunInvariants(run);
  });

  it("revives stale → active: endedAt cleared, startedAt kept (T-504)", () => {
    let run = makeRun();
    run = transitionRun(run, "active", T1);
    run = transitionRun(run, "stale", T2);
    run = transitionRun(run, "active", T3);
    assert.equal(run.endedAt, undefined);
    assert.equal(run.startedAt, T1, "the original start survives the revive");
    assertRunInvariants(run);
  });

  it("rejects illegal edges", () => {
    const illegal: [Run["status"], Run["status"]][] = [
      ["pending", "complete"],
      ["pending", "awaitingInput"],
      ["waiting", "complete"],
      ["awaitingInput", "complete"],
      ["complete", "waiting"],
      ["error", "active"],
      ["canceled", "active"],
      ["canceled", "pending"],
      ["stale", "complete"],
      ["stale", "canceled"],
      ["stale", "waiting"],
      ["complete", "stale"],
      ["error", "stale"],
      ["canceled", "stale"],
    ];
    for (const [from, to] of illegal) {
      assert.equal(canTransitionRunStatus(from, to), false, `${from} → ${to}`);
      assert.throws(() => transitionRun(makeRun(from), to, T1), IllegalRunTransitionError);
    }
  });

  it("clears a parked elicitation when the run is canceled", () => {
    let run = makeRun("active");
    run = transitionRun(run, "awaitingInput", T1, {
      pendingElicitation: { kind: "elicitation", elicitationKind: "select", prompt: "pick", choices: ["a", "b"] },
    });
    run = transitionRun(run, "canceled", T2);
    assert.equal(run.pendingElicitation, undefined);
    assertRunInvariants(run);
  });

  it("records the error detail on the error transition", () => {
    let run = makeRun("active");
    run = transitionRun(run, "error", T1, { error: "brain exploded" });
    assert.equal(run.error, "brain exploded");
    assert.equal(isTerminalStatus(run.status), true);
  });
});
