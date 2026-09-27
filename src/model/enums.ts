/**
 * Domain enums for the loops system.
 *
 * String-literal unions (not TS `enum`) so values cross the JSON-RPC transport
 * (src/connect) and SQLite storage with no mapping layer. Each `as const` array
 * is the runtime source of truth; the zod schemas in loop-config.ts derive
 * their allowed values from these arrays, so a new value is added in exactly
 * one place.
 *
 * Behavior reference: SPECS/loops.md (trigger model) and SPECS/agent.md
 * (run/conversation lifecycle). Vocabulary verified against Linear 1.32.4
 * (KNOWLEDGE.md §3, §5). This file is original code.
 */

/** How a loop is woken up. Behavior: SPECS/loops.md §trigger-model. */
export const LOOP_TRIGGER_TYPES = ["schedule", "chat", "event"] as const;
export type LoopTriggerType = (typeof LOOP_TRIGGER_TYPES)[number];

/**
 * For event triggers: whether the loop fires when membership of the target
 * collection changes (e.g. an issue is added to a project) or when a watched
 * property on the entity itself changes value.
 */
export const LOOP_ACTIVATION_MODES = [
  "collectionChanged",
  "watchedPropertyChanged",
] as const;
export type LoopActivationMode = (typeof LOOP_ACTIVATION_MODES)[number];

/**
 * Entity families an event trigger can listen to. A loop run's target
 * (LoopExecution.target) is always one of these.
 */
export const LOOP_EVENT_ENTITIES = [
  "issue",
  "project",
  "initiative",
  "document",
  "comment",
  "team",
  "cycle",
  "release",
] as const;
export type LoopEventEntity = (typeof LOOP_EVENT_ENTITIES)[number];

/**
 * Built-in event kinds, v1. `inTriage` is the triage variant and is only
 * meaningful for issues (enforced by the loop-config schema).
 * Deliberately small; extend as the dataplane (R3) proves new event sources.
 */
export const LOOP_EVENT_KINDS = ["created", "updated", "inTriage"] as const;
export type LoopEventKind = (typeof LOOP_EVENT_KINDS)[number];

/** Direction of membership change for a `collectionChange` condition. */
export const COLLECTION_CHANGE_OPERATIONS = [
  "added",
  "removed",
  "addedOrRemoved",
] as const;
export type CollectionChangeOperation =
  (typeof COLLECTION_CHANGE_OPERATIONS)[number];

/**
 * Where a conversation (the dialogue behind a run) originated.
 * `workflow` marks a loop run. The full vocabulary is kept so run records
 * stay self-describing, but only `workflow`, `directChat`, `entityChat`,
 * `comment`, and `subAgent` are reachable in v1.
 */
export const CONVERSATION_SOURCES = [
  "workflow",
  "directChat",
  "entityChat",
  "comment",
  "pullRequestComment",
  "slack",
  "microsoftTeams",
  "mcp",
  "onboarding",
  "subAgent",
] as const;
export type ConversationSource = (typeof CONVERSATION_SOURCES)[number];

/**
 * Run lifecycle (SPECS/agent.md §runtime-contract):
 *
 *   pending → waiting → active ⇄ awaitingInput → complete | error | canceled
 *
 * `pending`  = created, not yet picked up.
 * `waiting`  = held by the run queue (per-loop concurrency or budget, R4).
 * `active`   = brain is streaming.
 * `awaitingInput` = parked on an elicitation until the user answers.
 * Terminal: `complete`, `error`, `canceled`, `stale`. Cancel is cooperative:
 * the brain stream is aborted and partial turns are kept (the user's `stop`
 * signal — T-504). `stale` (T-504) = unresponsive: the run was live but its
 * runner/brain stopped reporting without reaching a terminal signal; a
 * sweeper marks it, and it can revive (`stale → active`) when the runner
 * reappears — mirroring Linear, where fresh activity on a stale session
 * derives it back to active (official AgentSessionStatus parity,
 * extracts/linear-official/AGENT-API.md).
 */
export const RUN_STATUSES = [
  "pending",
  "waiting",
  "active",
  "awaitingInput",
  "complete",
  "error",
  "canceled",
  "stale",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Who authored a turn inside a run's conversation. */
export const TURN_ROLES = ["user", "agent", "system"] as const;
export type TurnRole = (typeof TURN_ROLES)[number];

/**
 * Kinds of activity parts streamed inside a turn (SPECS/agent.md):
 * `thought` = reasoning, `action` = tool call, `response` = assistant message,
 * `elicitation` = question to the user, `error` = failure detail,
 * `steered` = user message injected into an active run.
 */
export const ACTIVITY_PART_KINDS = [
  "thought",
  "action",
  "response",
  "elicitation",
  "error",
  "steered",
] as const;
export type ActivityPartKind = (typeof ACTIVITY_PART_KINDS)[number];

/**
 * Elicitation = the agent asks the user; the run parks in `awaitingInput`.
 * `freeText` = open answer, `auth` = connect an account, `select` = pick one
 * of the offered choices.
 */
export const ELICITATION_KINDS = ["freeText", "auth", "select"] as const;
export type ElicitationKind = (typeof ELICITATION_KINDS)[number];

/**
 * What a loop is allowed to DO to Linear when it runs — its write
 * capabilities. Gates the dataplane write ops (R3) and the approval rail
 * (SPECS/target-architecture.md §safety-rails). The v1 set matches the write
 * ops the dataplane ships; extend it when new writes land.
 */
export const LOOP_ACTIVITIES = ["comment", "issueUpdate", "stateChange"] as const;
export type LoopActivity = (typeof LOOP_ACTIVITIES)[number];

/**
 * Code access a run may use (SPECS/loops.md §settings-surfaces):
 * `none` = no code tooling, `read` = read via the code index,
 * `write` = coding sessions may also write.
 */
export const CODE_ACCESS_LEVELS = ["none", "read", "write"] as const;
export type CodeAccessLevel = (typeof CODE_ACCESS_LEVELS)[number];

/** Who may edit a loop's draft. v1 simplification; per-user ACLs are a non-goal. */
export const LOOP_EDIT_ACCESS = ["owner", "team", "organization"] as const;
export type LoopEditAccess = (typeof LOOP_EDIT_ACCESS)[number];

/** Comparison operators for a `propertyFilter` condition. */
export const PROPERTY_FILTER_OPS = ["eq", "neq", "in", "contains"] as const;
export type PropertyFilterOp = (typeof PROPERTY_FILTER_OPS)[number];
