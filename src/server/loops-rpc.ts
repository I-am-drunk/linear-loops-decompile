/**
 * loops.* RPC handlers (SPECS/t3-connect.md §RPC surface; SPECS/loops.md).
 * Server half of R4.1: list/get/upsert/publish/setEnabled over the store.
 *
 * Lifecycle (corpus-verified, src/model/loop.ts): upsert writes the DRAFT;
 * publish replaces the live config and bumps version. Linear-side references
 * (owner/team/project/trustedSourceKeys) stay opaque strings — the dataplane
 * (R5) is where they get resolved.
 *
 * UNVERIFIED: whether Linear's enabled toggle rides the draft or writes
 * through. We write live AND draft together so a later publish cannot
 * silently revert an explicit toggle (src/model/loop.ts).
 */

import { randomUUID } from "node:crypto";
import type {
  LoopActivationMode,
  LoopCodeAccess,
  LoopCondition,
  LoopConfig,
  LoopDetail,
  LoopSummary,
  LoopTriggerType,
} from "../model/loop.ts";
import type { Registry } from "../connect/server.ts";
import { RpcError } from "./settings-rpc.ts";
import type { LoopRow, Store } from "./store.ts";

const TRIGGER_TYPES = new Set<LoopTriggerType>(["schedule", "chat", "event"]);
const ACTIVATION_MODES = new Set<LoopActivationMode>(["collectionChanged", "watchedPropertyChanged"]);
const CODE_ACCESS = new Set<LoopCodeAccess>(["none", "read", "write"]);

type Input = Record<string, unknown>;

function bad(message: string): never {
  throw new RpcError("invalid_params", message);
}

function optStr(input: Input, key: string): string | undefined {
  const v = input[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") bad(`${key} must be a string`);
  return v as string;
}

function optBool(input: Input, key: string): boolean | undefined {
  const v = input[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") bad(`${key} must be a boolean`);
  return v as boolean;
}

function strList(input: Input, key: string): string[] | undefined {
  const v = input[key];
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) bad(`${key} must be a string[]`);
  return v as string[];
}

function conditions(input: Input, key: string): LoopCondition[] | undefined {
  const v = input[key];
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) bad(`${key} must be an array`);
  return v.map((raw, i): LoopCondition => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) bad(`conditions[${i}] must be an object`);
    const c = raw as Input;
    const out: LoopCondition = {};
    const wp = strList(c, "watchedProperties");
    if (wp) out.watchedProperties = wp;
    if (c.collectionChange !== undefined && c.collectionChange !== null) {
      const cc = c.collectionChange as Input;
      if (typeof cc !== "object" || cc === null || typeof cc.property !== "string") {
        bad(`conditions[${i}].collectionChange.property must be a string`);
      }
      if (cc.operation !== "added" && cc.operation !== "removed") {
        bad(`conditions[${i}].collectionChange.operation must be "added" | "removed"`);
      }
      out.collectionChange = { property: cc.property, operation: cc.operation };
    }
    const cm = optStr(c, "commentMatch");
    if (cm !== undefined) out.commentMatch = cm;
    if (!out.watchedProperties && !out.collectionChange && out.commentMatch === undefined) {
      bad(`conditions[${i}] is empty (need watchedProperties, collectionChange, or commentMatch)`);
    }
    return out;
  });
}

function jsonSafe(value: unknown, key: string): unknown {
  if (value === undefined) return undefined;
  try {
    JSON.stringify(value);
  } catch {
    bad(`${key} must be JSON-serializable`);
  }
  return value;
}

/**
 * Merge an upsert input over the existing draft (or defaults on create) and
 * validate the result. Arrays/objects replace wholesale; absent keys keep the
 * existing value.
 */
function toConfig(input: Input, existing?: LoopConfig): LoopConfig {
  const name = optStr(input, "name") ?? existing?.name;
  if (!name || !name.trim()) bad("name required");

  const triggerType = (optStr(input, "triggerType") ?? existing?.triggerType) as LoopTriggerType | undefined;
  if (!triggerType || !TRIGGER_TYPES.has(triggerType)) {
    bad('triggerType must be "schedule" | "chat" | "event"');
  }

  const schedule = optStr(input, "schedule") ?? existing?.schedule;
  if (triggerType === "schedule" && !schedule?.trim()) {
    bad("schedule required when triggerType is schedule");
  }

  let trigger = existing?.trigger;
  if (input.trigger !== undefined && input.trigger !== null) {
    const t = input.trigger as Input;
    if (typeof t !== "object" || t === null || Array.isArray(t)) bad("trigger must be an object");
    trigger = {
      entity: optStr(t, "entity"),
      activationMode: optStr(t, "activationMode") as LoopActivationMode | undefined,
    };
  }
  if (triggerType === "event") {
    if (!trigger?.entity) bad("trigger.entity required when triggerType is event");
    if (!trigger.activationMode || !ACTIVATION_MODES.has(trigger.activationMode)) {
      bad('trigger.activationMode must be "collectionChanged" | "watchedPropertyChanged" when triggerType is event');
    }
  } else if (trigger?.activationMode && !ACTIVATION_MODES.has(trigger.activationMode)) {
    bad('trigger.activationMode must be "collectionChanged" | "watchedPropertyChanged"');
  }

  const codeAccess = (optStr(input, "codeAccess") ?? existing?.codeAccess ?? "none") as LoopCodeAccess;
  if (!CODE_ACCESS.has(codeAccess)) bad('codeAccess must be "none" | "read" | "write"');

  const prompt = input.prompt !== undefined ? jsonSafe(input.prompt, "prompt") : existing?.prompt;

  return {
    name: name.trim(),
    icon: optStr(input, "icon") ?? existing?.icon,
    color: optStr(input, "color") ?? existing?.color,
    description: optStr(input, "description") ?? existing?.description,
    groupName: optStr(input, "groupName") ?? existing?.groupName,
    owner: optStr(input, "owner") ?? existing?.owner,
    team: optStr(input, "team") ?? existing?.team,
    project: optStr(input, "project") ?? existing?.project,
    prompt,
    triggerType,
    trigger,
    conditions: conditions(input, "conditions") ?? existing?.conditions ?? [],
    schedule,
    enabled: optBool(input, "enabled") ?? existing?.enabled ?? false,
    applyToSubTeams: optBool(input, "applyToSubTeams") ?? existing?.applyToSubTeams ?? false,
    activities: strList(input, "activities") ?? existing?.activities ?? [],
    trustedSourceKeys: strList(input, "trustedSourceKeys") ?? existing?.trustedSourceKeys ?? [],
    codeAccess,
    editAccess: optStr(input, "editAccess") ?? existing?.editAccess,
  };
}

function hasChanges(row: LoopRow): boolean {
  return row.version === 0 ? true : row.config !== row.draft;
}

function toSummary(row: LoopRow): LoopSummary {
  const config = JSON.parse(row.config) as LoopConfig;
  return {
    id: row.id,
    name: config.name,
    icon: config.icon,
    color: config.color,
    description: config.description,
    groupName: config.groupName,
    owner: config.owner,
    team: config.team,
    project: config.project,
    triggerType: config.triggerType,
    enabled: config.enabled,
    version: row.version,
    hasChanges: hasChanges(row),
    publishedAt: row.publishedAt ?? undefined,
    lastExecutedAt: row.lastExecutedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mustGet(store: Store, id: unknown): LoopRow {
  if (typeof id !== "string" || !id) bad("id required");
  const row = store.getLoop(id);
  if (!row) throw new RpcError("not_found", `no loop: ${id}`);
  return row;
}

export function createLoopsHandlers(store: Store): Registry {
  return {
    "loops.list": () => store.listLoops().map(toSummary),

    "loops.get": (params) => {
      const row = mustGet(store, (params as Input)?.id);
      const detail: LoopDetail = {
        ...toSummary(row),
        config: JSON.parse(row.config) as LoopConfig,
        draft: JSON.parse(row.draft) as LoopConfig,
      };
      return detail;
    },

    "loops.upsert": (params) => {
      const p = (params ?? {}) as { id?: string; input?: Input };
      if (!p.input || typeof p.input !== "object") bad("input required");
      const now = new Date().toISOString();

      if (p.id === undefined) {
        const config = toConfig(p.input);
        const id = `loop_${randomUUID()}`;
        const json = JSON.stringify(config);
        store.insertLoop({
          id,
          config: json,
          draft: json,
          version: 0,
          createdAt: now,
          updatedAt: now,
          publishedAt: null,
          lastExecutedAt: null,
        });
        store.audit("loops.created", { id, name: config.name, triggerType: config.triggerType });
        return { ok: true, id, version: 0, hasChanges: true };
      }

      const row = mustGet(store, p.id);
      const draft = toConfig(p.input, JSON.parse(row.draft) as LoopConfig);
      const json = JSON.stringify(draft);
      if (json !== row.draft) {
        store.updateLoopDraft(row.id, json, now);
        store.audit("loops.draft.updated", { id: row.id, name: draft.name });
      }
      return { ok: true, id: row.id, version: row.version, hasChanges: hasChanges(store.getLoop(row.id) as LoopRow) };
    },

    "loops.publish": (params) => {
      const row = mustGet(store, (params as Input)?.id);
      if (row.version > 0 && row.config === row.draft) {
        bad("no unpublished changes");
      }
      const at = new Date().toISOString();
      store.publishLoop(row.id, at);
      const version = row.version + 1;
      store.audit("loops.published", { id: row.id, version });
      return { ok: true, id: row.id, version, publishedAt: at };
    },

    "loops.setEnabled": (params) => {
      const p = (params ?? {}) as { id?: string; enabled?: boolean };
      const row = mustGet(store, p.id);
      if (typeof p.enabled !== "boolean") bad("enabled must be a boolean");
      const config = JSON.parse(row.config) as LoopConfig;
      const draft = JSON.parse(row.draft) as LoopConfig;
      if (config.enabled !== p.enabled || draft.enabled !== p.enabled) {
        config.enabled = p.enabled;
        draft.enabled = p.enabled;
        store.writeLoopConfigs(row.id, JSON.stringify(config), JSON.stringify(draft), new Date().toISOString());
        store.audit("loops.enabled", { id: row.id, enabled: p.enabled });
      }
      return { ok: true, id: row.id, enabled: p.enabled };
    },
  };
}
