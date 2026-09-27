/**
 * Conversation + agent-session types — the persistence shapes for runs, and
 * the shared vocabulary the golden-goose adapter (issue #14) reuses when it
 * maps our runs onto Linear's agent surface.
 *
 * Behavior reference: SPECS/agent.md (AiConversation, AgentSession,
 * AgentActivity), KNOWLEDGE.md §3 (a loop run IS an AiConversation with
 * initialSource "workflow" + a LoopExecution join) and §5 (session harness
 * fields). This file is original code; field choices are behavior-driven,
 * not copied.
 *
 * Dedup rule (settled gen-1): this file is the ONE definition of part
 * contents and turn statuses. src/runtime aliases them — edit here, the
 * runtime follows; a compile-time guard in conversation-map.ts keeps the
 * two from drifting.
 */

import type {
  ConversationSource,
  ElicitationKind,
  RunStatus,
  TurnRole,
} from "./enums.ts";
import type { EntityId, ISODateTime } from "./loop.ts";

/**
 * Canonical activity-part content. The runtime's `Part` is an alias of this
 * union; Linear's AgentActivity content maps onto the same kinds.
 *
 * - `thought`      — reasoning text.
 * - `action`       — tool call: tool name, display label, compact summaries
 *                    (never full payloads).
 * - `response`     — assistant message to the user.
 * - `elicitation`  — question to the user; parks the run/session.
 * - `error`        — failure detail, inline.
 * - `steered`      — user-authored message injected into the conversation.
 */
export type ActivityPartContent =
  | { kind: "thought"; text: string }
  | {
      kind: "action";
      tool: string;
      label: string;
      argsSummary?: string | undefined;
      resultSummary?: string | undefined;
    }
  | { kind: "response"; text: string }
  | {
      kind: "elicitation";
      elicitationKind: ElicitationKind;
      prompt: string;
      choices?: string[] | undefined;
    }
  | { kind: "error"; message: string }
  | { kind: "steered"; text: string };

/** Turn lifecycle — shared by runtime turns and conversation turns. */
export const TURN_STATUSES = ["streaming", "complete", "error"] as const;
export type TurnStatus = (typeof TURN_STATUSES)[number];

/**
 * A conversation — the persisted dialogue behind a run (or a chat, later).
 * A loop RUN is a conversation with `initialSource: "workflow"` and
 * `isWorkflowRun: true` + the workflow linkage fields (KNOWLEDGE §3).
 */
export interface AiConversation {
  id: EntityId;
  /** Where the conversation came from; `workflow` = a loop run. */
  initialSource: ConversationSource;
  /** Mirrors the run's status vocabulary (one lifecycle, one enum). */
  status: RunStatus;
  /** Short outcome line shown in lists (set at completion). */
  summary?: string | undefined;
  /** The assembled context pack the first exchange answered (text). */
  context?: string | undefined;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  isWorkflowRun: boolean;
  /** Owning loop when isWorkflowRun (our WorkflowDefinition id). */
  workflowDefinitionId?: EntityId | undefined;
  /** Our `usageCalls` analog — token/cost counters for the run. */
  usage?: { inputTokens: number; outputTokens: number; costUsd: number } | undefined;
  /** Parent conversation for subAgent-spawned ones. */
  parentId?: EntityId | undefined;
}

export interface AiConversationTurn {
  id: EntityId;
  conversationId: EntityId;
  /** 0-based, monotonic within the conversation. */
  position: number;
  /** Set when this turn answers a specific earlier turn (elicitation flows). */
  responseToTurnId?: EntityId | undefined;
  role: TurnRole;
  status: TurnStatus;
  parts: ActivityPartContent[];
  /** Display name for non-user authors (agent persona, external user). */
  authorDisplayName?: string | undefined;
  startedAt: ISODateTime;
  endedAt?: ISODateTime | undefined;
}

/**
 * AgentSession statuses (SPECS/agent.md §5; canceled arrives externally).
 * `stale` added in T-504 for official parity: the official
 * `AgentSessionStatus` enum is { active, awaitingInput, complete, error,
 * pending, stale } (extracts/linear-official/AGENT-API.md), so every official
 * status is representable here; our extras (`waiting`, `canceled`) fold down
 * on export via src/runtime/agent-session-status.ts.
 */
export const AGENT_SESSION_STATUSES = [
  "pending",
  "active",
  "awaitingInput",
  "error",
  "complete",
  "waiting",
  "canceled",
  "stale",
] as const;
export type AgentSessionStatus = (typeof AGENT_SESSION_STATUSES)[number];

/** Which model a session runs — workspace default or a per-session override. */
export interface ModelSelection {
  kind: "default" | "userOverride";
  model?: string | undefined;
  effort?: "none" | "low" | "medium" | "high" | undefined;
  /** Set when a model change restarted the session. */
  restartedAt?: ISODateTime | undefined;
  /** Why this selection exists (surfaced in the UI). */
  explanation?: string | undefined;
}

/** A parked question the session waits on (auth / select / freeText). */
export type PendingElicitation = Extract<ActivityPartContent, { kind: "elicitation" }>;

/**
 * An agent session — delegated, semi-autonomous work (Linear's coding/agent
 * sessions; also the shape OUR runs present when surfaced through Linear's
 * Agent Sessions API on the golden-goose track B).
 */
export interface AgentSession {
  id: EntityId;
  status: AgentSessionStatus;
  displayTitle?: string | undefined;
  summary?: string | undefined;
  /** The session's live plan/checklist (markdown). */
  plan?: string | undefined;
  modelSelection: ModelSelection;
  pendingElicitation?: PendingElicitation | undefined;
  /** Links the session surfaced (PRs, issues, external). */
  externalUrls?: string[] | undefined;
  /** Linear entity linkage when driven from an issue/comment. */
  issueId?: EntityId | undefined;
  commentId?: EntityId | undefined;
  createdAt: ISODateTime;
  startedAt?: ISODateTime | undefined;
  endedAt?: ISODateTime | undefined;
}

/**
 * One activity inside a session. `signal` is the badge/affordance channel
 * (e.g. "working", commit badges); keep it a short string, extend as the UI
 * needs new badges. `ephemeral` activities are live-only (never persisted);
 * `queued` ones were injected while the session was busy.
 */
export interface AgentActivity {
  id: EntityId;
  sessionId: EntityId;
  content: ActivityPartContent;
  signal?: string | undefined;
  signalMetadata?: Record<string, unknown> | undefined;
  ephemeral: boolean;
  queued: boolean;
  sentAt: ISODateTime;
  /** Set when the activity originates from a Linear comment. */
  sourceCommentId?: EntityId | undefined;
}
