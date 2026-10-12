# Linear Agent MCP system — live end-to-end capture (2026-10-12)

All verified live on the reps_hardhat257 workspace. **The free Linear Agent executes arbitrary tools from your own MCP servers.** This is the automation platform: free agent + custom tools = free agentic automation.

## The verified loop
1. Stood up a minimal MCP server (raw JSON-RPC, streamable HTTP 2025-06-18 transport, no auth) on iris, tools: `get_weather`, `add_numbers`. Exposed via cloudflared quick tunnel.
2. Connected it with ONE mutation, no auth:
   `mutation IntegrationMcpServerPersonalConnect($serverUrl: String!) { integrationMcpServerPersonalConnect(serverUrl: $serverUrl) { integration { id } lastSyncId } }`
   → integration id, service = `mcpServerPersonal`
3. Agent message "use the get_weather tool for Toronto" → agent emitted:
   `toolCall { name: "InvokeMcpTool", args: { tool: { name: "get_weather" }, server: { name: "iris-test-mcp", title: "iris-test-mcp", integrationId: "<id>" } } }`
   → Linear's backend called my tools/call → my answer ("22C sunny") → agent reported it.
4. Second tool `add_numbers(128,256)` → "384". Natural-language routing across tools works.

## Tool invocation anatomy (captured from AiConversationTurn parts)
- `InvokeMcpTool` — args: `{tool: {name}, server: {name, title, integrationId}}`
- Built-in tools captured earlier: `CreateEntity {type,count}→{createdEntities}`, `UpdateEntity`, `DeleteEntity`, `RestoreEntity`, `StartCodingSession`, `PromptCodingSession`, `PostChatMessage`, `SpawnSubagent` (spawns sub-conversation!), `SubscribeToEvent`, `UnsubscribeFromEvent`
- Turn part types seen: `prompt`, `text` (phase=answer), `toolCall`, `widget` (EntityCard {id,type,action})

## Connect mutations (from the web bundle)
- **Personal**: `integrationMcpServerPersonalConnect(serverUrl!, mcpServerDefinitionId, customHeaders: [McpServerCustomHeaderInput!])`
- **Workspace**: `integrationMcpServerConnect(serverUrl!, teamId, workflowDefinitionId, workflowDefinitionDraftId, mcpServerDefinitionId, customHeaders)` — per-team scoping, can attach to Loop workflows
- **OAuth dance** (only when the server requires auth): `discoverMcpOAuth(mcpUrl!, mcpServerDefinitionId, integrationId) → {type: ok|needs-auth, authorizationUrl, redirectUrl, flowId}` → user authorizes → `completeMcpOAuth(flowId!, authorizationCode!, authorizationResponseIssuer, mcpUrl!, service!, integrationId, teamId, workflowDefinitionId, workflowDefinitionDraftId, settings)`
- `customHeaders: [McpServerCustomHeaderInput!]` = bearer/static auth for non-OAuth servers
- `reconnectMcpIntegration`, `workspaceMcpServerConnectionsDisconnectAll`
- Workspace model: `workspaceMcpServerConnections { serverUrl name iconUrl documentationUrl disabled disabledReason connections { id userId teamId createdAt } }`

## Connector directory (Linear-hosted MCP offers)
Notion, GitHub, Slack, Sentry, Datadog, Intercom, Stripe, HubSpot, Attio, Glean, Granola, PostHog, Jam — each with overview/useCases/docsUrl in `McpConnectorDirectoryDialog`.

## MCP-in-Loops
`workflowDefinitionMcpApprovalUpdate` + `McpApprovalInput` — MCP servers attach to Loop workflow definitions with an approval model (`conversationAccess` on connections). `mcpAllowlist*` config: allowlist with OAuth client creds + redirect URL.

## Skills (mapped same day)
`AgentSkill { id, title, description, body, icon, color, shared, archivedAt, createdAt, updatedAt, creator }`; `agentSkillCreate(input:{title!, body!})` works via API. Invocation: slash-action inserts a mention node in the message bodyData; `?skill=<id>` URL param on the agent page preloads one. Team skills vs repository skills collections.
