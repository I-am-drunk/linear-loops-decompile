/**
 * Loops domain model (SPECS/loops.md). Field names and enums are extracted
 * facts, verified against the corpus (WorkflowDefinition /
 * WorkflowDefinitionDraft in corpus/analysis/models.json, trigger validation
 * path in the AutomationHelper chunk) and Linear's MIT-licensed official
 * schema (extracts/linear-official, master @ 2026-09-25: WorkflowTriggerType,
 * WorkflowActivationMode, WorkflowType, WorkflowDefinitionEditAccess).
 *
 * This module is pure: no I/O, no dependencies. The server validates with it
 * (src/server/loops-rpc.ts); the UI will reuse it (R4.x).
 *
 * Unverified nuances are marked UNVERIFIED per AGENTS.md; nothing here is
 * guessed silently.
 */

// --- Enums (const objects, strip-only safe; values are corpus/official facts) ---

/** Official `WorkflowTriggerType`: an entity type, or schedule/chat. */
export const TRIGGER_TYPES = [
  "chat",
  "cycle",
  "document",
  "initiative",
  "issue",
  "project",
  "release",
  "schedule",
  "team",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

/** Official `WorkflowActivationMode`. */
export const ACTIVATION_MODES = [
  "anyUpdate",
  "collectionChanged",
  "conditionsStartedMatching",
  "watchedPropertyChanged",
] as const;
export type ActivationMode = (typeof ACTIVATION_MODES)[number];

/**
 * Trigger event vocabulary (corpus enum). `entityInTriage` is the triage
 * variant the client substitutes for triage-scoped triggers.
 */
export const TRIGGER_EVENTS = [
  "entityCreated",
  "entityUpdated",
  "entityCreatedOrUpdated",
  "entityRemoved",
  "entityUnarchived",
  "cycleStarted",
  "cycleEnded",
  "commentAdded",
  "updatePosted",
  "chatMessagePosted",
  "chatReactionAdded",
  "customerRequestAdded",
  "entityInTriage",
] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

/** Chat triggers accept exactly these two events (corpus chat schema). */
export const CHAT_TRIGGER_EVENTS = ["chatMessagePosted", "chatReactionAdded"] as const;

/** Official `WorkflowType`. Loops are `automation`. */
export const WORKFLOW_TYPES = ["automation", "release", "sla"] as const;
export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

/** Official `WorkflowDefinitionEditAccess`. */
export const EDIT_ACCESS = ["everyone", "owner", "teamOwners", "workspaceAdmins"] as const;
export type EditAccess = (typeof EDIT_ACCESS)[number];

/** Corpus schedule `type` enum. */
export const SCHEDULE_TYPES = ["hours", "days", "weeks", "months", "years"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

/** Loop-level code access (KNOWLEDGE.md §3: read via code index, write via coding sessions). */
export const CODE_ACCESS = ["none", "read", "write"] as const;
export type CodeAccess = (typeof CODE_ACCESS)[number];

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

// --- Shapes ---

/**
 * Recurring schedule (corpus schema facts): `interval` a positive integer,
 * `hour` 0-23, `minute` 0-59, `daysOfWeek` only on weekly schedules.
 * `lastRecurredAt*` are server-managed bookkeeping (the corpus keeps them on
 * the same object) and are never accepted from RPC input.
 */
export interface LoopSchedule {
  /** Timeless date, YYYY-MM-DD. */
  startAt: string;
  type: ScheduleType;
  interval: number;
  hour: number;
  minute?: number;
  timezone?: string;
  daysOfWeek?: Weekday[];
  lastRecurredAt?: string;
  lastRecurredAtTimestamp?: string;
}

/** Corpus collection-change shape. */
export interface CollectionChange {
  property: string;
  operation: "added" | "removed";
  qualifier?: string;
}

/**
 * One condition (corpus condition schema). `filter` stays opaque until the
 * trigger evaluator lands (R6.1); it round-trips untouched.
 */
export interface LoopCondition {
  watchedProperties?: string[];
  collectionChange?: CollectionChange;
  commentMatch?: string;
  filter?: unknown;
}

/**
 * The persisted loop config: SPECS/loops.md's field list (a superset of
 * Linear's WorkflowDefinition minus their server-side relations). `prompt`,
 * `activities`, and `triggerConfig` are opaque JSON at this slice; their
 * exact shapes land with the editor (R4.2) and engine (R6) slices.
 */
export interface LoopConfig {
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  groupName?: string;
  /** Linear-side ids, stored opaque; resolved via the dataplane (R5). */
  ownerId?: string;
  teamId?: string;
  projectId?: string;
  /** Rich-text prompt (ProseMirror doc JSON), opaque here. */
  prompt?: unknown;
  triggerType: TriggerType;
  /** Event name for entity/chat triggers. */
  trigger?: TriggerEvent;
  activationMode?: ActivationMode;
  conditions: LoopCondition[];
  schedule?: LoopSchedule;
  enabled: boolean;
  applyToSubTeams: boolean;
  /** Capability/action list, opaque here. */
  activities: unknown[];
  /** Chat-trigger channel config, opaque here. */
  triggerConfig?: unknown;
  trustedSourceKeys: string[];
  codeAccess: CodeAccess;
  editAccess: EditAccess;
  subscriberIds: string[];
}

/**
 * The loop record: the live (published) config plus the draft working copy.
 * Mirrors Linear's WorkflowDefinition + WorkflowDefinitionDraft pair: edits
 * land on the draft, publishing replaces the live config (SPECS/loops.md
 * §Draft). `hasChanges` mirrors the draft model's computed flag.
 */
export interface LoopRecord {
  id: string;
  /** Short id for URLs. Charset is ours; Linear's exact slugId format is UNVERIFIED. */
  slugId: string;
  live: LoopConfig;
  draft: LoopConfig;
  hasChanges: boolean;
  /** Publish count; create counts as the first publish. */
  version: number;
  createdAt: string;
  updatedAt: string;
  lastPublishedAt?: string;
  /** Server-managed run bookkeeping (R6 fills these). */
  lastExecutedAt?: string;
  stats: Record<string, unknown>;
}

/** loops.list entry: the record itself (list pages need config-level detail). */
export interface LoopsListView {
  loops: LoopRecord[];
}

// --- Defaults ---

export const DEFAULT_LOOP_CONFIG = {
  enabled: false,
  applyToSubTeams: false,
  codeAccess: "none",
  editAccess: "everyone",
} as const;

/**
 * Corpus `defaultAutomationSchedule(createdAt, timezone)`: the next full hour
 * after creation, daily, interval 1 (AutomationHelper/model chunk). The
 * corpus computes it in the client's local time; we compute in UTC unless the
 * caller passes a timezone-anchored clock reading (UNVERIFIED nuance: whose
 * wall clock Linear's server uses).
 */
export function defaultAutomationSchedule(createdAt: Date, timezone?: string): LoopSchedule {
  const d = new Date(createdAt.getTime());
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() + 1);
  return {
    startAt: d.toISOString().slice(0, 10),
    hour: d.getUTCHours(),
    timezone,
    type: "days",
    interval: 1,
  };
}

// --- Validation (mirrors the corpus validation path; messages match Linear's
// where the corpus names them, since copy tone is part of the parity bar) ---

export interface ValidationError {
  path: string;
  message: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateSchedule(s: unknown, path: string, errors: ValidationError[]): void {
  if (!isPlainObject(s)) {
    errors.push({ path, message: "schedule must be an object" });
    return;
  }
  if (typeof s.startAt !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(s.startAt)) {
    errors.push({ path: `${path}.startAt`, message: "startAt must be a date (YYYY-MM-DD)" });
  }
  if (!SCHEDULE_TYPES.includes(s.type as ScheduleType)) {
    errors.push({ path: `${path}.type`, message: `type must be one of ${SCHEDULE_TYPES.join(", ")}` });
  }
  if (typeof s.interval !== "number" || !Number.isInteger(s.interval) || s.interval < 1) {
    errors.push({ path: `${path}.interval`, message: "interval must be a positive integer" });
  }
  if (typeof s.hour !== "number" || !Number.isInteger(s.hour) || s.hour < 0 || s.hour > 23) {
    errors.push({ path: `${path}.hour`, message: "hour must be an integer 0-23" });
  }
  if (s.minute !== undefined && (typeof s.minute !== "number" || !Number.isInteger(s.minute) || s.minute < 0 || s.minute > 59)) {
    errors.push({ path: `${path}.minute`, message: "minute must be an integer 0-59" });
  }
  if (s.daysOfWeek !== undefined) {
    // Corpus refine: "Selected days require a weekly schedule."
    if (s.type !== "weeks") {
      errors.push({ path: `${path}.daysOfWeek`, message: "Selected days require a weekly schedule." });
    } else if (!Array.isArray(s.daysOfWeek)) {
      errors.push({ path: `${path}.daysOfWeek`, message: "daysOfWeek must be an array" });
    } else {
      const days: unknown[] = s.daysOfWeek;
      // Corpus: min 1, max 7, unique ("Days of the week must be unique.")
      if (days.length < 1 || days.length > 7) {
        errors.push({ path: `${path}.daysOfWeek`, message: "daysOfWeek must have 1-7 entries" });
      }
      if (new Set(days).size !== days.length) {
        errors.push({ path: `${path}.daysOfWeek`, message: "Days of the week must be unique." });
      }
      for (const d of days) {
        if (!WEEKDAYS.includes(d as Weekday)) {
          errors.push({ path: `${path}.daysOfWeek`, message: `unknown weekday: ${String(d)}` });
        }
      }
    }
  }
}

function validateCondition(c: unknown, index: number, trigger: unknown, errors: ValidationError[]): void {
  const path = `conditions.${index}`;
  if (!isPlainObject(c)) {
    errors.push({ path, message: "condition must be an object" });
    return;
  }
  if (c.watchedProperties !== undefined) {
    if (!Array.isArray(c.watchedProperties) || c.watchedProperties.some((p) => typeof p !== "string")) {
      errors.push({ path: `${path}.watchedProperties`, message: "watchedProperties must be a string array" });
    }
  }
  if (c.collectionChange !== undefined) {
    const cc = c.collectionChange;
    if (!isPlainObject(cc) || typeof cc.property !== "string" || (cc.operation !== "added" && cc.operation !== "removed")) {
      errors.push({ path: `${path}.collectionChange`, message: "collectionChange needs { property, operation: added|removed }" });
    }
  }
  if (c.commentMatch !== undefined) {
    // Corpus rules, verbatim messages:
    if (index > 0) {
      errors.push({ path: `${path}.commentMatch`, message: "Comment matching can only be set on the first condition." });
    }
    if (trigger !== "commentAdded") {
      errors.push({ path: `${path}.commentMatch`, message: "Comment matching requires a comment trigger." });
    }
    if (typeof c.commentMatch !== "string") {
      errors.push({ path: `${path}.commentMatch`, message: "commentMatch must be a string" });
    }
  }
}

/**
 * Validate a complete loop config. Returns the list of problems; empty means
 * valid. Mirrors the corpus validation order: comment-match placement, then
 * the trigger-specific branch (schedule / chat / event).
 */
export function validateLoopConfig(config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isPlainObject(config)) return [{ path: "", message: "config must be an object" }];

  if (typeof config.name !== "string" || config.name.trim().length === 0) {
    errors.push({ path: "name", message: "name required" });
  }
  if (!TRIGGER_TYPES.includes(config.triggerType as TriggerType)) {
    errors.push({ path: "triggerType", message: `triggerType must be one of ${TRIGGER_TYPES.join(", ")}` });
  }
  if (config.trigger !== undefined && !TRIGGER_EVENTS.includes(config.trigger as TriggerEvent)) {
    errors.push({ path: "trigger", message: `unknown trigger event: ${String(config.trigger)}` });
  }
  if (config.activationMode !== undefined && !ACTIVATION_MODES.includes(config.activationMode as ActivationMode)) {
    errors.push({ path: "activationMode", message: `activationMode must be one of ${ACTIVATION_MODES.join(", ")}` });
  }
  if (config.codeAccess !== undefined && !CODE_ACCESS.includes(config.codeAccess as CodeAccess)) {
    errors.push({ path: "codeAccess", message: `codeAccess must be one of ${CODE_ACCESS.join(", ")}` });
  }
  if (config.editAccess !== undefined && !EDIT_ACCESS.includes(config.editAccess as EditAccess)) {
    errors.push({ path: "editAccess", message: `editAccess must be one of ${EDIT_ACCESS.join(", ")}` });
  }

  const conditions = config.conditions ?? [];
  if (!Array.isArray(conditions)) {
    errors.push({ path: "conditions", message: "conditions must be an array" });
  } else {
    conditions.forEach((c, i) => validateCondition(c, i, config.trigger, errors));
  }

  // Trigger-specific branch (corpus: schedule -> validateSchedule, chat -> validateChat).
  if (config.triggerType === "schedule" && config.schedule !== undefined) {
    validateSchedule(config.schedule, "schedule", errors);
  }
  if (config.triggerType === "chat" && config.trigger !== undefined) {
    if (!CHAT_TRIGGER_EVENTS.includes(config.trigger as (typeof CHAT_TRIGGER_EVENTS)[number])) {
      errors.push({ path: "trigger", message: `chat triggers accept ${CHAT_TRIGGER_EVENTS.join(" | ")}` });
    }
  }
  return errors;
}
