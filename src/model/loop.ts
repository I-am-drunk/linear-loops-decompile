/**
 * Loop domain model (SPECS/loops.md, KNOWLEDGE.md §3). Field names mirror
 * Linear's `WorkflowDefinition` (corpus `models.json`) minus Linear's
 * server-side bits; behavior is reproduced in original code.
 *
 * Draft lifecycle (corpus `WorkflowDefinitionDraft`): edits land on a draft
 * copy of the config; publishing replaces the live config. `live` is null
 * until the first publish — whether Linear's new-loop dialog publishes
 * immediately is UNVERIFIED; draft-only creation is the safe reading of the
 * draft model.
 */

export type TriggerType = "schedule" | "chat" | "event";
export type ActivationMode = "collectionChanged" | "watchedPropertyChanged";
export type CodeAccess = "none" | "read" | "write";

/** Corpus AutomationHelper: event triggers carry an entity + activationMode. */
export interface LoopTrigger {
  /** Entity event source, e.g. "issue", "comment", "project" (triage variant: "entityInTriage"). */
  event?: string;
  activationMode?: ActivationMode;
}

/** Corpus condition shapes (zod-validated upstream; plain guards here — zero runtime deps). */
export interface LoopCondition {
  watchedProperties?: string[];
  collectionChange?: { property: string; operation: string };
  commentMatch?: string;
}

/** rrule-ish text; corpus has a `defaultAutomationSchedule`, so optional even for schedule triggers. */
export interface LoopSchedule {
  rrule: string;
}

/** The persistable config superset (SPECS/loops.md), minus Linear server bits. */
export interface LoopConfig {
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  groupName?: string;
  /** Owner is the org unless teamId/projectId narrows it. */
  teamId?: string;
  projectId?: string;
  /** ProseMirror document JSON. Shape is enforced by the editor slice (R4.2), not here. */
  prompt?: unknown;
  triggerType: TriggerType;
  trigger?: LoopTrigger;
  conditions?: LoopCondition[];
  schedule?: LoopSchedule;
  enabled: boolean;
  applyToSubTeams?: boolean;
  /** Capabilities the loop may use (enum values live in the corpus; strings here). */
  activities?: string[];
  trustedSourceKeys?: string[];
  codeAccess?: CodeAccess;
  /** Corpus field exists; its enum values are UNVERIFIED — carried as a plain string. */
  editAccess?: string;
  subscribers?: string[];
}

export interface LoopRecord {
  id: string;
  slugId: string;
  /** Denormalized display name (draft wins over live); the config copies are authoritative. */
  name: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  version: number;
  /** Live (published) config; null until first publish. */
  live: LoopConfig | null;
  /** Pending draft; null when no unpublished edits exist. */
  draft: LoopConfig | null;
}

/** What the loops list page (R4.1 UI half) renders. */
export interface LoopSummary {
  id: string;
  slugId: string;
  name: string;
  icon?: string;
  color?: string;
  groupName?: string;
  teamId?: string;
  projectId?: string;
  triggerType?: TriggerType;
  enabled: boolean;
  published: boolean;
  hasDraft: boolean;
  publishedAt?: string;
  updatedAt: string;
}
