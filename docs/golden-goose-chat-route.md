# The golden-goose chat route — trace (issue #14)

The goose: Linear's normal AI chat route, driven by OUR loops server with the
user's own Linear account, so loops get the Linear-grade brain on the chat path
instead of the credit-metered loop path. This document is the trace of that
route. Facts only (op names, field names, enum values, behavior); no Linear
code. Every claim names its evidence.

Sources:
- **Corpus** — decompile of Linear 1.32.4 (2026-09-27 run; 1,550 chunks, 258
  GraphQL ops, 87 sync models), `pipeline/corpus/` (vault; never committed).
  Chunk hashes cited below are corpus file names.
- **Official** — MIT `linear/linear` schema @ `689ccc1e` (`master`, 2026-09-25),
  vendored in `extracts/linear-official/`. The 2026-09-25 schema added the full
  `AiConversation` type zoo (174 types), so most wire shapes below are
  cross-checked against MIT-licensed SDL, not just the decompile.

## Q1 — Which ops drive chat, and what streams the responses

**Send (the only way in).** `mutation AiConversationSendMessage($input)` on
`https://client-api.linear.app/graphql` → returns `{ success, lastSyncId,
aiConversation { id }, userMessage { id }, assistantMessage { id } }`.
There is NO create-conversation op: the first send implicitly persists the
conversation (the client holds an optimistic, non-persisted conversation until
then). (Corpus: `useSendAiMessage.B5bGsmqN.js`, `Issue.DRYymPCa.js`.)

`AiConversationSendMessageInput` fields, from the client's send hook:

| Field | Meaning |
|---|---|
| `conversationId` | Target conversation (omitted/placeholder on first send) |
| `userMessageId` | Client-generated message/turn id (idempotency handle) |
| `bodyData` | Message body — a ProseMirror document JSON |
| `prompt` | Optional prompt override |
| `context` | Pinned entity context: `[{ type: "Issue"\|"Project"\|"Initiative"\|"Cycle"\|…, id }]` |
| `issueId` / `projectId` / `initiativeId` / `documentId` / `pullRequestId` / `diffId` | Owning-entity links (one drives the conversation's owner) |
| `userId` | Set only for ephemeral/private-session sends |
| `resume` | Client always sends `true` |
| `rollbackToTurnId` | Edit/regenerate from a prior turn |
| `fallbackMode` | Behavior when the conversation is mid-stream: `steer` \| `queue` (client default for queued sends) \| absent = `fail` |

**Related ops (same route).** `AiConversationCancel($id)`;
`AiConversationSendElicitationResponses($input)` → `{ success, lastSyncId,
aiConversation, userTurn, assistantTurn }` (answers an elicitation turn);
`AddUserMessageToAiPromptProgress($progressId, $message)`;
list/hydration via `query AiConversationsQuery(first/after/last/before,
filter: AiConversationFilter)`. Debug surfaces (permission-gated, developer
toolbar): `aiConversationDebugThreadState { conversation, parts, threadState,
allContext, usageCalls }`, `aiConversationDebugExecutions`,
`debugAiConversationUsage`.

**Streaming.** Zero GraphQL subscription operations exist in the entire bundle
(0 of 258; re-verified 2026-09-27). After send, the client calls
`syncClient.waitUntilSyncId(lastSyncId)` and the response arrives over the sync
socket (`wss://sync.linear.app`, KNOWLEDGE §4):

- Subscribe: `{cmd:"streamData", action:"subscribe", modelName, modelId,
  propertyName, cursor}` (cursor = resume point; omit for fresh). Unsubscribe:
  same with `action:"unsubscribe"`. (Corpus: `RefreshManager.DpVjn8XM.js`
  `sendStreamSubscribe`.)
- Server → client chunks: `{cmd:"streamData", modelName, modelId, propertyName,
  data, cursor}`, folded into the model's streamable property via a reducer in
  cursor order (`applyStreamData` → `reduceStreamData`).
- What gets subscribed (corpus, model definitions in `Issue.DRYymPCa.js`):
  - `AiConversation.parts` — when `status === active`; tracks `iterationId`.
  - `AiConversationTurn.parts` — when feature flag `aiConversationTurnStreaming`
    is on AND `role === assistant` AND `status === active`.
- Negotiated at handshake: `useBinaryProtocol` and `compressionDictionaryVersion`
  are CLIENT-chosen. Omitting them means no zstd-dictionary and (to be confirmed
  by one live capture) plain JSON frames. That makes a minimal reader: hshk +
  subscribe + reduce, not an LSE reimplementation.

## Q2 — Auth: what the route rides

- Chat ops go to `client-api.linear.app/graphql` with `credentials: "include"`
  (cookies) plus headers: `Linear-Client-Version`, `Linear-Client-ID`, and the
  per-identity set — `user` (userId), `userAccount` (userAccountId),
  `organization` (organizationId), `authorization` (the session
  `authenticationToken`, sent as the raw header value). (Corpus: GraphQL client
  constructor + `setUser`, `RefreshManager.DpVjn8XM.js`.)
- The SAME `authenticationToken` is the sync-socket handshake `token`
  (`hshk`, protocolVersion 3 — KNOWLEDGE §4).
- The token is born at interactive login: anonymous mutations
  `emailTokenUserAccountAuth` / `samlTokenUserAccountAuth` (email-link code /
  SAML; Google OAuth rides redirects) return the user-account payload; optional
  `clientAuthCode` supports device pairing. There is no headless mint.
  Practical consequence (settings design, not a blocker): the user signs in once
  in a real browser; our server stores the token write-only, exactly like the
  Connect-Linear PAT field. Token lifetime/refresh semantics: **open
  live-capture item** (E1, needs the user's account).
- PAT/OAuth tokens for `api.linear.app` do NOT apply: the public API has zero
  `aiConversation*` root ops (re-verified on master @ 2026-09-25). The chat
  route exists only on the client API with user-session auth.

**How a loop turn maps onto the same ops.** A loop run is the same
`AiConversation` model with: `initialSource = workflow`, `workflowDefinition`
link set, entity `context = [{ type: Issue|Project|Initiative|Cycle, id }]`,
`status = pending` (corpus: `AiConversation.createWorkflowRun`). Normal chats
are the same model with `initialSource = directChat` (user-owned) or
`entityChat` (entity-owned; owner = the entity). Full enum (official schema):
`slack, microsoftTeams, mcp, directChat, entityChat, comment,
pullRequestComment, workflow, onboarding, subAgent`. The send mutation and
stream are identical for all sources — the source flag + links are the only
difference. (This is the structural core of the goose: one substrate, the meter
hangs on the wrapper — see Q4.)

## Q3 — Wire shapes of turn activities

Doubly sourced: official MIT schema (type zoo) + corpus (stream reducer
semantics). `AiConversation` carries `parts: [AiConversationPart!]` directly
(official) and `turns` (sync model: `AiConversationTurn { conversation,
position, responseToTurn, parts, status, role, user, externalUserId,
authorDisplayName }`).

**Part types** (official `AiConversationPartType`): `ack, elicitation,
elicitationResponse, error, event, prompt, reasoning, text, toolCall, widget,
widgetPlaceholder`.

**Stream chunk vocabulary** (corpus reducer): `text`, `textDelta`, `reasoning`,
`reasoningDelta`, `toolCall`, `widget`, `elicitation`, `widgetPlaceholder`;
a chunk with status `discarded` removes the part. `textDelta`/`reasoningDelta`
carry **ProseMirror step arrays** applied to the part's `bodyData` (a
ProseMirror doc JSON) — text streams as document steps, not raw token strings.
Rebase path: parts matched by `id`, replaced from the first diverging index.
Every part carries `metadata { turnId, startedAt, endedAt, phase, evalLogId,
feedback }` (official `AiConversationPartMetadata`).

**Part payloads** (official types): PromptPart `{ body, bodyData, user }`;
TextPart `{ body, bodyData }`; ReasoningPart `{ + title }`; ToolCallPart
`{ toolCall }`; ElicitationPart `{ kind: confirmation|entitySelection|
mcpServerConnection|multipleChoice, title, options[], entityType?,
suggestedEntityIds?, selection?, integrationId|serverUrl, scope? }`;
ErrorPart `{ message, errorType: billing|usageLimit|untrustedSources|unknown,
usageLimitScope?, usageLimitResetsAt?, retryResolution? }`; AckPart
`{ kind: done|ignored|skipped|waiting, summary? }`; EventPart `{ body, bodyData,
subscriptionId? }`. Widgets: EntityCard / EntityList / Setting.

**Conversation status** (official `AiConversationStatus`): `active,
awaitingInput, complete, error, pending, waiting`.

**The brain's tool vocabulary** (official `AiConversationToolCall` union — 48
members, all `AiConversation*ToolCall`): Bash · CodeIntelligence · ReadFile ·
ReadSandboxFile · CreateSandbox · SandboxGitHistory · CreateEntity ·
UpdateEntity · DeleteEntity · RestoreEntity · RetrieveEntities · SearchEntities
· WebSearch · SearchDocumentation · Research · Memory · InvokeMcpTool ·
RunLoop · SpawnSubagent · StartCodingSession · PromptCodingSession ·
ListCodingSessions · HandoffToCodingSession · GetSlackConversationHistory ·
GetMicrosoftTeamsConversationHistory · PostChatMessage · SearchChatChannels ·
GetPullRequestDiff · GetPullRequestFile · GetPullRequestCheckLogs ·
RetryPullRequestCheck · SuggestRepository · NavigateToPage · NotifyUsers ·
QueryView · QueryActivity · QueryUpdates · ReadSetting · SearchSettings ·
PatchSettings · SetSpendLimit · RemoveSpendLimit · SubscribeToEvent ·
UnsubscribeFromEvent · SuggestValues · TranscribeMedia · TranscribeVideo ·
ContactSupport.

Elicitation response data (official union): confirmation / entitySelection /
mcpServerConnection / multipleChoice.

For exact UI parity, our run view renders these part types and nothing else;
the per-type React renderers live in the corpus chunks
`LinearAgentMessages.BuUfncdI.js`, `AgentConversationItems.DoHFAP_d.js` (feature
matrix §D rows).

## Q4 — Where the credit/meter gate sits

- **Client-side send gate** (corpus, `sendUnavailableReason`): checks ONLY
  feature flag `privateEntityAgents`, guest user,
  `organization.isLinearAgentAccessible`, entity read-only, conversation
  archived. **No credit check on the send path.**
- Credit surfaces hang on the LOOP wrapper, not the chat route:
  `freeLoopCreditUsd`, `loopRunStats { amount }`, `LoopLimitsPage`,
  `RegisterLoopRunUsageCostTarget` (developer-toolbar registration).
- Server-side limits surface IN the chat wire format as data:
  `AiConversationErrorPart.errorType ∈ { billing, usageLimit, untrustedSources,
  unknown }` with `usageLimitScope ∈ { loop, workspace }` and
  `usageLimitResetsAt`. When a limit bites, the client learns via an error part
  on the conversation — that is the observable gate.
- Usage accounting exists per-conversation (`usageCalls` in debug thread state)
  and per feature (`UsageFeature ∈ { linearAgent, codingAgent,
  agentAutomation }`); official schema now also exposes `usageAlert(s)` root
  queries. Tracking ≠ billing.
- **UNVERIFIED (needs the user's account, E1):** whether a chat-source
  (`directChat`/`entityChat`) conversation actually bills credits server-side on
  the user's plan. Experiment: snapshot usage surfaces → send one directChat
  message and trigger one loop run → snapshot again → diff. Per the acceptance
  bar, this stays marked unverified until run.

## What our driver does with this (design pointer, not a spec)

- **v1, no socket:** our cron → `AiConversationSendMessage` (entity context per
  the loop target) → poll conversation state via `AiConversationsQuery` (and
  debug thread state where permitted) on our tick. No sync socket needed.
- **v2, live stream:** minimal sync reader — hshk (protocolVersion 3, omit
  `compressionDictionaryVersion` and `useBinaryProtocol`) → `streamData`
  subscribe on `AiConversation.parts` (status `active`) and, when flagged,
  `AiConversationTurn.parts` → run the parts reducer → done at terminal
  `status`. Bounded module; NOT an LSE slice.
- **Open live-capture items (user's account):** token lifetime/refresh;
  JSON-frame acceptance when binary/compression are not negotiated; concrete
  `cellName` / `clientDatabaseId` / client-id handshake values; whether
  `initialSource: workflow` sends are accepted for our account via client-api
  (if yes, even Linear's own run bookkeeping works through us; if no, the
  driver uses `directChat`/`entityChat` and keeps loop bookkeeping ours — the
  goose thesis either way).

---

Trace by sess_01a0e2c4-a88f-730b-acee-8188d527c324, 2026-09-27. Corpus:
Linear 1.32.4 (2026-09-27 run). Official: `linear/linear@689ccc1e` (master).
