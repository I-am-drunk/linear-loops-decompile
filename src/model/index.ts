/**
 * @loops/model — domain types + validation for the loops system.
 * Consumers: dataplane (R3), engine (R4), runtime (R5), inference (R6),
 * UI (R7/R8), connect (R9).
 */

export {
  ACTIVITY_PART_KINDS,
  CODE_ACCESS_LEVELS,
  COLLECTION_CHANGE_OPERATIONS,
  CONVERSATION_SOURCES,
  ELICITATION_KINDS,
  LOOP_ACTIVATION_MODES,
  LOOP_ACTIVITIES,
  LOOP_EDIT_ACCESS,
  LOOP_EVENT_ENTITIES,
  LOOP_EVENT_KINDS,
  LOOP_TRIGGER_TYPES,
  PROPERTY_FILTER_OPS,
  RUN_STATUSES,
  TURN_ROLES,
} from "./enums.ts";
export type {
  ActivityPartKind,
  CodeAccessLevel,
  CollectionChangeOperation,
  ConversationSource,
  ElicitationKind,
  LoopActivationMode,
  LoopActivity,
  LoopEditAccess,
  LoopEventEntity,
  LoopEventKind,
  LoopTriggerType,
  PropertyFilterOp,
  RunStatus,
  TurnRole,
} from "./enums.ts";

export { DEFAULT_LOOP_SCHEDULE } from "./loop.ts";
export type {
  EntityId,
  ISODateTime,
  LoopCondition,
  LoopConfig,
  LoopEvent,
  LoopExecution,
  LoopRunTarget,
  LoopSchedule,
  LoopStats,
  LoopTrigger,
  PromptContent,
  WorkflowCronJobDefinition,
  WorkflowDefinition,
  WorkflowDefinitionDraft,
} from "./loop.ts";

export {
  defaultLoopConfig,
  loopConditionSchema,
  loopConfigSchema,
  loopScheduleSchema,
  loopTriggerSchema,
  parseLoopConfig,
  promptContentSchema,
} from "./loop-config.ts";
export type {
  LoopConfigInput,
  LoopConfigParsed,
  ParseLoopConfigResult,
} from "./loop-config.ts";

// T-202: conversation + agent-session types (canonical part content lives here;
// src/runtime aliases it — see conversation-map.ts's assignability guard).
export { AGENT_SESSION_STATUSES, TURN_STATUSES } from "./conversation.ts";
export type {
  ActivityPartContent,
  AgentActivity,
  AgentSession,
  AgentSessionStatus,
  AiConversation,
  AiConversationTurn,
  ModelSelection,
  PendingElicitation,
  TurnStatus,
} from "./conversation.ts";
