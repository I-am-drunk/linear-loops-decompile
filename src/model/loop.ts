/**
 * Loops domain model — faithful to Linear's WorkflowDefinition /
 * WorkflowDefinitionDraft (extracts/models.md, KNOWLEDGE.md §3,
 * SPECS/loops.md). We persist OUR records only; Linear-side references
 * (owner, team, project, trusted source keys) are opaque strings here.
 *
 * Lifecycle (corpus-verified): edits land on a DRAFT that mirrors every
 * config field; publishing replaces the live config (version bumps,
 * publishedAt stamps). `hasChanges` mirrors the draft model's flag.
 *
 * UNVERIFIED (marked per AGENTS.md, not guessed):
 * - Whether Linear's list-page enabled toggle writes through immediately or
 *   rides the draft. We write live + draft together (see loops-rpc.ts).
 * - The value of Linear's `defaultAutomationSchedule`. We require an
 *   explicit schedule string rather than inventing one.
 */

export type LoopTriggerType = "schedule" | "chat" | "event";

export type LoopActivationMode = "collectionChanged" | "watchedPropertyChanged";

export type LoopCodeAccess = "none" | "read" | "write";

/** One condition on an event/chat trigger (SPECS/loops.md §Condition semantics). */
export interface LoopCondition {
  /** Run only when one of these properties changed. */
  watchedProperties?: string[];
  /** Run when `property` gains/loses members. */
  collectionChange?: { property: string; operation: "added" | "removed" };
  /** Run only when a new comment matches (substring; regex lands with R6). */
  commentMatch?: string;
}

/** Event trigger config: which Linear entity, and how it activates. */
export interface LoopTrigger {
  /** issue | project | initiative | document | comment | team | cycle | release | … */
  entity?: string;
  activationMode?: LoopActivationMode;
}

/**
 * The publishable loop config. Mirrors WorkflowDefinition minus Linear's
 * server-side bits (SPECS/loops.md §Loop config fields we persist).
 */
export interface LoopConfig {
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  groupName?: string;
  owner?: string;
  team?: string;
  project?: string;
  /** Rich-text prompt (ProseMirror doc JSON); opaque to the server. */
  prompt?: unknown;
  triggerType: LoopTriggerType;
  trigger?: LoopTrigger;
  conditions: LoopCondition[];
  /** rrule-ish schedule string; required when triggerType is "schedule". */
  schedule?: string;
  enabled: boolean;
  applyToSubTeams: boolean;
  /** Capabilities the loop may use (labels opaque to the server). */
  activities: string[];
  trustedSourceKeys: string[];
  codeAccess: LoopCodeAccess;
  editAccess?: string;
}

/** What loops.list returns: summary + lifecycle markers, no draft body. */
export interface LoopSummary {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  groupName?: string;
  owner?: string;
  team?: string;
  project?: string;
  triggerType: LoopTriggerType;
  enabled: boolean;
  /** 0 = never published. */
  version: number;
  /** Draft differs from the published config (true while never published). */
  hasChanges: boolean;
  publishedAt?: string;
  /** Filled by the runtime (R6); undefined until the loop has run. */
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** loops.get: the live config plus the working draft. */
export interface LoopDetail extends LoopSummary {
  config: LoopConfig;
  draft: LoopConfig;
}
