/**
 * @loops/runtime — the agent runtime (R5): run state machine, streaming
 * Runner, and the Brain seam that inference providers (R6) and the
 * golden-goose backends (#14) implement.
 *
 * Depends on @loops/model (../model) for status vocabulary; owns the
 * runtime-only shapes (Part contents, RunEvent, Turn).
 */

export {
  ACTIVITY_PART_KINDS,
  RUN_STATUSES,
  TURN_ROLES,
} from "../model/enums.ts";

export type { RunStatus, TurnRole } from "../model/enums.ts";

export {
  assertRunInvariants,
  canTransitionRunStatus,
  IllegalRunTransitionError,
  isTerminalStatus,
  transitionRun,
} from "./run-machine.ts";

export { Runner, RunBusyError, RunNotFoundError } from "./runner.ts";
export type { RunnerDeps, StartParams } from "./runner.ts";

export { ScriptBrain } from "./brain.ts";
export type { Brain, BrainInput } from "./brain.ts";

export { HarnessBrain, toChatMessages } from "./harness-brain.ts";
export type {
  ChatAdapterLike,
  HarnessBrainOptions,
  HarnessChatMessage,
  HarnessChatRole,
  HarnessStreamEvent,
  HarnessStreamRequest,
} from "./harness-brain.ts";

export { assembleContext, flattenPrompt } from "./context.ts";
export type { AssembleInput, AssembledContext, EntityContext, EntityReader } from "./context.ts";

export { fromSnapshot, SnapshotError, SNAPSHOT_VERSION, toSnapshot } from "./snapshot.ts";
export type { RunSnapshot } from "./snapshot.ts";

export { runToConversation, turnsToConversationTurns, turnToConversationTurn } from "./conversation-map.ts";

export { OFFICIAL_AGENT_SESSION_STATUSES, toOfficialAgentSessionStatus } from "./agent-session-status.ts";
export type { OfficialAgentSessionStatus } from "./agent-session-status.ts";

export { TURN_STATUSES } from "./types.ts";
export type {
  Part,
  PartKind,
  Run,
  RunEvent,
  RunEventType,
  RunTarget,
  RunUsage,
  StopSignal,
  Turn,
  TurnStatus,
} from "./types.ts";
