/**
 * The MCP servers settings section (ST5, docs/plan/mcp.md).
 *
 * Assembly over MCP1's registry and ST2's row patterns, the same mapping
 * shape as ST3 (providers) and ST4 (integrations). Mapping only: no client
 * (MCP2), no RPC, no stylesheet.
 *
 * The plan names FIVE connection states, each needing its own copy because
 * each needs a different action from the user. ST2's `connection` row has
 * four. `needsAuth` and `missing` are folded in below with their own detail
 * text, so the user still sees the right next step even though the badge
 * vocabulary is shared.
 */

import type { McpServer, McpStatus } from "../mcp/types.ts";
import type { ConnectionState, Row, Section } from "../ui-settings/rows.ts";

/** What the section needs per server: the registry entry plus live status. */
export type ServerView = { server: McpServer; status: McpStatus };

/** Plan state -> ST2 badge state + the detail that disambiguates. */
function badge(s: McpStatus): { state: ConnectionState; detail: string } {
  switch (s.state) {
    case `connected`:
      return { state: `connected`, detail: `${s.tools.length} ${s.tools.length === 1 ? `tool` : `tools`}` };
    case `disconnected`:
      return { state: `disconnected`, detail: `Not reachable · retry` };
    case `needsAuth`:
      return { state: `error`, detail: `Needs auth · connect` };
    case `missing`:
      return { state: `error`, detail: `Not in this workspace · set up, or pick another` };
    case `error`:
      return { state: `error`, detail: s.detail };
  }
}

const TRANSPORT_LABEL = (s: McpServer): string =>
  s.transport.kind === `stdio`
    ? `stdio · ${s.transport.command}`
    : `http · ${s.transport.url}`;

/** Rows for one server: connection, transport (read-only), and auth if keyed. */
export function rowsForServer(v: ServerView): Row[] {
  const { server: s, status } = v;
  const b = badge(status);
  const rows: Row[] = [
    { kind: `connection`, id: `${s.id}.connection`, label: s.name, state: b.state, detail: b.detail },
    { kind: `text`, id: `${s.id}.transport`, label: `Transport`, value: TRANSPORT_LABEL(s), disabled: true },
  ];
  // bearer and header carry a secret; none and oauth2 do not store one here.
  if (s.auth.kind === `bearer` || s.auth.kind === `header`) {
    rows.push({
      kind: `credential`, id: `${s.id}.credential`,
      label: s.auth.kind === `bearer` ? `Bearer token` : `Header ${s.auth.name}`,
      configured: status.state !== `needsAuth`,
    });
  }
  return rows;
}

/** One section per server, sorted by name as the plan says lists are. */
export const sectionsFor = (views: readonly ServerView[]): Section[] =>
  [...views]
    .sort((a, b) => a.server.name.localeCompare(b.server.name, undefined, { sensitivity: `base` }))
    .map((v) => ({
      id: v.server.id,
      title: v.server.name,
      blurb: `${v.server.scope === `workspace` ? `Shared` : `Private`} · ${v.server.enabled ? `enabled` : `disabled`}`,
      rows: rowsForServer(v),
    }));

export const mcpPage = (views: readonly ServerView[]) => ({
  id: `mcp`,
  title: `MCP servers`,
  sections: sectionsFor(views),
});
