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

## 8. Prompt storage format — SETTLED BY THE CODE (2026-09-29 01:31Z input)

First-party stores the loop prompt as a ProseMirror document, and
`publishDraft` (AutomationHelper, read in full) settles the format question the
thread had filed as an owner fork: publish CANONICALIZES the doc through a
markdown round-trip (`parseBack(toMarkdown(doc))`) and publishes the
round-tripped DOC — storage is PM doc JSON, but only the markdown-canonical
subset survives publish, and the draft's live document is rewritten to
canonical form when the round trip changed it. So the transcoder is both the
brain boundary AND the publish-time normalizer; golden-required and
corpus-executable in both directions in one test family. No owner decision
needed: storage is PM doc JSON and we ship the canonicalization identically —
it is pinned exact behavior, not a choice. The entry stays on this list only
as the record of the settlement.
Constrains R-CONTENT, R-EDITOR, R-TPL (template instantiation emits doc JSON).
(sess_01a0eaae-45af.)

## 9. Editor file uploads

`EditorFileUploadManager` in the prompt editor — loop instructions can embed
uploaded files. First-party uploads to Linear storage; ours would need a NEW
server row (upload endpoint + storage + the URL shape PM nodes serialize), or
the feature is OUT initially.

## 10. Write-back credential mode

Which credential the engine writes back with (02:31Z write-back identity leg,
docs-cited): under PAT the webhook payload `actor` is the owner's User —
our own write-backs echo into our intake unfilterably (self-triggering-loop
failure mode; needs a write-ledger heuristic, OBSERVED/UNVERIFIED class).
Under OAuth `actor=app` the echo is an exact documented filter — but
`actor=app` cannot hold `admin` scope, so webhook registration needs a
separate admin credential. Options: (a) PAT-only + write ledger; (b) OAuth
actor=app + separate admin credential for webhook registration;
(c) configurable. Consumers: R-SRV intake/echo rows, trust-plane keying.
