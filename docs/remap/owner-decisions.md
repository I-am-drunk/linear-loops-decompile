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

## 11. Triage Intelligence (productIntelligence) surfaces

From the #295 triage-plane input (2026-09-29, sess_01a0ede8-f9a3-7388-9e07-86b812b9cda3).
The suggestion-rules lattice (`TriageSuggestionAutomationRules.BGxPADBW.js`,
mounted by the workspace `/settings/ai/triage` page and the team triage
settings page) configures Linear's server-side Triage Intelligence: rules in
`AiPromptRules.settings.productIntelligence.automationRules` with an
inheritance/tombstone algorithm (team → parents → org, overrides tombstone via
`disabledInheritedAutomationRules`). Two-source finding: the public
`AiPromptRules` type is a five-field stub (id/timestamps/updatedBy — no
`settings`, no `type`, no relations; no create/update mutation; `AiPromptType`
is `[Internal]`), so the plane is OURS if shipped, and the suggestions
themselves are produced by intelligence we do not have. Options:
(a) **OUT** — not Loops; the parallel-to-Linear use case leaves triage in
first-party Linear (recommended); (b) IN-as-rendered-stub — ship the settings
UI writing to our store with no consumer; (c) ADAPT — feed the rules into our
own inference harness (a NEW server capability, not a remap).
Two residues ship regardless of the choice: the WorkflowDefinition type
lattice + `resolveTypeForTrigger` conversion kernel (loops-core —
`src/loops-type-lattice`, golden-backed), and the `triageAutomation`
settings-chrome surfaces already dispositioned via the 14:31Z chrome-fork
kernel. Consumers: R-T (team-settings scope), the type-lattice OUT rows below.

## 12. CSS delivery (how our server ships stage-1 CSS)

From the three settled style-delivery legs (#295 inputs 14:38:00Z,
14:53:41Z, 15:29:08Z, 2026-09-29; digest §3.8). The corpus stylesheet
(`style-YZZHHG9P.css`, 565,310 bytes) is Linear's compiled asset — vault-only,
never committable — but the loops-family demand subset (~17 KB of rules,
414–442 classes depending on family glob; demand lists must be GENERATED per
the denominator lesson) is enumerable, and each atomic class is a pure
`class → declaration` fact, the same fact category as copy strings and theme
tokens already committed in goldens. Options:
(a) **Facts-file + generator** (recommended by all three legs): commit
`css-facts.json` rows (`{class, decl, media?, pseudo?, context?}` plus the
`varDecls` family — 245 `--sx-*` custom properties of which 145 are
runtime-injected theme values and 100 carry literal or data-attr-conditioned
defaults that must ship or ~40% of the var plane silently falls back wrong);
our build emits an equivalent stylesheet. Exact class names are load-bearing
(baked into transcribed classNames). The stylex naming law is EXECUTABLE
(`sx-` + murmur2_32(seed 1) base36, from Meta's MIT `@stylexjs/babel-plugin`;
3,618/4,403 plain atoms reproduce byte-exact), which upgrades (a) to
derive-and-check: the extractor recomputes the hash per fact row as a canary,
with `defineConsts` aliases (254) and const-media atoms (418) closed-listed
and flagged `const-derived`. Preserve the `.sx-x.sx-x` specificity doubling
and the `sx--default-marker` cross-chunk contract verbatim.
(b) Re-derive names as our own hashes: breaks byte-identical className
transcription, adds a mapping layer, buys nothing. Recommend against.
(c) Semantic rewrite (our own class names): violates the exactness bar and
makes every transcription lossy. Recommend against.
Per-slice subset rule under (a): a slice ships only the classes its
transcribed chunks demand; a coverage-tool leg asserts every className
literal in shipped UI resolves in css-facts.
**This entry gates A1 (foundation kit).** Consumers: A1, the R-STYLE shard,
`tools/parity` css-facts leg, R-SEAM (the 9 non-`sx` shell layout vars).

## 13. Notification generation

From the settled notification legs (#295 inputs 14:41:10Z, 14:42:39Z,
2026-09-29; digest §3.7). The four `agentAutomation*` notification types are
ALWAYS priority-inbox in first-party, but the public API has **no
notification-create mutation** — we cannot inject into the owner's Linear
inbox (this also settles the cost side of decision #2: our app receives no
notifications from Linear either). The copy-builder kernels themselves are
already merged golden-backed (`src/notif-copy`) and render wherever run
outcomes render. Options:
(a) **OUT-chrome** (recommended): no notification surface of our own; the
runs list and run detail are the INTENDED display path for the exact
failure/response/user-message copy via the merged kernels (`src/notif-copy`),
but no runs-list/run-detail consumer exists in `src/` yet, so that integration
is unverified until the R-RUNS views ship and wire the builders;
`metadata.agentAutomationFailure`/`agentAutomationRun`
payload shapes remain R-SRV's run-outcome event schemas.
(b) Our own in-app notification surface (bell/inbox): a NEW server + UI row
family (store, read-state, grouping keys — the grouping contract is
server-side: per-conversation vs per-day-bucket vs per-definition), exact UI
per corpus. Deferrable; nothing else consumes it.
Consumers: R-RUNS rows, R-SRV run-outcome events, decision #2 cross-ref.
