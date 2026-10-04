# MCP per automation

The headline feature. Each automation carries its own set of MCP servers, so
one automation can reach GitHub and another can reach a database, without a
global tool soup.

Built from the **open Model Context Protocol specification**
(`modelcontextprotocol.io`) and its published SDKs. Nothing here derives from
any vendor's client; MCP is a public standard and that is the whole point.

## Model

A workspace keeps a **server registry**. An automation references servers from
it and configures per-automation overrides.

```
McpServer        id · name · transport · url|command · auth · scope · enabled
McpServerAuth    kind: none | bearer | oauth2 | header
AutomationTool   automationId · serverId · allowedTools[] | all · approval
```

- **Transport**: stdio (local command) or HTTP/SSE (remote URL). The spec
  defines both.
- **Scope**: `user` or `workspace`. A workspace server is shared; a user server
  is private. When both exist under one name, the automation's explicit
  `serverId` wins; absent that, prefer the scope the automation asks for.
- **Tool allowlist**: an automation may expose all of a server's tools or an
  explicit subset. Default is explicit — a tool should be granted, not
  inherited.
- **Approval**: `auto` or `ask`. `ask` surfaces the call for confirmation
  before it executes.

## Connection status

Every server reference renders one of five states, and each needs its own copy
because they need different actions from the user:

| State | Meaning | Action offered |
|---|---|---|
| connected | handshake succeeded, tools listed | — |
| disconnected | configured, not currently reachable | retry |
| needs auth | reachable, credentials missing or expired | connect |
| missing | the automation references a server not in the registry | set up, or pick another |
| error | handshake failed for another reason | show the error, retry |

**missing** is the state that matters most and is easiest to forget: an
automation is portable (duplicate, copy-as-JSON, import), so it will routinely
reference a server this workspace does not have. It must degrade visibly, not
silently run tool-less.

## Resolution

When an automation names a server, resolve in this order: explicit `serverId`
→ exact name within the requested scope → exact name in any scope → missing.
Name matching is case-insensitive. Lists sort by name.

## Our server does the work

The MCP client lives server-side, in our runner. Rationale: automations fire on
a schedule with no browser open, so tool execution cannot depend on a client
session. The UI configures; the runner connects, lists tools, invokes them, and
streams results into the run transcript.

This resolves open decision #5 (MCP tool support), which previous sessions left
to the owner across three options. The Cursor-style layout makes MCP central
rather than optional, so option (b) — our own MCP client — is the only one that
delivers the page we are building.

## Slices

| Slice | Scope |
|---|---|
| MCP1 | registry model + settings CRUD (server-side) |
| MCP2 | client: stdio + HTTP transports, handshake, `tools/list` |
| MCP3 | status lattice + the five rendered states |
| MCP4 | per-automation tool selection UI |
| MCP5 | invocation in the runner + transcript streaming |
| MCP6 | oauth2 auth flow |
