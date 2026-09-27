/**
 * Core loop domain types — the records our server persists in SQLite and
 * serves over the T3 connect transport.
 *
 * Design notes (original code; behavior verified against Linear 1.32.4,
 * KNOWLEDGE.md §3 and SPECS/loops.md):
 *
 * - `LoopConfig` is the publishable config — everything the editor (R7) edits
 *   and the zod schema (loop-config.ts) validates. `WorkflowDefinition` is a
 *   LoopConfig plus server-managed fields (ids, stats, version, timestamps).
 * - A `WorkflowDefinitionDraft` carries an editable *copy* of LoopConfig;
 *   publishing copies it onto the live definition and bumps `version`.
 * - Linear keeps trigger type, event, and activation mode as sibling fields;
 *   we model the trigger as one discriminated union so invalid combinations
 *   (e.g. a schedule on a chat trigger) are unrepresentable.
 * - Optional fields use `?: T | undefined` (exactOptionalPropertyTypes).
 */

import type {
  CodeAccessLevel,
  CollectionChangeOperation,
  LoopActivationMode,
  LoopActivity,
  LoopEditAccess,
  LoopEventEntity,
  LoopEventKind,
  PropertyFilterOp,
} from "./enums.ts";

/** Opaque server-generated id. */
export type EntityId = string;

/** ISO-8601 UTC timestamp, e.g. `2026-09-26T21:00:00.000Z`. */
export type ISODateTime = string;

/**
 * The loop's prompt — what the brain is asked to do each run.
 * v1 authoring format is GitHub-flavored markdown; a structured-doc variant
 * can be added as a second `format` without touching stored configs.
 */
export interface PromptContent {
  format: "markdown";
  markdown: string;
}

/**
 * When a schedule-triggered loop fires. `rrule` is an RFC 5545 recurrence
 * rule string (e.g. `FREQ=WEEKLY;BYDAY=MO;BYHOUR=9`); the engine (R4) owns
 * evaluation. `timezone` is an IANA name the rule is interpreted in.
 */
export interface LoopSchedule {
  rrule: string;
  timezone: string;
}

/**
 * Our house default for new schedule loops — hourly, UTC. (Linear ships its
 * own internal default; this is ours, chosen for predictable costs.)
 */
export const DEFAULT_LOOP_SCHEDULE: LoopSchedule = {
  rrule: "FREQ=HOURLY",
  timezone: "UTC",
};

/** An entity event the dataplane can observe (webhook or poll, R3). */
export interface LoopEvent {
  entity: LoopEventEntity;
  kind: LoopEventKind;
}

/**
 * What wakes the loop. Exactly one variant:
 * - `schedule` — fires on the RRULE; the run has no target entity.
 * - `chat`     — wakes on messages/@mentions in enabled channels; trusted
 *                sources narrow who may wake it.
 * - `event`    — fires on a Linear entity change; `activationMode` selects
 *                collection-membership vs watched-property semantics.
 */
export type LoopTrigger =
  | { type: "schedule"; schedule: LoopSchedule }
  | { type: "chat" }
  | {
      type: "event";
      event: LoopEvent;
      activationMode: LoopActivationMode;
    };

/**
 * Extra gates evaluated after the trigger fires (SPECS/loops.md
 * §condition-semantics). ALL conditions must pass for a run to start.
 * - `watchedProperties` — with activationMode `watchedPropertyChanged`, run
 *   only when one of these properties actually changed.
 * - `collectionChange`  — with `collectionChanged`, run only when membership
 *   of `property` changed in the given direction.
 * - `commentMatch`      — run only when a new comment matches `pattern`
 *   (literal substring, or regex when `isRegex`).
 * - `propertyFilter`    — general v1 filter: compare an entity property
 *   against a value (eq/neq/in/contains).
 */
export type LoopCondition =
  | { kind: "watchedProperties"; properties: string[] }
  | {
      kind: "collectionChange";
      property: string;
      operation: CollectionChangeOperation;
    }
  | { kind: "commentMatch"; pattern: string; isRegex: boolean }
  | {
      kind: "propertyFilter";
      property: string;
      op: PropertyFilterOp;
      value: string | number | boolean | string[];
    };

/**
 * The publishable loop config: everything the editor edits, everything the
 * zod schema validates, and everything a publish copies onto the live record.
 * Superset of what Linear persists minus their server-side bits
 * (SPECS/loops.md §loop-config-fields).
 */
export interface LoopConfig {
  name: string;
  /** Sidebar grouping label (loops list groups by owner/team, then this). */
  groupName?: string | undefined;
  description?: string | undefined;
  icon?: string | undefined;
  /** Hex color `#rrggbb`, used for the loop's chip in the UI. */
  color?: string | undefined;
  /** Scoping: a loop may belong to a team and/or a project, else org-wide. */
  teamId?: EntityId | undefined;
  projectId?: EntityId | undefined;
  prompt: PromptContent;
  trigger: LoopTrigger;
  conditions: LoopCondition[];
  enabled: boolean;
  /** When scoped to a team, also fire on events in its sub-teams. */
  applyToSubTeams: boolean;
  /** Write capabilities runs of this loop may use (see LOOP_ACTIVITIES). */
  activities: LoopActivity[];
  /**
   * Allowlist of external source/integration keys permitted to wake this
   * loop (chat/event triggers). Empty = only first-party Linear events.
   */
  trustedSourceKeys: string[];
  codeAccess: CodeAccessLevel;
  editAccess: LoopEditAccess;
  subscriberIds: EntityId[];
}

/**
 * A live loop ("agent automation"). LoopConfig fields plus server-managed
 * bookkeeping. Linear's equivalent model is also named WorkflowDefinition;
 * ours is an original, smaller record — theirs additionally carries their
 * sync/policies machinery we do not build.
 */
export interface WorkflowDefinition extends LoopConfig {
  id: EntityId;
  /** Short public id used in URLs (`/loop/:slugId/runs`). */
  slugId: string;
  ownerId: EntityId;
  stats: LoopStats;
  lastExecutedAt?: ISODateTime | undefined;
  /** 1 at creation, +1 on every publish. */
  version: number;
  publishedAt?: ISODateTime | undefined;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime | undefined;
}

/**
 * Editable copy of a loop's config (SPECS/loops.md §concepts). The editor
 * always writes to the draft; publishing replaces the live definition's
 * config and bumps its `version`. `workflowDefinitionId` is null while the
 * loop itself is still unsaved (the "New loop" flow).
 */
export interface WorkflowDefinitionDraft {
  id: EntityId;
  workflowDefinitionId: EntityId | null;
  config: LoopConfig;
  lastUpdatedById?: EntityId | undefined;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * A standalone server-side cron automation, kept distinct from loops
 * (mirrors the separation Linear makes). The engine (R4) ticks these
 * alongside loop schedules; runs they spawn obey the same capability gates.
 */
export interface WorkflowCronJobDefinition {
  id: EntityId;
  name: string;
  description?: string | undefined;
  enabled: boolean;
  activities: LoopActivity[];
  schedule: LoopSchedule;
  teamId?: EntityId | undefined;
  creatorId: EntityId;
  /** Ordering hint for admin listings; lower sorts first. */
  sortOrder: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * The entity a run acts on. `entityId` is the Linear-side id from the
 * dataplane. Schedule runs have no target (LoopExecution.target is absent).
 */
export interface LoopRunTarget {
  entityType: LoopEventEntity;
  entityId: EntityId;
}

/**
 * Join record between a run and the loop + entity that produced it.
 * This is our equivalent of Linear's LoopExecution; their flat optional
 * entity fields become one `target` so exactly-one-subject is structural.
 * `runId` references the runtime's Run (src/runtime, R5 — the AiConversation
 * analog).
 */
export interface LoopExecution {
  id: EntityId;
  runId: EntityId;
  loopId: EntityId;
  /** Absent for schedule/chat runs with no subject entity. */
  target?: LoopRunTarget | undefined;
  /**
   * Upstream event id from the dataplane (webhook delivery id or poll
   * cursor). The idempotency key is hash(loopId, triggerEventId) so a
   * duplicate delivery never double-runs (SPECS/target-architecture.md
   * §safety-rails).
   */
  triggerEventId?: string | undefined;
  /** For continuation runs: the execution this one follows up on. */
  continuedFromExecutionId?: EntityId | undefined;
  createdAt: ISODateTime;
}

/**
 * Aggregate run bookkeeping shown as the last-run chip / usage history.
 * `totalCostUsd` sums our own inference usage counters (R6), not Linear's
 * billing.
 */
export interface LoopStats {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  totalCostUsd: number;
}
