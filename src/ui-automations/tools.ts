/**
 * Tools (AU5, docs/plan/mcp.md): MCP per automation.
 *
 * An automation references servers from the workspace registry, with a
 * per-automation tool allowlist and an approval mode. Each reference is
 * RESOLVED through MCP1's registry at render time, so a portable automation
 * naming a server this workspace lacks shows `missing` visibly instead of
 * silently running tool-less.
 *
 * Pure list operations plus the section AU2 renders. No client (MCP2), no
 * RPC — resolution is a registry lookup, not a connection.
 */

import type { Draft, SectionSpec } from "./detail.ts";
import type { McpRegistry } from "../mcp/registry.ts";
import type { AutomationTool } from "../mcp/types.ts";
import type { Row } from "../ui-settings/rows.ts";

/** The draft key the Tools section owns. */
export const TOOLS_KEY = `tools`;

/** Read the list off a draft, tolerating a missing or malformed key. */
export function toolsOf(draft: Draft): AutomationTool[] {
  const v = draft[TOOLS_KEY];
  return Array.isArray(v) ? (v as AutomationTool[]) : [];
}

export type ToolsResult =
  | { ok: true; tools: AutomationTool[] }
  | { ok: false; detail: string };

/**
 * Attach a server. Returns a NEW list; the editor's set() does dirty
 * tracking. One reference per server: two entries for the same serverId
 * would be two allowlists for one connection, and the runner would have no
 * rule for which wins.
 */
export function addTool(list: readonly AutomationTool[], t: AutomationTool): ToolsResult {
  if (list.some((x) => x.serverId === t.serverId)) {
    return { ok: false, detail: `server ${t.serverId} is already attached` };
  }
  return { ok: true, tools: [...list, t] };
}

export const removeTool = (list: readonly AutomationTool[], serverId: string): AutomationTool[] =>
  list.filter((x) => x.serverId !== serverId);

/**
 * Replace one server's allowlist. Default is EXPLICIT — a tool should be
 * granted, not inherited — so `all` is a deliberate widening the caller
 * must name, never a fallback for an empty list.
 */
export function setAllowed(list: readonly AutomationTool[], serverId: string, allowed: readonly string[] | `all`): AutomationTool[] {
  return list.map((x) => (x.serverId === serverId ? { ...x, allowedTools: allowed } : x));
}

/** `ask` surfaces each call for confirmation before it executes. */
export function setApproval(list: readonly AutomationTool[], serverId: string, approval: `auto` | `ask`): AutomationTool[] {
  return list.map((x) => (x.serverId === serverId ? { ...x, approval } : x));
}

/** Rows for one attached server, resolved live against the registry. */
function rowsForTool(t: AutomationTool, registry: McpRegistry): Row[] {
  const resolved = registry.resolve({ serverId: t.serverId });
  if (!resolved.found) {
    // The state the plan calls easiest to forget. Degrade VISIBLY.
    return [{
      kind: `connection`, id: `tool.${t.serverId}`, label: t.serverId, state: `error`,
      detail: `Not in this workspace · set up, or pick another`,
    }];
  }
  const s = resolved.server;
  const allowed = t.allowedTools === `all` ? `All tools` : `${t.allowedTools.length} of this server's tools`;
  return [
    { kind: `connection`, id: `tool.${s.id}`, label: s.name,
      state: s.enabled ? `connected` : `disconnected`, detail: allowed },
    { kind: `toggle`, id: `tool.${s.id}.ask`, label: `Ask before each call`,
      description: `Surfaces every tool call for confirmation before it runs.`,
      on: t.approval === `ask` },
  ];
}

/**
 * The section AU2 renders. `registry` is injected so the section stays
 * pure — the host owns the workspace registry; this file never builds one.
 * `order: 30` puts it after Prompts, per the plan's section table.
 */
export const toolsSection = (registry: McpRegistry): SectionSpec => ({
  id: `tools`,
  title: `Tools`,
  blurb: `MCP servers this automation may call. Tools are granted, not inherited.`,
  order: 30,
  build: (draft) => {
    const list = toolsOf(draft);
    if (list.length === 0) {
      return [{ kind: `text`, id: `tool.none`, label: `No tools`, value: ``,
        description: `Attach an MCP server to give this automation tools.`, disabled: true }];
    }
    return list.flatMap((t) => rowsForTool(t, registry));
  },
});
