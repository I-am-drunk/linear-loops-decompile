/**
 * The run state machine — a pure transition table, deliberately separated
 * from the Runner so the rules are auditable in one place.
 *
 * Behavior (SPECS/agent.md §runtime-contract):
 *
 *   pending → waiting → active ⇄ awaitingInput → complete | error | canceled
 *
 * Rules worth naming:
 * - `waiting` is the run queue's hold state (per-loop concurrency/budgets,
 *   R4); only the queue moves a run into or out of it.
 * - `active → active` is a legal self-transition: a steer drained between
 *   brain streams keeps the run active, so subscribers never see a
 *   complete→active flicker.
 * - `complete → active` is the continuation edge: a user follow-up on a
 *   finished run re-activates it with its full history.
 * - `canceled` and `error` are terminal. Cancel is cooperative — the brain's
 *   stream is aborted and partial turns are kept, not rolled back.
 *
 * Timestamp invariants (checked by assertRunInvariants):
 * - `startedAt` is set exactly when a run first becomes `active`.
 * - `endedAt` is set on entering a terminal status, and cleared if a
 *   continuation re-activates the run.
 *
 * Original code.
 */

import type { RunStatus } from "../model/enums.ts";
import type { ISODateTime } from "../model/loop.ts";
import type { Run } from "./types.ts";

const TERMINAL: ReadonlySet<RunStatus> = new Set(["complete", "error", "canceled"]);

/** The whole legal-transition table. Read: row → set of legal next states. */
const TRANSITIONS: Readonly<Record<RunStatus, ReadonlySet<RunStatus>>> = {
  pending: new Set(["waiting", "active", "canceled"]),
  waiting: new Set(["active", "canceled"]),
  active: new Set(["active", "awaitingInput", "complete", "error", "canceled"]),
  awaitingInput: new Set(["active", "canceled"]),
  complete: new Set(["active"]), // continuation
  error: new Set(),
  canceled: new Set(),
};

export function isTerminalStatus(status: RunStatus): boolean {
  return TERMINAL.has(status);
}

/** Is `from → to` a legal run transition? Pure; no side effects. */
export function canTransitionRunStatus(from: RunStatus, to: RunStatus): boolean {
  return TRANSITIONS[from].has(to);
}

export class IllegalRunTransitionError extends Error {
  readonly from: RunStatus;
  readonly to: RunStatus;
  constructor(from: RunStatus, to: RunStatus) {
    super(`illegal run transition: ${from} → ${to}`);
    this.name = "IllegalRunTransitionError";
    this.from = from;
    this.to = to;
  }
}

/**
 * Move a run to a new status, maintaining the timestamp invariants.
 * Returns a NEW Run object (callers treat runs as immutable snapshots —
 * the Runner emits the new snapshot with its `runStatus` event).
 *
 * `patch` folds extra fields into the same transition (e.g. `error` when
 * failing, `pendingElicitation` when parking).
 *
 * Throws IllegalRunTransitionError on an illegal edge.
 */
export function transitionRun(
  run: Run,
  to: RunStatus,
  at: ISODateTime,
  patch?: Partial<Pick<Run, "error" | "summary" | "pendingElicitation">>,
): Run {
  if (!canTransitionRunStatus(run.status, to)) {
    throw new IllegalRunTransitionError(run.status, to);
  }
  const next: Run = { ...run, status: to, ...patch };
  if (to === "active" && next.startedAt === undefined) {
    next.startedAt = at;
  }
  if (TERMINAL.has(to)) {
    next.endedAt = at;
    // A parked elicitation cannot outlive its run.
    if (to !== "awaitingInput") next.pendingElicitation = undefined;
  }
  if (to === "active") {
    // Continuation or resume: the run is live again; a parked elicitation is
    // cleared only via an explicit patch.
    next.endedAt = undefined;
  }
  return next;
}

/**
 * Development-time invariant check. Cheap enough to run in tests for every
 * produced run; the server may call it before persisting.
 */
export function assertRunInvariants(run: Run): void {
  const wasActive =
    run.status === "active" ||
    run.status === "awaitingInput" ||
    run.startedAt !== undefined;
  if (wasActive && run.startedAt === undefined) {
    throw new Error(`run ${run.id}: active-phase run has no startedAt`);
  }
  if (TERMINAL.has(run.status) && run.endedAt === undefined) {
    throw new Error(`run ${run.id}: terminal status ${run.status} has no endedAt`);
  }
  if (!TERMINAL.has(run.status) && run.endedAt !== undefined && run.status !== "active") {
    throw new Error(`run ${run.id}: non-terminal status ${run.status} carries endedAt`);
  }
  if (run.status !== "awaitingInput" && run.pendingElicitation !== undefined) {
    throw new Error(`run ${run.id}: pendingElicitation outside awaitingInput`);
  }
  if (run.startedAt !== undefined && run.createdAt > run.startedAt) {
    throw new Error(`run ${run.id}: startedAt precedes createdAt`);
  }
  if (run.endedAt !== undefined && run.startedAt !== undefined && run.endedAt < run.startedAt) {
    throw new Error(`run ${run.id}: endedAt precedes startedAt`);
  }
}
