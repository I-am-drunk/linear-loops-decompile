/**
 * Loop domain types (SPECS/loops.md). Behavior derived from the decompile
 * corpus (KNOWLEDGE.md §3); code here is original.
 */

export type TriggerType = "schedule" | "chat" | "event";

export type ActivationMode = "collectionChanged" | "watchedPropertyChanged";

export interface LoopCondition {
  watchedProperties?: string[];
  collectionChange?: { property: string; operation: "added" | "removed" };
  commentMatch?: string;
  filters?: Record<string, unknown>;
}

export interface LoopTrigger {
  entity?: string; // issue | project | initiative | document | comment | team | cycle | release
  activationMode?: ActivationMode;
}

/**
 * The persisted loop config (our superset of Linear's WorkflowDefinition,
 * minus their server bits; SPECS/loops.md §config fields).
 */
export interface LoopConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  ownerLabel: string;
  teamId?: string;
  projectId?: string;
  prompt: string; // rich text doc serialized
  triggerType: TriggerType;
  trigger: LoopTrigger;
  conditions: LoopCondition[];
  schedule?: { rrule: string };
  enabled: boolean;
  applyToSubTeams: boolean;
  activities: string[]; // capabilities the loop may use
  trustedSourceKeys: string[];
  codeAccess: "none" | "read" | "write";
  editAccess: "owner" | "team" | "workspace";
  subscribers: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  lastExecutedAt?: string;
}

/** Edits always land on a draft; publishing replaces the live config. */
export type LoopDraft = Omit<
  LoopConfig,
  "id" | "version" | "createdAt" | "updatedAt" | "publishedAt" | "lastExecutedAt"
>;

export const DEFAULT_LOOP_DRAFT: LoopDraft = {
  name: "Untitled loop",
  icon: "loop",
  color: "#5e68d0", // corpus: Linear brand indigo (docs/ui-reference.md)
  description: "",
  ownerLabel: "",
  prompt: "",
  triggerType: "schedule",
  trigger: {},
  conditions: [],
  schedule: { rrule: "FREQ=DAILY;INTERVAL=1" },
  enabled: false,
  applyToSubTeams: false,
  activities: ["comment"],
  trustedSourceKeys: [],
  codeAccess: "none",
  editAccess: "workspace",
  subscribers: [],
};
