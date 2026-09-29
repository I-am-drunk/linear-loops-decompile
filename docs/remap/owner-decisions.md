# Owner decisions — the batched list (#295)

One file so the owner answers once. Each entry names the fork, the evidence,
and the options; the consuming ledger rows reference the entry number. Numbering
follows posting order on the #295 thread. Nothing here blocks shard research;
each entry blocks only the *implementation* of its consuming rows.

## 1. Credit meter family

First-party gates Loops behind credits (`FreeLoopCredit`, `LoopRunStats` cost
series, `RegisterLoopRunUsageCostTarget`, `/settings/usage/spend-limits/loops`,
the template-library free-credit badge). Self-hosted has no Linear billing.
Options: (a) meter surfaces OUT, run stats keep cost columns fed by our own
(fallback-brain/API) cost accounting; (b) full meter reimplemented over our
accounting. Consumers: R-RUNS stats header, R-TPL badge, §C rows, LoopLimitsPage.

## 2. Notification deep-link routes

`/:orgKey/loop/:loopId?notificationId=…` family — first-party inbox lives in
Linear (owner keeps using it), so our app receives no notifications. Options:
(a) routes resolve without notification context (redirect to run/loop); (b) OUT.

## 3. Org access gates

`Organization.canAccessAppAutomations` and friends have no public read
(exception: `Organization.agentAutomationEnabled` IS public but
[INTERNAL]-annotated — one-query probe once the #155 client exists;
`Organization.linearAgentSettings` + its input type likewise, which would let
workspace trust policy MIRROR first-party instead of forking to OURS).
Options per gate: (a) assume-enabled in our deployment (self-hosted implies
access); (b) probe-then-mirror where the public field answers.

## 4. Run retention

Our server owns all run/turn/part state (Finding 1). First-party retention is
invisible in the client bundle (OBSERVED/UNVERIFIED class). We must pick a
retention/pruning policy; the runs list paginates regardless.

## 5. MCP tool support in fallback-brain mode

The MCP family exists because Linear's agent executes MCP tools server-side.
With E1/BRIDGE on hold, fallback inference is the shippable brain — MCP tools
work only if OUR server ships an MCP client (connector registry, OAuth dance,
tool invocation, the approval flow pointed at our executor). Options:
(a) OUT initially — loops run tool-less on fallback; MCP surfaces render exact
not-available/blocked states; (b) ADAPT — our own MCP client behind the same UI
(large NEW server row family); (c) BRIDGE-only — MCP lights up when the goose
lands. The workspace MCP allowlist policy statics share this decision.
Consumers: R-GOV approvals, R-EDITOR connector section, §F MCP settings.

## 6. Fallback-brain memory access

Whether the fallback brain reads/writes `AiPromptMemory` rows (scratchpad
memories are produced by runs — OUR runs). Sub-question of #5's "what can the
fallback brain reach"; the harvester may merge. Consumers: R-GOV memories rows,
run engine.

## 7. Collaborative editing of loop drafts

The prompt editor is `CollaborativeEditor` (+`CollabEditing`) — first-party
drafts sync collaboratively through Linear infra we don't have. Options:
(a) local-only editing with our own draft persistence (same UI, no multiplayer —
the natural self-hosted answer); (b) build a collab backend. UI is EXACT either
way; the seam is `src/ui-store` draft persistence, and the ADAPT spec must
define what `forceSaveSnapshot` means over OUR store.

## 8. Prompt storage format

First-party stores the loop prompt as a ProseMirror document
(`WorkflowDefinition.prompt` + `DocumentContent`; memories/chat use the same
`bodyData` doc format — it is the product's lingua franca). Evidence says
**PM-doc-JSON at rest + `MarkdownTransformer`-shaped transcoding at the brain
boundary** is the only EXACT-compatible answer (markdown-only is lossy for
mentions/skills and breaks exact re-render), and the transcoder is
corpus-EXECUTABLE (markdown in → byte-compare doc JSON out), making this option
golden-verifiable. But it fixes our server schema, so it is ratified here, not
assumed. Constrains R-CONTENT, R-EDITOR, R-TPL (template instantiation must
emit the ratified format).

## 9. Editor file uploads

`EditorFileUploadManager` in the prompt editor — loop instructions can embed
uploaded files. First-party uploads to Linear storage; ours would need a NEW
server row (upload endpoint + storage + the URL shape PM nodes serialize), or
the feature is OUT initially.
