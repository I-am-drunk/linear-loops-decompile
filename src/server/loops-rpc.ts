/**
 * loops.* RPC handlers — the loops domain server half (PLAN.md R4.1).
 * The list page itself lands with the R3.4 UI shell.
 *
 * Semantics (SPECS/loops.md, KNOWLEDGE.md §3):
 * - Edits land on a DRAFT (corpus `WorkflowDefinitionDraft`); `loops.publish`
 *   replaces the live config with the draft. A new loop is draft-only until
 *   first publish (UNVERIFIED against Linear's new-loop dialog; the safe
 *   reading of the draft model).
 * - `loops.setEnabled` toggles the LIVE config directly — the corpus list
 *   page has an always-on enabled toggle — and rejects unpublished loops.
 * - Validation is plain TS guards (zero runtime deps); upstream uses zod.
 */

import { randomBytes, randomUUID } from "node:crypto";
import type { ActivationMode, CodeAccess, LoopCondition, LoopConfig, LoopRecord, LoopSummary, TriggerType } from "../model/loop.ts";
import type { Registry } from "../connect/server.ts";
import type { Store } from "./store.ts";
import { RpcError } from "./settings-rpc.ts";

const TRIGGER_TYPES = new Set(["schedule", "chat", "event"]);
const ACTIVATION_MODES = new Set(["collectionChanged", "watchedPropertyChanged"]);
const CODE_ACCESS = new Set(["none", "read", "write"]);

function slugId(): string {
  return randomBytes(6).toString("base64url"); // 8 chars, route-facing like Linear's slugId
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateConditions(list: unknown): LoopCondition[] | undefined {
  if (list === undefined) return undefined;
  if (!Array.isArray(list)) throw new RpcError("invalid_params", "conditions must be an array");
  for (const c of list) {
    if (!isPlainObject(c)) throw new RpcError("invalid_params", "condition must be an object");
    if (c.watchedProperties !== undefined && !Array.isArray(c.watchedProperties)) {
      throw new RpcError("invalid_params", "condition.watchedProperties must be an array");
    }
    if (c.collectionChange !== undefined) {
      const cc = c.collectionChange;
      if (!isPlainObject(cc) || typeof cc.property !== "string" || typeof cc.operation !== "string") {
        throw new RpcError("invalid_params", "condition.collectionChange needs property + operation strings");
      }
    }
    if (c.commentMatch !== undefined && typeof c.commentMatch !== "string") {
      throw new RpcError("invalid_params", "condition.commentMatch must be a string");
    }
  }
  return list as LoopCondition[];
}

function validateStringList(v: unknown, field: string): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    throw new RpcError("invalid_params", `${field} must be a string array`);
  }
  return v as string[];
}

/**
 * Merge partial input over a base config and validate the RESULT. Unknown
 * fields are rejected: the config mirrors WorkflowDefinition, so a typo'd
 * field must fail loudly, not silently persist.
 */
const KNOWN_FIELDS = new Set([
  "name", "icon", "color", "description", "groupName", "teamId", "projectId",
  "prompt", "triggerType", "trigger", "conditions", "schedule", "enabled",
  "applyToSubTeams", "activities", "trustedSourceKeys", "codeAccess",
  "editAccess", "subscribers",
]);

export function mergeConfig(base: Partial<LoopConfig>, input: Record<string, unknown>): LoopConfig {
  for (const key of Object.keys(input)) {
    if (!KNOWN_FIELDS.has(key)) throw new RpcError("invalid_params", `unknown loop field: ${key}`);
  }
  const merged: Record<string, unknown> = { ...base, ...input };

  if (typeof merged.name !== "string" || merged.name.trim() === "") {
    throw new RpcError("invalid_params", "name required");
  }
  if (typeof merged.triggerType !== "string" || !TRIGGER_TYPES.has(merged.triggerType)) {
    throw new RpcError("invalid_params", "triggerType must be schedule|chat|event");
  }
  if (merged.trigger !== undefined) {
    const t = merged.trigger;
    if (!isPlainObject(t)) throw new RpcError("invalid_params", "trigger must be an object");
    if (t.event !== undefined && typeof t.event !== "string") throw new RpcError("invalid_params", "trigger.event must be a string");
    if (t.activationMode !== undefined && !ACTIVATION_MODES.has(String(t.activationMode))) {
      throw new RpcError("invalid_params", "trigger.activationMode must be collectionChanged|watchedPropertyChanged");
    }
  }
  if (merged.schedule !== undefined) {
    const s = merged.schedule;
    if (!isPlainObject(s) || typeof s.rrule !== "string") {
      throw new RpcError("invalid_params", "schedule.rrule required when schedule is set");
    }
  }
  if (merged.enabled !== undefined && typeof merged.enabled !== "boolean") {
    throw new RpcError("invalid_params", "enabled must be a boolean");
  }
  if (merged.codeAccess !== undefined && !CODE_ACCESS.has(String(merged.codeAccess))) {
    throw new RpcError("invalid_params", "codeAccess must be none|read|write");
  }

  const out = merged as unknown as LoopConfig;
  out.conditions = validateConditions(merged.conditions);
  out.activities = validateStringList(merged.activities, "activities");
  out.trustedSourceKeys = validateStringList(merged.trustedSourceKeys, "trustedSourceKeys");
  out.subscribers = validateStringList(merged.subscribers, "subscribers");
  return out;
}

function summary(rec: LoopRecord): LoopSummary {
  const shown = rec.live ?? rec.draft;
  return {
    id: rec.id,
    slugId: rec.slugId,
    name: rec.name,
    icon: shown?.icon,
    color: shown?.color,
    groupName: shown?.groupName,
    teamId: shown?.teamId,
    projectId: shown?.projectId,
    triggerType: shown?.triggerType as TriggerType | undefined,
    enabled: rec.live?.enabled ?? false,
    published: rec.live !== null,
    hasDraft: rec.draft !== null,
    publishedAt: rec.publishedAt,
    updatedAt: rec.updatedAt,
  };
}

export function createLoopsHandlers(store: Store): Registry {
  return {
    "loops.list": () => ({ loops: store.listLoops().map(summary) }),

    "loops.get": (params) => {
      const { id } = (params ?? {}) as { id?: string };
      if (!id) throw new RpcError("invalid_params", "id required");
      const rec = store.getLoop(id);
      if (!rec) throw new RpcError("not_found", `no loop: ${id}`);
      return { loop: rec, published: rec.live !== null, hasDraft: rec.draft !== null };
    },

    "loops.upsert": (params) => {
      const p = (params ?? {}) as { id?: string; input?: Record<string, unknown> };
      if (!p.input || !isPlainObject(p.input)) throw new RpcError("invalid_params", "input required");

      if (!p.id) {
        const draft = mergeConfig({ enabled: false }, p.input);
        const now = new Date().toISOString();
        const rec: LoopRecord = {
          id: `loop_${randomUUID()}`,
          slugId: slugId(),
          name: draft.name,
          createdAt: now,
          updatedAt: now,
          version: 0,
          live: null,
          draft,
        };
        store.insertLoop(rec);
        store.audit("loops.created", { id: rec.id, name: draft.name, triggerType: draft.triggerType });
        return { ok: true, id: rec.id, slugId: rec.slugId };
      }

      const rec = store.getLoop(p.id);
      if (!rec) throw new RpcError("not_found", `no loop: ${p.id}`);
      const draft = mergeConfig(rec.draft ?? rec.live ?? { enabled: false }, p.input);
      rec.draft = draft;
      rec.name = draft.name;
      rec.updatedAt = new Date().toISOString();
      store.updateLoop(rec);
      store.audit("loops.draft.updated", { id: rec.id, name: draft.name });
      return { ok: true, id: rec.id };
    },

    "loops.publish": (params) => {
      const { id } = (params ?? {}) as { id?: string };
      if (!id) throw new RpcError("invalid_params", "id required");
      const rec = store.getLoop(id);
      if (!rec) throw new RpcError("not_found", `no loop: ${id}`);
      if (!rec.draft) throw new RpcError("invalid_params", "nothing to publish");
      rec.live = rec.draft;
      rec.draft = null;
      rec.version += 1;
      rec.publishedAt = new Date().toISOString();
      rec.updatedAt = rec.publishedAt;
      rec.name = rec.live.name;
      store.updateLoop(rec);
      store.audit("loops.published", { id: rec.id, version: rec.version });
      return { ok: true, id: rec.id, version: rec.version, publishedAt: rec.publishedAt };
    },

    "loops.setEnabled": (params) => {
      const p = (params ?? {}) as { id?: string; enabled?: boolean };
      if (!p.id || typeof p.enabled !== "boolean") {
        throw new RpcError("invalid_params", "id and enabled required");
      }
      const rec = store.getLoop(p.id);
      if (!rec) throw new RpcError("not_found", `no loop: ${p.id}`);
      if (!rec.live) throw new RpcError("invalid_params", "loop is not published");
      rec.live.enabled = p.enabled;
      rec.updatedAt = new Date().toISOString();
      store.updateLoop(rec);
      store.audit(p.enabled ? "loops.enabled" : "loops.disabled", { id: rec.id });
      return { ok: true, id: rec.id, enabled: p.enabled };
    },
  };
}
