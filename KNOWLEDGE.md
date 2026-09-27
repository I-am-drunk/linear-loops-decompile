# KNOWLEDGE - verified by decompiling Linear 1.32.4 (2026-09-26)

Ground truth from the session that created this repo. Method: downloaded the macOS app,
extracted the Electron asar, then crawled the ENTIRE production web client (1,550 chunks,
29.2 MB) from static.linear.app and read the minified code directly. §=section; specs in
`SPECS/` build on this. Nothing here is guesswork; where something is inference it says so.

## §1. Desktop app (thin shell - no loops inside)

- DMG: `https://releases.linear.app/mac` → `Linear-1.32.4-universal.dmg` (213 MB, HFS+,
  extract with 7z on Linux; it prints a header error but extraction works).
- `Linear.app` = Electron (`NSPrincipalClass=AtomApplication`), universal x86_64+arm64.
- `Resources/app.asar` is only **775 KB** - `@linear/desktop@1.32.4`, deps: `@electron/remote`.
  It contains: auto-updater (electron-updater/Squirrel.Mac, feed releases.linear.app),
  window/tab/menu management, Sentry, notifications, deep-link routing, terminal launcher.
  **No loop/agent logic whatsoever.**
- The window loads the REMOTE app: `entryUrl = https://linear.app/auth/desktop`
  (dev override `https://local.linear.dev:8080`). Non-app URLs are blocked via
  `will-navigate` and opened externally. `agent-loops` appears only in
  `REDIRECTABLE_ROOT_PATHS` (deep-link routing), alongside `agent`, `issue`, `project`, …
- `Info.plist` has `ElectronAsarIntegrity` (SHA256 of app.asar) inside the code signature →
  patching the asar requires editing the plist + ad-hoc re-signing, and auto-update reverts
  it. Pointless anyway (nothing to patch).
- Full IPC bridge (preload `ElectronBridge`, ~60 channels): tabs/windows/theme/dock badge/
  updater/file dialogs/notifications - and `runTerminalCommand` (see §5).
- Menu has "Agent chat…" (`desktop-create-agent-chat` → forwarded to the web app).

## §2. Web client bundle (where everything lives)

- Entry: `https://linear.app/login` (and `/auth/desktop`) loads
  `https://static.linear.app/client/assets/html.<HASH>.js` - Vite/rolldown build.
  BFS-crawling `assets/*.js` refs (`__vite__mapDeps`) yields the full app:
  **1,550 chunks, 29.2 MB. No source maps published.**
- **Single config module** (`config.<HASH>.js`) holds ALL endpoints as flat `VITE_*` consts
  (see `extracts/config-endpoints.md`). Key ones:
  `GRAPHQL_SERVER_HTTP=https://client-api.linear.app/graphql`,
  `SOCKET_SERVER_URL=wss://sync.linear.app`,
  `API_SERVER_URL=https://client-api.linear.app`,
  `CLIENT_URL=https://linear.app`, `ASSET_URL=https://static.linear.app/client/`,
  `START_SERVICE_WORKER=true`. Re-pointing the client = rewriting this ONE file.
- Client architecture: local-first **sync engine (LSE)** - models hydrate from
  `restModelsStream` HTTP endpoints + live updates over the sync socket (§4); mutations go
  out as GraphQL; plan/feature gating is evaluated CLIENT-SIDE from Organization fields.
- **Client-side gating** (Organization model getters):
  `isAgentAutomationsAccessible = agentAutomationEnabled && linearAgentEnabled`
  `isLinearAgentAccessible = linearAgentEnabled && canAccess(linearAi)`
  → any backend that syncs an org with these true unlocks the Loops UI. (We don't reuse
  their client; the lesson is: gates are data, not code.)

## §3. Loops (internal name: "agent automations")

- A **Loop = `WorkflowDefinition`** model. Plan feature keys: `agentAutomations` (Loops),
  `basicAutomations`, `loops`; UI string "Loops are available on Business and Enterprise
  plans" and "Loops requires Linear Agent to be enabled".
- `WorkflowDefinition` fields (full): `slugId, name, groupName, description, icon, color,
  type, trigger, triggerType, activationMode, intelligence, conditions, enabled,
  applyToSubTeams, editAccess, activities, schedule, triggerConfig, stats, organization,
  team, project, creator, owner, subscribers, sortOrder, lastUpdatedBy, lastExecutedAt,
  lastPublishedAt, policies, traits, integrations, aiPromptMemories, drafts, notifications,
  favorite, trustedSourceKeys, prompt, isBasicAutomation, effectiveOwner, effectiveTeamId,
  effectiveTeam, hasUnknownEffectiveTeam, runs`.
- Schedules: separate **`WorkflowCronJobDefinition`** (`name, description, enabled,
  activities, schedule, team, creator, sortOrder`) - server-side cron.
- Trigger model (from AutomationHelper): `triggerType` ∈ `schedule | chat | event-ish`;
  events carry `activationMode` ∈ `collectionChanged | watchedPropertyChanged`;
  conditions support `watchedProperties`, `collectionChange{property,operation}`,
  `commentMatch`; triage variants exist (`entityInTriage`). `defaultAutomationSchedule`
  exists; validation is zod (`$e.safeParse({type,event,activationMode,...})`).
- **A run = an `AiConversation`** with `initialSource: workflow`, plus
  `workflowDefinition`, `loopExecution`, `isWorkflowRun` set. `AiConversationInitialSource`
  enum: `slack, microsoftTeams, mcp, directChat, entityChat, comment, pullRequestComment,
  workflow, onboarding, subAgent`. **`LoopExecution`** joins run ↔ target:
  `aiConversation, workflowDefinition, issue, project, initiative, document, team, cycle,
  release`.
- Runs execute 100% server-side. Proof in client: debug queries
  `aiConversationDebugThreadState { threadState, allContext, usageCalls }`,
  `aiConversationDebugBraintrustUrl`, `evalLogId`; billing: `freeLoopCreditUsd`,
  `loopRunStats { totalRuns, stats { date, completedRuns, failedRuns, amount } }`.
  Braintrust = their LLM observability vendor. The brain CANNOT be swapped; there is no
  model/provider field anywhere in the loop config - verified.
- Loop routes: `/:orgKey/loop/:loopId/runs`, `/:orgKey/loop/:loopId/run/:runId`
  (+ `/agent-loops` deep-link path). Pages: `AutomationPage`, `AutomationRunsPage`,
  `AutomationsList`, `AutomationNewButton`, `AutomationInboxView`,
  `AutomationHistoryDialog`, `AgentAutomationConversation(Dialog)`, template library
  (`LoopTemplateLibrary`, with free-credit badge), workspace settings
  (`WorkflowAgentAutomationSettingsPage` = trusted sources + code access),
  team settings (`TeamAutomationSettingsPage`).
- Loop-level settings found: trusted trigger sources (allowlist external sources/integrations),
  code access via Code Intelligence (read) / Coding sessions (write): "Allow loops to
  access code… read code. Coding sessions also enables writing."
- Notifications for run lifecycle: `agentAutomationRunResponse`,
  `agentAutomationUserMessage`, `agentAutomationFailedToRun`, `agentAutomationDisabled`.

## §4. Sync protocol (LSE) - documented so we know what we are NOT building

- Socket `wss://sync.linear.app`; handshake `{cmd:"hshk", userId, userAccountId,
  clientType, clientDatabaseId, protocolVersion:3, clientVersion, useBinaryProtocol:true,
  compressionDictionaryVersion, supportsSpectatorMode:true, cellName, token}`; then
  `sync` messages (model deltas, lastSyncId), `ephm`/`ephp` (ephemeral), `streamData`
  (AI streaming), `presence`, `ping/pong`, `noauth`.
- Compression: zstd with a server-sent dictionary (`syncCompression=zstd-v1`, dictionary
  SHA256-pinned, frames declare content size; 64 MB cap). Binary frames: `[type][dictVer]
  [payload]`, type 0 = raw, 1 = zlib-dict-compressed; inner payload is a custom packer
  (records off, bundleStrings off).
- Mutations: client transactions → GraphQL `mutation <Model>{Create,Update,Delete,Archive}`
  built per model class; batched; offline queue with rollback; lock-timeout/ratelimit
  retries. Hydration: `restModelsStream(path, {lastSyncId, clientDatabaseId})`.
- **We replace all of this with T3 connect** (SPECS/t3-connect.md): our UI and server are
  both ours, so a small typed WS RPC + server-authoritative SQLite is sufficient.

## §5. Agent sessions & coding harness (adjacent system - reuse ideas)

- `AgentSession` fields incl. `appUser, issue, comment, sourceComment, status, startedAt,
  endedAt, summary, displayTitle, modelSelection, agentActivities, externalUrls, plan,
  availableSkills, pendingElicitation, queuedActivities, codingEnvironment,
  lastTerminalActivityId…`. `AgentActivity`: `agentSession, content, signal,
  signalMetadata, ephemeral, sourceComment, contextualMetadata, pushSummary, queued,
  executionSkippedReason, sentAt, user, pullRequestCommentIds`.
- Coding session harnesses shipped: **`claude` (Claude Code), `codex`, `openSource`**
  (open-weight, behind feature flag `openWeightModels`). Workspace picks via
  `codingAgentSettings { model, effort, commitSigningEnabled, sandboxSize, regionPinning }`.
  Developer override: command-palette "Override coding session model"
  (`developerCodingAgentModelOverride`); reset via `AgentSessionRestartWithDefaultModel`.
- Model IDs seen in client: `claude-opus-5-5, claude-opus-5, claude-opus-4-8, claude-opus-4-7,
  claude-sonnet-5, claude-sonnet-4-6, claude-fable-5-1, gpt-5.6-luna/sol/terra, gpt-5.5,
  gpt-5.4, gpt-6-astra, gpt-6-luna, gpt-6-sol, glm-5p3, glm-5p3-flash, kimi` (+`auto` prefs
  per harness). Sandbox sizes: Small 1vCPU/8GB, Medium 2/16, Large 4/32. Sessions expose
  `AgentSessionSshAddress`, `AgentSessionSandbox`, `AgentSessionCodingHarness(ModelLabel)`.
- Workspace `linearAgentSettings = { webSearchEnabled, mcpServersEnabled, mcpServersMode,
  mcpServersAllowlist }` - MCP connectors are workspace-level for Linear Agent + Loops.
- Desktop "open in coding tool" hook (the one real local extension point):
  `~/.linear/coding-tools.json` → `{openIssue:{path,args[],env[]}}`; allowlisted commands
  `amp|claude|codex|opencode|custom`; template vars `{{prompt}} {{workDir}}
  {{issue.identifier}} {{issue.branchName}} {{project.name}} {{pullRequestComment.id}}`;
  env mapping `LINEAR_PROMPT, LINEAR_WORK_DIR, LINEAR_ISSUE_IDENTIFIER,
  LINEAR_ISSUE_BRANCH_NAME, LINEAR_PROJECT_NAME, LINEAR_PULL_REQUEST_COMMENT_ID`;
  launches via Terminal/Ghostty/Warp/iTerm (mac) or PowerShell (win). First run scaffolds
  an example config and opens it in `$EDITOR`.

## §6. Linear public API facts (for our dataplane)

- Public API: `https://api.linear.app/graphql` - PAT (Settings → API) or OAuth2; personal
  keys act as the user. Rate limit ≈ 2,500 req/h/user (batch + budget). Webhooks
  configurable per workspace for issue/comment/project/etc. changes.
- The CLIENT's API (client-api.linear.app) is the sync frontend - not for us.
- Agent API (Developer Preview, changes possible): custom agents appear as workspace
  agents; `AgentSessionEvent` webhooks on mention/delegate; `agentSessionCreateOnIssue` /
  `agentSessionCreateOnComment` for proactive sessions; activities (thought/action/
  elicitation/response/error) update the native session UI. This is the sanctioned path if
  we later want runs to show up inside real Linear too.

## §7. Process facts

- Linear ships the client continuously; chunks are content-hashed. Expect drift; R1
  re-verifies counts on each refresh (1,550 chunks / 87 models / 258 ops @ 2026-09-26).
- The marketing site (linear.app homepage) is a SEPARATE build (`/web/_next/static/`,
  ~535 chunks) - plan features/pricing strings live there (`agentAutomations: "Loops"`).


---

## §8. The chat substrate (2026-09-27 corpus re-verification; the golden goose)

- Loop chat and normal AI chat are the SAME substrate: `AiConversation` carries both
  `workflowDefinition` and `loopExecution` links plus an `isWorkflowRun` flag
  (models.json). A loop run IS an AiConversation.
- Sending a message is ONE mutation: `AiConversationSendMessage(input)` returning
  `success`, `lastSyncId`, `aiConversation.id`, `userMessage.id`,
  `assistantMessage.id`. Related ops: `AiConversationCancel`,
  `AiConversationSendElicitationResponses`, `AddUserMessageToAiPromptProgress`,
  `AiConversationsQuery`.
- **Zero GraphQL subscriptions exist in the entire 1,550-chunk bundle.** Turn
  streaming arrives over the LSE sync queue (`wss://sync.linear.app`; the
  `lastSyncId` acknowledgement model, SPECS/sync-protocol.md). To reproduce the
  chat exactly we reproduce the sync-channel consumption, not a subscription API.
- The credit gate lives on the loop/workflow side
  (`RegisterLoopRunUsageCostTarget`, `FreeLoopCredit`, `LoopLimitsPage`), not on
  `AiConversationSendMessage` itself. Whether send is credit-gated server-side for
  loop-linked conversations remains an open probe question (issue #14).
- 2026-09-27 re-run of the pipeline on Linear v1.32.4: 1,550 chunks, 258 ops,
  87 models, zero drift vs the 2026-09-26 baseline.

## Drift log (two-source cross-check, COORDINATION §9)

- **2026-09-27 (sess_01a0e2c4-a88f-730b-acee-8188d527c324):** CORRECTION + full
  official-docs drop. The morning's "byte-identical — zero drift" was a BRANCH
  ERROR: upstream `linear/linear` has a stale `main` branch (schema 885 KB) and the
  default branch is **`master`** (schema 1,335 KB, @ `689ccc1e`, 2026-09-25).
  Re-checked against master: schema grew 485→723 types, 72→129 enums, 337→402
  inputs, 463→526 root ops (+63 new, −4 removed: `asksWebSettings*`, `fetchData`);
  SDK documents 577→671 ops. Headlines: (1) the full `AiConversation` type zoo —
  174 types incl. unions `AiConversationPart`/`AiConversationToolCall`/
  `AiConversationWidget`/`AiConversationElicitationResponseData` — is now in the
  MIT schema, so goose wire shapes (issue #14 Q3) are officially documented;
  (2) still ZERO public chat-driving root ops (send/stream stay client-only —
  §8 stands) and zero `workflowDefinition*` root ops (Loops internals stay
  decompile-only); (3) newly official: `agentSkill` CRUD, `agentActivitySendQueued`/
  `DeleteQueued`, `agentSessionSandbox`/`SshAddress`/`RestartWithDefaultModel`,
  `usageAlert(s)`, full Releases surface, initiative labels, SLA configs. Digest
  updated in `extracts/linear-official/AGENT-API.md`; upstream `docs/`, package
  READMEs, and the full SDK changelog now vendored in `extracts/linear-official/`
  (pin: master, see its README for the refresh recipe).

- **2026-09-27 (agent-04@gen6):** R1 drift-watch re-check. `schema.graphql` +
  `_generated_documents.graphql` re-fetched from `linear/linear@main`:
  **byte-identical - zero drift.** Live `linear.app/developers/agent-interaction`
  re-read against the digest: 6 session states, 5 emittable activity types,
  signals, `externalLink` deprecation - all match. Digest completeness delta FIXED
  in `extracts/linear-official/AGENT-API.md`: op inventory 9 → **12**
  (+ `agentSessionCreate`, `agentActivityCreatePrompt`, `issueRepositorySuggestions`),
  plus Agent Plans (tech preview) and ephemeral activities. Consumers flagged on
  hub #59: T-305 (#90) + T-504 (#97). `WorkflowDefinition` still has zero public ops.

- **2026-09-27 (agent-01@gen4):** Linear's OFFICIAL Agent Sessions surface is public
  (Developer Preview) and vendored at `extracts/linear-official/` (MIT): schema +
  577 ops + digest. Convergence with this file's decompile-derived model: session
  states 5/6 exact (official adds `stale`; our runtime's `canceled` is the delta -
  fix tracked), activity types 5/6 exact (`prompt` = inbound by design). The 9
  official agent ops are unimplemented (the #14 gap, now fully documented).
  `WorkflowDefinition` IS in the official schema as a type but has **zero public
  queries/mutations** - Loops internals remain decompile-only; this file's "the
  brain is server-side / loops config not exposed" conclusion STANDS.
