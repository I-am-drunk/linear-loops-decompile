/**
 * MCP server model (MCP1, docs/plan/mcp.md).
 *
 * Built from the open Model Context Protocol specification. A workspace keeps
 * a server registry; an automation references servers from it with
 * per-automation overrides. Nothing here connects — that is MCP2.
 */

export type McpServerId = string;

export type McpServerAuth =
  | { kind: `none` }
  | { kind: `bearer` }
  | { kind: `header`; name: string }
  | { kind: `oauth2`; scopes: readonly string[] };

/**
 * stdio is a local command the runner will EXECUTE — arbitrary code
 * execution, treated as such. Streamable HTTP is the current remote
 * transport; legacy HTTP+SSE is deprecated in the spec and not modelled.
 */
export type McpTransport =
  | { kind: `stdio`; command: string; args: readonly string[] }
  | { kind: `http`; url: string };

/** `workspace` is shared; `user` is private to one member. */
export type McpScope = `user` | `workspace`;

export type McpServer = {
  id: McpServerId;
  name: string;
  transport: McpTransport;
  auth: McpServerAuth;
  scope: McpScope;
  enabled: boolean;
};

/**
 * An automation's use of one server. `allowedTools` defaults to an explicit
 * subset — a tool should be granted, not inherited — and `approval: ask`
 * surfaces each call for confirmation before it executes.
 */
export type AutomationTool = {
  automationId: string;
  serverId: McpServerId;
  allowedTools: readonly string[] | `all`;
  approval: `auto` | `ask`;
};

/** Five states, each needing different copy and a different user action. */
export type McpStatus =
  | { state: `connected`; tools: readonly string[] }
  | { state: `disconnected` }
  | { state: `needsAuth` }
  | { state: `missing`; wanted: string }
  | { state: `error`; detail: string };
