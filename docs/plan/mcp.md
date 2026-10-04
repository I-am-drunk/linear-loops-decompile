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

- **Transport**: stdio (local command) or **Streamable HTTP** (remote URL).
  Streamable HTTP is the current remote transport; the legacy HTTP+SSE
  transport is deprecated in the spec, so we implement it only as a
  compatibility fallback if a server we care about still requires it.
- **Scope**: `user` or `workspace`. A workspace server is shared; a user server
  is private. When both exist under one name, the automation's explicit
  `serverId` wins; absent that, prefer the scope the automation asks for.
- **Tool allowlist**: an automation may expose all of a server's tools or an
  explicit subset. Default is explicit — a tool should be granted, not
  inherited.
- **Approval**: `auto` or `ask`. `ask` surfaces the call for confirmation
  before it executes.

## Two security rules, stated before anything is built

Both come from the runner being the thing that connects: it has the filesystem
and the network, and it runs on a schedule with nobody watching.

**A stdio server is arbitrary code execution, so treat it as one.** The config
holds a command the runner will execute. Therefore: only a workspace admin may
register or edit a stdio server (an ordinary member may *use* one that exists);
the command runs isolated from the runner — separate process, no inherited
environment beyond an explicit allowlist, its own working directory, a wall
clock limit; and a run records which server it invoked. A deployment that wants
no local execution at all can disable the stdio transport outright.

**Never send credentials in cleartext.** A remote server with any auth beyond
`none` must be `https://`; the runner refuses to dispatch to `http://` with
credentials attached rather than warning about it. `http://` is permitted only
for an unauthenticated server on a loopback address, which is the local-dev
case this exception exists for.

**A configurable URL the server fetches is an SSRF primitive.** TLS protects
the credential in transit; it does nothing about *where* the runner is
pointed. Since the runner sits inside the deployment's network, a remote entry
is a request to reach any address its host can:

- **Destinations are deny-by-default.** Public unicast only. Private and
  special ranges are refused — loopback, link-local (including
  `169.254.0.0/16`, so cloud metadata endpoints), RFC1918, CGNAT, multicast,
  and their IPv6 equivalents — unless the deployment explicitly allowlists a
  host.
- **Resolve, check, then connect to the address you checked.** Validating a
  hostname and then reconnecting by name re-resolves and loses the check (DNS
  rebinding). Re-validate every redirect hop the same way, or refuse
  redirects.
- The loopback exception above is **opt-in per deployment**, not the default,
  precisely because loopback is the most valuable SSRF target.
- Registration is **admin-only for any non-allowlisted host**, matching the
  stdio rule: a member may use entries that exist, not point the runner
  somewhere new.

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
