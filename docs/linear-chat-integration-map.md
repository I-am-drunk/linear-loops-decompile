# Linear chat protocol integration map

Inspected 2026-10-12. This is an optional inference-provider investigation for
IN #316, not the IG public-API adapter, a shipped provider, or a pricing claim.
Our server continues to own automations and runs. No account credentials or
vendor implementation are included.

## Evidence and confidence

`SOURCE` means inspected interface facts, not a successful authenticated request.
`LIVE` means an observation recorded in the [experiment ledger](linear-chat-experiments.md)
or the versioned live checkpoint in §8.
`DESIGN` means our proposed adapter contract. `UNVERIFIED` is an acceptance gap.
Exact artifact hashes are in
`tools/linear-chat-probe/evidence/sources.json`; assets remain in ignored
`pipeline/corpus/client/`. Byte ranges there refer to UTF-8 bytes, not lines.

| Ref | Source and relevant locator |
|---|---|
| S1 | Official MIT SDL `extracts/linear-official/schema.graphql`, upstream `689ccc1e905d`, retrieved 2026-09-27; `AiConversation*` definitions |
| S2 | `Issue.DRYymPCa.js`: `AiConversationSendMessage`, conversation/turn models, part reducer |
| S3 | `useSendAiMessage.B5bGsmqN.js`: send input construction, cancellation, entity gates |
| S4 | `RefreshManager.DpVjn8XM.js`: GraphQL headers, login, socket, sync dispatch |
| S5 | `Decorators.Du6V7UQY.js`: stream-property cursor, subscription and rebase lifecycle |
| S6 | `aiConversationSendElicitationResponsesMutation.CEPAjw5J.js`: response input serialization |
| S7 | `archive/2026-09-era/research/golden-goose-chat-route.md`: historical pilot, not independent live evidence |

S2–S6 are the pilot's September artifact family, re-fetched on 2026-10-12.
The current login page references a different family; targeted October facts
are identified separately below. Do not silently combine them into one version.
The [sync summary](../SPECS/sync-protocol.md) explicitly marks itself superseded;
[KNOWLEDGE §4](../KNOWLEDGE.md) and re-inspection take precedence.
The [static audit](linear-chat-static-audit.md) rechecks all 15 source artifacts,
adds SDL correlation/nullability facts, and corrects KNOWLEDGE's conflation
of the two compression gates. Those corrections take precedence over the
historical summary, not over future live observations.

## 1. Route

**SOURCE:** client GraphQL endpoint is `https://client-api.linear.app/graphql`.
Send uses `mutation AiConversationSendMessage($input: AiConversationSendMessageInput!)`
and field `aiConversationSendMessage(input: $input)` [S2, S4].

| Input observed in S3 | Meaning / limit of evidence |
|---|---|
| `conversationId` | Client-created conversation ID, supplied even on the first send; returned ID becomes authoritative |
| `userMessageId` | Client UUID, also optimistic prompt/turn ID; server deduplication guarantees are UNVERIFIED |
| `bodyData` | ProseMirror document JSON, not a plain prompt string |
| `context` | Array of entity references `{type, id}`; an empty array is allowed by the caller |
| `userId` | Supplied only for the private-session branch, not every user-owned chat |
| `documentId`, `projectId`, `initiativeId`, `issueId`, `pullRequestId`, `diffId` | Optional ownership links from the selected entity |
| `prompt` | Optional override passed by the caller; server interpretation is UNVERIFIED |
| `resume` | Caller supplies `true` |
| `rollbackToTurnId` | Optional edit/regenerate anchor |
| `fallbackMode` | `queue` or `steer`; caller omits it for fail behavior |

S2 additionally sends `assistantMessageId` when steering an already queued
message. This is not required by the ordinary first-send path. The full private
input SDL, field nullability and default values are **UNVERIFIED**: S1 contains
output types, not `AiConversationSendMessageInput`.

The selected response is `{success, lastSyncId, aiConversation:{id},
userMessage:{id}, assistantMessage:{id}}` [S2]. S3 waits for `lastSyncId`, then
hydrates the returned conversation. It does not wait for generation to finish.
S3's ordinary new-chat path does not issue a separate create mutation.
This does **not** prove that no create operation exists for workflow runs.

Related operations [S3, S6, S7]: `aiConversationCancel(id: String!)` returns
`success` and `aiConversation.id`; elicitation submission returns `success`,
`lastSyncId`, `aiConversation.id`, `userTurn.id`, `assistantTurn.id`.
S7 records `AddUserMessageToAiPromptProgress`, `AiConversationsQuery`,
`AiConversationDebugThreadState`, `AiConversationDebugExecutions` and
`DebugAiConversationUsage`. Debug operations are not a required polling API.

**Pilot corrections:** the first send does carry a generated conversation ID.
`initialSource` is a model field marked `persistence:none` [S2], and is absent
from S3's send input. A local `workflow` enum value is not evidence that
`initialSource: workflow` is accepted by the send mutation.

**Polling boundary (SOURCE + UNVERIFIED):** October
`AutomationRunsPage.zzvjxXpz.js::AiConversationsQuery` [S8] queries
`aiConversations(first, after, last, before, filter)`, selecting only `nodes.id`
and `pageInfo {endCursor, hasNextPage, hasPreviousPage, startCursor}`.
Its observed filters are `workflowDefinitionId.eq`, `initialSource.eq`,
`status.neq`, and `and`. It then calls model hydration; S7's assertion that this
query already retrieves response content was too strong.
The probe proposes selecting S1's `status`/`parts` through the same root and
filtering `id.eq`. Those two extensions are **UNVERIFIED** until accepted live.
It preflights that exact selection before sending, so incompatibility causes
zero messages. Do not replace a rejected query with an invented public API.

## 2. Minimal streaming reader

**SOURCE:** socket base `wss://sync.linear.app`; URL parameters `userId` and
`userAccountId`. The client also negotiates compression through
`syncCompression=zstd-v1`. The first text-frame envelope is [S4]:

```text
{cmd:"hshk", userId, userAccountId, clientType, flagClient,
 clientDatabaseId, protocolVersion:3, clientVersion,
 releaseChannelOverride?, supportsSpectatorMode:true, cellName?, token?}
```

For the JSON experiment, omit `useBinaryProtocol`,
`compressionDictionaryVersion` AND the `syncCompression` URL option.
This is an **experiment**, not verified server support: S4's production client
sets `useBinaryProtocol:true` and switches its sender to MessagePack after
authentication. Its receiver accepts JSON strings. Absence of zstd negotiation
alone does not imply JSON; uncompressed MessagePack is a separate possibility.

Wait for server `cmd:"hshk"` with `sync`, not merely WebSocket open [S4].
The stock callback checks refresh instructions, database version, sync groups
and catches up to `lastSyncId`; a minimal reader must still hydrate a baseline
and observe model status updates. `streamData` alone is not a completion feed.

Subscribe with `{cmd:"streamData", action:"subscribe", modelName, modelId,
propertyName:"parts", cursor?}`; unsubscribe uses the same routing fields,
`action:"unsubscribe"`, no cursor. Replies carry `{cmd:"streamData", modelName,
modelId, propertyName, data, cursor}` [S4].
Subscribe to `AiConversation.parts` while conversation status is `active`,
resetting the stream when `iterationId` changes; `AiConversationTurn.parts`
requires the `aiConversationTurnStreaming` flag, assistant role and active
turn status [S2]. Missing baselines require hydration before reduction.

S2/S5 reduction contract:
- Full `text`, `reasoning`, `toolCall`, `widget`, `elicitation` chunks replace
  the part with the same ID, or append it if absent.
- `textDelta`/`reasoningDelta` contain ProseMirror `steps`, not token strings.
  Apply to the matching type/ID's `bodyData`; missing/wrong-type targets are
  ignored by this client. Metadata is retained; reasoning title can change.
- `status:"discarded"` removes a part. `widgetPlaceholder` adds/updates a
  placeholder, but its `completed` chunk removes it.
- On stored/streamed divergence, compare the common prefix, remove displaced
  IDs and overlay changed streamed parts onto stored parts. Do not concatenate
  full snapshots or replay already-applied document steps.
- The wrapper queues chunks **in arrival order** and stores the last processed
  cursor. It does not sort cursors. Cursor ordering/type, replay boundaries and
  deduplication guarantees remain UNVERIFIED; treat cursors as opaque.

S4 sends ping every 20 seconds, handles pong, and retries `noauth` once within
a two-minute window before signaling authentication failure. It uses bounded
quadratic reconnect delay and 30-minute idle disconnection. `refresh` is a
client/model refresh instruction, not a token-refresh response.
DESIGN: reconnect from a known baseline/cursor, never resend a turn merely
because the socket closed. On unknown binary frames, cursor gaps or unsupported
steps, stop streaming and rehydrate through a verified poll adapter.

Terminal distinction [S1, S2]: conversation `complete`/`error`; assistant turn
`completed`/`interrupted`/`error`/`canceled`. `pending`/`active` continue.
`awaitingInput` and `waiting` suspend progress, not success. A completed part
or `ack:waiting` is not a completed turn. Confirm the target turn and refresh
the stored snapshot before declaring completion.

S1's `parts` is nullable and its metadata has a required `turnId`; use that
correlation, not all conversation text. S1 contains no `AiConversationTurn`
type: the turn lifecycle above comes from S2, not official turn SDL.
S4 also gates binary prefix decoding on `compressionDictionaryVersion`;
without it binary bytes remain untouched before MessagePack decoding.
The separate URL compression gate is decoder-support/previous-failure based,
not the same feature-flag check. See the static audit for exact byte ranges.

## 3. Authentication and lifetime

**SOURCE [S4]:** GraphQL uses `credentials:"include"` and
`Linear-Client-Version`, `Linear-Client-ID`, `user`, `userAccount`,
`organization`. When supplied, `authenticationToken` becomes the raw
`authorization` header value (no automatically added `Bearer` prefix), and
the same optional value becomes the socket handshake's `token`.
Token-only Node access, without browser cookies, remains **UNVERIFIED**.

S4 contains anonymous email-code and SAML login mutations, including
`emailTokenUserAccountAuth(email, token, timezone, inviteLink?, clientAuthCode?)`.
However, their selected account payload contains identity/workspace fields,
**not an authenticationToken or expiry field**. The pilot does not establish
the birth of an exportable session token. Cookie issuance, any token bootstrap
exchange, token lifetime, renewal/rotation and revocation semantics all remain
**UNVERIFIED**. `refreshStateSync` reloads account/workspace state; it is not
evidence of credential renewal. Never substitute the one-time email code.

`cellName` is read from local database metadata and may be updated from
handshake sync data; `clientDatabaseId` is the local database identity [S4].
`Linear-Client-ID` comes from Logger's persisted random/browser-suffixed client
identifier [S9: `Logger.qFaEBF6-.js::clientId`], not a user or organization ID.
There is no separate `clientId` field in S4's handshake object. Concrete
account-specific values are UNVERIFIED; dictionary example strings are not
observations. The [ledger](linear-chat-experiments.md) gives capture steps.

S1 has no `aiConversation*` root query/mutation and no private send input type.
This proves the pinned public schema lacks the route, not that every possible
PAT/OAuth request was tested and rejected. Public OAuth refresh rules from
`docs/plan/integrations.md` must not be applied to client-session credentials.
The public integration and chat-session connection remain separate.

## 4. Automation and approvals

**SOURCE:** S2 creates a local workflow-run model with `initialSource:workflow`,
`workflowDefinition`, context and `status:pending`. October
`ContextualMenuActions.BGc-ueTA.js` [S10] persists that model with `save`;
it does not call the normal chat send hook to start the run. The exact generated
creation mutation and workflow entitlement are still UNVERIFIED.

**DESIGN:** keep our run ID distinct from remote conversation ID, user-message
ID, assistant-turn ID and iteration ID. Save this mapping before/after sending.
Use direct/entity chat only after capability validation; label it truthfully,
without pretending it is a provider-native workflow run. Context references
must belong to the connected identity's authorized workspace.

The run view needs these wire activities [S1/S2], not just one text string:

| Parts | Rendering / handling contract (DESIGN) |
|---|---|
| `prompt`, `event`, `text` | Render document content safely; distinguish user, event and assistant |
| `reasoning` | Optional separate provider-authored activity; do not fabricate absent content |
| `toolCall` | Typed provider tool status/result; never execute the remote tool again locally |
| `widget`, `widgetPlaceholder` | Entity card/list/setting views or explicit unsupported placeholder |
| `elicitation`, `elicitationResponse` | Visible pending decision and attributed response |
| `error` | Preserve error type, usage-limit scope/reset, retry-resolution metadata |
| `ack` | Preserve `done`, `ignored`, `skipped`, `waiting`; not necessarily text |

S1's part enum includes `widgetPlaceholder`, but its `AiConversationPart` union
does not include a placeholder object type. Account for transient S2 chunks
without inventing a GraphQL fragment. Unknown variants must not be treated as
successful empty answers. S1's tool union is not a local MCP tool registry.

S6 sends `{conversationId, userMessageId, responses, bodyData?, context?}`.
Each response has `elicitationId` plus exactly one data wrapper:
`{multipleChoice:{selectedOptionIndex}}`, `{confirmation:{confirmed:true}}`,
`{entitySelection:{selectedEntityIds}}`, or `{mcpServerConnection:{integrationId}}`.
The observed confirmation encoder hardcodes true: a decline payload is
**UNVERIFIED**, not safely inferred as false. Never auto-approve an elicitation.
DESIGN: pause the run, bind approval to identity/run/turn/elicitation, and submit
one explicit decision. MCP connection requests go through settings authorization.
Decline/cancel behavior needs a captured supported operation before enabling it.
Upstream tools may act under the Linear session; local MCP approvals cannot
enforce policy over those remote actions. Advertise that limitation.

## 5. Credits and usage

S3's entity send gate checks feature flag, guest role, agent accessibility,
read-only entity and archived conversation. It has no local credit check.
This says nothing about server billing. The historical feature matrix's
stronger “gate lives on the wrapper” claim must not be used as a pricing fact.

S1 exposes `AiConversationErrorPart.errorType` values `billing`, `usageLimit`,
`untrustedSources`, `unknown`; nullable `usageLimitScope` is `loop|workspace`,
with nullable `usageLimitResetsAt` and `retryResolution`. Inspect parts even
when HTTP and GraphQL succeeded. Usage errors are data, not just HTTP 429.

October `usageSummaryQuery.Cwh-K3cU.js` and
`usageLimitSpendQuery.q4QxRErw.js` [S11] expose period bounds, `dataEnd`,
per-feature `amountUsd`, and subject-window USD totals. These are measurable
accounting surfaces; they do not alone establish payable charges or free usage.
**E1: UNVERIFIED**. No sacrificial account, sends, before/after values or
observed debit exist in this session. Exact staged comparison, aggregation-lag
handling and no-spend boundaries are in the experiment ledger.

## 6. Server adapter boundary

**DESIGN, transport not implemented:** put the Linear chat adapter behind the inference
registry, never behind the entity/action integration. Keep auth, remote IDs,
capability probing, deadlines and redaction private to that adapter.
The existing `src/inference/types.ts` contract is text-only; like
[T3 Code Connect](plan/t3-code-connect.md), the adapter must prove its actual
wire protocol before claiming compatibility. Do not invent models, context
windows, token usage, prices, temperature or max-token support.
The shared [protocol adapter contract](linear-chat-adapter-contract.md) now
defines interfaces in `src/inference/protocol.ts` for both Linear chat and
T3 Code Connect. It remains separate from the text-only registry: no adapter
is enabled, and no runtime policy enforcement or compatibility is claimed.

**v1 poll:** validate connection and candidate query first; persist generated
IDs and submit one mutation; poll fresh snapshots by returned ID, correlate
parts to the returned assistant turn, and stop on a correlated terminal result.
An empty/missing snapshot is not completion. Awaiting-input yields a suspended
result, not an empty `ChatResult`. Report unknown usage with `known:false`,
and unknown cost with `known:false`, not a known zero.
The standalone probe implements this candidate path, not registry integration.

**v2 stream:** same send and snapshot boundary, plus negotiated socket reader,
per-property baselines/cursors and idempotent local event IDs. Snapshot fallback
must be proven before it can rescue unsupported stream chunks. Extend the
shared provider/run contracts for typed parts, suspension and cancellation;
do not announce streaming through today's text-only interface.

| Adapter failure (DESIGN) | Treatment |
|---|---|
| No credential / rejected authentication | `unconfigured`; expose reauthentication state; no automatic credential guessing |
| Permission or entitlement refusal | `rejected`; do not bypass it using another source flag |
| HTTP/GraphQL rate limit | `rateLimited`; honor bounded retry metadata for safe reads |
| Part `billing` / `usageLimit` / `untrustedSources` | Preserve category; `rejected` at current registry boundary to prevent automatic fallback around a provider policy |
| Schema/unknown shape or unsupported part | Compatibility error, not a blank successful answer |
| Network/timeout before send | `unavailable`; safe to retry only known read operations |
| Network/timeout after send began | Unknown execution outcome; retain IDs and reconcile, never automatically resubmit or fall through to another provider |

GraphQL errors must be checked even on HTTP 200. The current registry's
availability fallback cannot safely represent an uncertain side-effecting
send: extend the contract or suppress fallback after dispatch.
Retries of send, queueing and rollback are disabled until server idempotency
is demonstrated. A timeout does not cancel provider work.
Cancellation is explicit `aiConversationCancel`, followed by status
reconciliation; loss of its response is not proof of cancellation [S3].
Never map a socket close directly to success or cancellation.

## 7. Settings connection design

Follow [settings](plan/settings.md) and [integrations](plan/integrations.md):
the public Linear OAuth/PAT connection remains under Integrations. Add a
separate experimental **Linear chat session** provider under Inference,
with a clear capability/verification status. Neither connection implies the
other works. This slice adds no UI and makes no new layout/exactness claims.

Proposed flow:
1. Explain that chat-session compatibility/entitlement differs from public
   OAuth. Start a real-browser Linear sign-in, never collect its password or
   email OTP in our settings UI.
2. Bind any eventual handoff to a short-lived one-use server nonce and the
   initiating settings session. A supported credential handoff/export flow is
   **UNVERIFIED**. Do not ship a fake OAuth callback, browser-storage scraper or
   automatic cookie import. Until verified, connection remains experimental
   and requires explicit local credential provisioning for the probe.
3. Validate identity, workspace and a read capability over the fixed TLS
   endpoint. A connection test sends no chat or billable workflow.
4. Store the credential encrypted server-side, write-only through the settings
   API; return presence, account/workspace label and status only. Never log
   headers, tokens, cookies, login codes or raw upstream error bodies.
5. Disconnect erases our stored credential and blocks new sends. Do not claim
   it revokes the upstream browser session unless that revocation is confirmed.

| State | Meaning and next action |
|---|---|
| `connected` | Credential validated for the selected workspace and supported protocol; show last verification time and capabilities |
| `expired` | Explicit expiry evidence or credential rejected with expiry confirmed; prompt browser reauthentication |
| `error` | Connectivity, permissions, schema incompatibility, or ambiguous authentication rejection; preserve sanitized reason |
| `revoked` | Local disconnect or confirmed upstream revocation; remove local secret and require a fresh connection |

Before configuration, show disconnected/unconfigured separately. HTTP 401
alone cannot distinguish expiry from revocation. Record known expiry if
provided, otherwise “unknown”; never assume a 24-hour browser-session lifetime.
Serialize any future refresh per credential and atomically replace it only
after verification. No refresh implementation is justified by current evidence.

Acceptance remains: sacrificial-account send/poll, E1, workflow creation,
JSON handshake, token birth/renewal/expiry, approval/decline and cancel/replay.
Passing local fixtures proves our probe mechanics, not those provider claims.

## 8. Live probe status

The original map at `24e088e` ended at §7. This table uses the probe owner's
E-labels from the [live checkpoint at e14591d](https://github.com/I-am-drunk/linear-loops-decompile/blob/e14591dc6bfc957814769ce6720f40effe96df36/facts/linear-chat-live-2026-10-12.md),
not an inferred numbering of the older experiment ledger. Probe ownership
remains with `live-linear-chat-probes`; this section consumes its evidence.
Checkpoint observations end at 2026-10-12 17:50:04.196 UTC, awaiting email code.

| Probe | Status | Evidence and remaining acceptance |
|---|---|---|
| E0 — token delivery and identity triple | **PARTIAL VERIFIED; authenticated portion OPEN / UNVERIFIED** | Live E0 records HTTP 200 and `success:true, authType:authToken` for the email challenge at 17:49:20.549 UTC; manual-code form at 17:50:04.196. Login HTTP client version `1.81129.0` observed, no challenge-response Set-Cookie names. Completion cookies, identity triple and authenticated read not observed. |
| E1 — direct-chat credit behavior | **OPEN / UNVERIFIED** | Live E1: zero sends, no before/after usage snapshots. Missing values are not zero usage. |
| E2 / E2b — JSON frames and minimal fields | **OPEN / UNVERIFIED** | Live E2: no authenticated socket; login HTTP version does not establish accepted socket version or account-specific fields. |
| E3 — token mint and first use | **OPEN / UNVERIFIED** | Live E3: no session credential observed; email challenge acceptance is not issuance. TTL/refresh need later observations. |
| E4 — workflow-style entity context | **OPEN / UNVERIFIED** | Live E4: zero context/source-flag sends; no acceptance evidence. |
| E5 — send-time selection | **OPEN / UNVERIFIED** | Live E5: no send or input introspection; `promptPresetKey` and model selection not established. |

Only E0's named login steps can move from open to verified at this checkpoint.
Do not mark an entire probe verified from fixtures, source schemas, or a
blocked experiment. For each later update, pin the facts commit and retain
the observed time, inputs, result and limitations. Cancel/replay, approval
decline, token expiry and actual registry integration remain separate
acceptance gaps even if these six probes eventually pass.
