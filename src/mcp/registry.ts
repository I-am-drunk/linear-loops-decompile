/**
 * MCP server registry + resolution (MCP1, docs/plan/mcp.md).
 *
 * Resolution order when an automation names a server:
 *   explicit serverId → exact name within the requested scope
 *   → exact name in any scope → missing.
 * Name matching is case-insensitive. Lists sort by name.
 *
 * `missing` is the state that matters most and is easiest to forget: an
 * automation is portable (duplicate, copy-as-JSON, import), so it will
 * routinely reference a server this workspace does not have. It must degrade
 * VISIBLY, which is why resolve() returns a tagged result rather than
 * undefined — undefined is how "silently run tool-less" starts.
 */

import { checkDestination, type DestinationPolicy, type DestinationVerdict } from "./destination.ts";
import type { McpScope, McpServer, McpServerId } from "./types.ts";

export type Resolved =
  | { found: true; server: McpServer }
  | { found: false; wanted: string };

export type McpRegistry = {
  /** Validates the destination first; a refused server is never stored. */
  register(server: McpServer): DestinationVerdict;
  list(): McpServer[];
  get(id: McpServerId): McpServer | undefined;
  resolve(ref: { serverId?: string; name?: string; scope?: McpScope }): Resolved;
};

const byName = (a: McpServer, b: McpServer): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: `base` });

export function makeMcpRegistry(policy: DestinationPolicy = {}): McpRegistry {
  const byId = new Map<McpServerId, McpServer>();

  return {
    register(server: McpServer): DestinationVerdict {
      if (byId.has(server.id)) {
        throw new Error(`mcp: server already registered: ${server.id}`);
      }
      // stdio has no destination to check; it is gated by role, not range.
      if (server.transport.kind === `http`) {
        const verdict = checkDestination(server.transport.url, server.auth, policy);
        if (!verdict.ok) return verdict;
      }
      byId.set(server.id, server);
      return { ok: true };
    },

    list: () => [...byId.values()].sort(byName),
    get: (id) => byId.get(id),

    resolve(ref): Resolved {
      if (ref.serverId) {
        const s = byId.get(ref.serverId);
        return s ? { found: true, server: s } : { found: false, wanted: ref.serverId };
      }
      const want = (ref.name ?? ``).toLowerCase();
      if (want === ``) return { found: false, wanted: `` };
      const all = [...byId.values()].filter((s) => s.name.toLowerCase() === want);
      // Exact name within the requested scope wins; then any scope.
      const inScope = ref.scope ? all.find((s) => s.scope === ref.scope) : undefined;
      const pick = inScope ?? all[0];
      return pick ? { found: true, server: pick } : { found: false, wanted: ref.name ?? `` };
    },
  };
}
