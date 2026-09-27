/**
 * Core runtime types — the records the loops server persists and streams.
 *
 * Behavior reference: SPECS/agent.md §runtime-contract, SPECS/loops.md
 * §run-view. Vocabulary verified against Linear 1.32.4 (KNOWLEDGE.md §3, §5).
 * Original code.
 *
 * Layering: run/turn STATUS vocabulary lives in `src/model` (enums.ts) so the
 * engine (R4), UI (R7/R8), and transport (R9) share one definition; this
 * package owns the runtime-only shapes (Part contents, events, snapshots).
 * When T-202's conversation types land in src/model, the mappings in
 * conversation-map.ts translate these records — these types stay canonical
 * for the runtime.
 */

import type { ElicitationKind, LoopEventEntity, RunStatus, TurnRole } from "../model/enums.ts";
import type { EntityId, ISODateTime } from "../model/loop.ts";
import type { ActivityPartContent, PendingElicitation, TurnStatus } from "../model/conversation.ts";

export type { RunStatus, TurnRole } from "../model/enums.ts";
export type { EntityId, ISODateTime } from "../model/loop.ts";
export { TURN_STATUSES } from "../model/conversation.ts";
export type { ActivityPartContent, TurnStatus } from "../model/conversation.ts";

/**
 * A halt signal issued on a run (T-504 — the official
 * `AgentActivitySignal.stop` semantics: halt immediately, then the run lands
 * in a terminal state; partial parts are kept, never rolled back). Recorded
 * on the run so the golden-goose adapter can surface it as a `stop`-signal
 * activity. IN-MEMORY ONLY for now — carrying it through snapshot/store
 * rows rides the M6 restart story (agent-06@gen5's #106 review note).
 */
export interface StopSignal {
  at: ISODateTime;
  /** `user` = the person asked to halt (cancel); `system` = the sweeper/server. */
  source: "user" | "system";
}

/** Omit that distributes over a union (plain Omit collapses to common keys). */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** The entity a run acts on (the loop's trigger target), if any. */
export interface RunTarget {
  entity: LoopEventEntity;
  id: EntityId;
  /** Human label for the run view header (issue identifier, project name…). */
  label?: string | undefined;
}

/** Token/cost accounting for one run, filled from the brain's usage reports. */
export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/**
 * One activity inside a turn — the unit the run view renders and the T3
 * channel streams. The canonical definition lives in
 * `src/model/conversation.ts` (ActivityPartContent); `Part` is the runtime's
 * local alias, so the model, the runtime, and the golden-goose adapter never
 * drift (conversation-map.ts carries the compile-time guard).
 *
 * - `thought`      — the brain's reasoning text.
 * - `action`       — a tool call: what tool, a display label, compact arg and
 *                    result summaries (never full payloads — those live server-side).
 * - `response`     — assistant message text shown to the user.
 * - `elicitation`  — the brain asks the user; ends its stream and parks the run
 *                    in `awaitingInput` until `Runner.respond`.
 * - `error`        — a failure detail surfaced inline.
 * - `steered`      — a user-authored message injected into the run (steer while
 *                    active, elicitation answer, or a continuation follow-up).
 */
export type Part = ActivityPartContent;

export type PartKind = Part["kind"];

/** Lifecycle of one turn. Turns don't pause — a paused RUN (awaitingInput)
 * closes its current turn first. (Definition: src/model/conversation.ts,
 * re-exported above.) */

export interface Turn {
  id: EntityId;
  runId: EntityId;
  /** 0-based, monotonic within the run. */
  position: number;
  role: TurnRole;
  parts: Part[];
  status: TurnStatus;
  startedAt: ISODateTime;
  endedAt?: ISODateTime | undefined;
}

/**
 * A run = one execution of a loop (Linear's equivalent: an AiConversation
 * with initialSource "workflow" joined by a LoopExecution — KNOWLEDGE §3).
 *
 * Lifecycle (run-machine.ts owns the transitions):
 *
 *   pending → waiting → active ⇄ awaitingInput → complete | error | canceled | stale
 *
 * `complete` is continuable: a user follow-up re-activates the same run with
 * its full turn history (SPECS/agent.md §continuation). `stale` (T-504) is
 * the unresponsive terminal: a sweeper marks a run whose runner went silent,
 * and `stale → active` revives it if the runner reappears.
 */
export interface Run {
  id: EntityId;
  loopId: EntityId;
  target?: RunTarget | undefined;
  status: RunStatus;
  /** Which firing of the loop this is (1-based, engine-assigned). */
  iteration: number;
  createdAt: ISODateTime;
  startedAt?: ISODateTime | undefined;
  endedAt?: ISODateTime | undefined;
  /** Short outcome text for the runs list (set on completion). */
  summary?: string | undefined;
  usage: RunUsage;
  /** Failure detail when status is `error`. */
  error?: string | undefined;
  /** Set when a stop signal drove this run to its terminal state (T-504). */
  stopSignal?: StopSignal | undefined;
  /** The elicitation the run is parked on (only in `awaitingInput`). */
  pendingElicitation?: PendingElicitation | undefined;
  /** Link to the persisted conversation record (server-side, T-202). */
  conversationId?: EntityId | undefined;
}

/**
 * One event on a run's stream. `seq` is per-run, gapless, 1-based — the T3
 * channel (R9) replays from it after a reconnect (`sinceSeq`).
 */
export type RunEvent =
  | { seq: number; runId: EntityId; at: ISODateTime; type: "runStatus"; status: RunStatus; run: Run }
  | { seq: number; runId: EntityId; at: ISODateTime; type: "turnStarted"; turn: Turn }
  | { seq: number; runId: EntityId; at: ISODateTime; type: "partAppended"; turnId: EntityId; part: Part }
  | { seq: number; runId: EntityId; at: ISODateTime; type: "turnCompleted"; turnId: EntityId; status: TurnStatus }
  | { seq: number; runId: EntityId; at: ISODateTime; type: "usage"; usage: RunUsage };

export type RunEventType = RunEvent["type"];
