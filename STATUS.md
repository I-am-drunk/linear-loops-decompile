# STATUS: the board

Updated in the same PR as the work it describes. If this file and an issue
disagree, the issue is fresher; fix this file.

**Phase: ASSEMBLY ERA — 60% UI / 40% harness (owner directive 2026-09-28,
issue #295; supersedes the 70/30 terms of the PR #256 freeze-exit ack).**
Effect:
(a) **60% of collective effort goes to BUILDING the UI** — a runnable
assembly track (`docs/remap/` + PLAN.md A-track) composing golden-backed
modules plus corpus-informed non-golden slices, served by src/server;
**~80% of shipped UI work does NOT need to be golden-backed** — the
transcription rule + seam rule in the remap ledger are the anti-R3.4 bar for
that 80% (corpus-transcribed structure/copy cited per chunk, owner-licensed
changes only in seam implementations on the closed seam list);
(b) ~40% stays on the harness (T2 render / T3 store tiers, corpus-exec modes,
coverage ledger) with goldens concentrated on the exactness-critical core:
wire ops, theme/tokens, trigger/schedule/policy semantics, value-laden
algorithms and degraded states per the remap ledger's golden-required test;
(c) **scope widens beyond the Loops page** (SPECS/product-contract.md):
Settings first-class, Workspaces adapted (the context Loops needs), Teams
adapted (team-SELECT only) — the product runs in parallel to Linear, every
loop feature through the public API where a public surface exists
(`docs/remap/README.md` records the settled data-plane findings);
(d) E1 (the live golden-goose chat experiment) remains explicitly NOT started;
PAT/OAuth remains the data plane.
The freeze-exit audit trail (PR #256, conditions 1–5) is preserved in the
2026-09-28 Done section below. The progress meter is the coverage ledger's
golden count PLUS the remap ledger's disposition coverage — not merged-PR
volume.**

Done 2026-09-27:
- Archive: all swarm-era code preserved at tag `archive/v0-swarm-era`; PRs
  #124/#129/#131/#133 closed unmerged (branches kept); coordination docs moved to
  `archive/swarm-era/`.
- Golden goose corrected (issue #14): the prize is Linear's normal AI chat route,
  not the Agent Sessions API.
- R0 docs reset: README, AGENTS, PLAN, this board; skills rewritten as
  `boot`, `ship`, `github`.
- R1 pipeline: `bash pipeline/run.sh` runs end to end (Linear v1.32.4: 1,550
  chunks, 258 GraphQL ops, 87 models, zero drift vs baseline). Corpus ships to
  drift check only.
- Official-docs drop: Linear's MIT `linear/linear` docs, package READMEs, SDK
  changelog, and a schema refresh vendored in `extracts/linear-official/`
  (PR #138) — incl. the correction that upstream's DEFAULT branch is `master`
  (a stale `main` branch produced a false "zero drift" on 2026-09-27 morning).
- Official-docs gap closed (2026-09-27): the vendored upstream `docs/*.md` turned
  out to be one-line stubs — the real docs moved to linear.app/developers. Fact
  digests of the live pages (rate limiting incl. RATELIMITED-on-400 + all budget
  headers, GraphQL auth-header shapes, pagination/filtering, webhooks contract +
  HMAC verification, OAuth token lifecycle) now live in
  `extracts/linear-official/docs-site/`; KNOWLEDGE §6 rewritten from them; the
  audit's UNVERIFIED flag on `src/server/linear.ts` rate headers resolved.
- Golden-goose trace (issue #14, PR #141): Q1-Q4 answered in
  `docs/golden-goose-chat-route.md` + KNOWLEDGE.md §8a — send op + input fields,
  streamData subscribe envelope, auth, wire shapes (now MIT-documented), meter
  placement. Remaining: E1 live experiment on the user's account.
- R2 feature matrix: `docs/feature-matrix.md` enumerates every Loops feature with
  corpus evidence; KNOWLEDGE.md gained §8 (chat substrate: loop chat IS normal
  chat; zero GraphQL subscriptions, streaming rides the sync queue).

- R3.1 transport slice: `src/connect` (zero-dep RFC 6455 framing + JSON-RPC,
  in-band auth, events; 3/3 tests, gate green).
- R3.2 boot slice: `src/server` (http + static + descriptor + persisted session
  token + node:sqlite store + append-only audit; 4/4 tests + real boot smoke).

- R3.3 settings vertical (server half): settings.get/setLinear/clearLinear/
  setInference/deleteInference/testInference + dataplane.probe. Write-only
  secrets, credential-header refusal, duplicate-name rejection; 8/8 server
  tests with an injected fake fetch.

- R3.4 UI shell: BUILT then FAILED the exactness audit (docs/audit-2026-09-27.md
  F1/F2: invented tokens + invented IA); ARCHIVED 2026-09-28 per #200 (claim +
  two peer concurrences; tag `archive/r3.4-ui-shell` = pre-delete main
  277bbf3). `src/ui` deleted; ci/check-ui.sh passes vacuously until the first
  golden-verified UI slice ships WITH ui-facts.json. The server halves
  (R3.1-R3.3) stand; the R3.3 Settings RPC layer survives untouched.

- R5.1 dataplane client: `src/server/linear-client.ts` — one GraphQL code
  path for api.linear.app with a header-driven rate budget (gate before
  firing on an exhausted window, 429/Retry-After + RATELIMITED mapping, FIFO
  concurrency cap; budgets never hardcoded — headers are the truth).
  probeLinear promoted onto it; new read-only `dataplane.rateBudget` RPC.
  Queued requests re-read credentials at dispatch, honoring replacement or
  removal while waiting; both paths have deterministic fake-fetch regressions.
  Header semantics verified against Linear's official docs (KNOWLEDGE §6);
  9 client tests + 1 RPC test, all fake-fetch. (Pulled ahead of R4: R4.1's
  page waited on the R3.4 shell; this slice is server-only, was unblocked.)
  Follow-up: RATELIMITED retry delays use the response's exhausted windows,
  including endpoint/complexity resets, with seven regression cases and a
  delayed-body credential-swap check. HTTP 429 fallbacks and preflight failures
  now use the same exhausted-window calculation: simultaneous exhaustion waits
  for the latest reset, and missing/expired endpoint resets do not borrow a
  healthy global window. Nine additional fake-fetch regressions cover this.
  Complexity-limited 429s also backfill missing/expired resets from Retry-After
  so preflight blocks until that delay expires. Three fake-fetch cases cover
  missing, expired, and preserved future resets, including gate reopening.
  Simultaneously exhausted request windows now receive the same Retry-After
  backfill even when an endpoint or complexity window is exhausted too. Six
  fake-fetch cases cover missing/expired request resets and future-reset
  preservation, including refusal after the other window resets and reopening.

Now:
- R4.1 loops domain slice: server half claimed by sess_01a0e392-f0c2-7545-
  b2f2-2c2c875485f3 (issue #150; two later duplicate claims #151/#152 should
  move on per AGENTS.md earliest-keeps-it). loops.list/upsert/publish/
  setEnabled over the store + the loops list page wired live;
  src/model gains loop.ts. Next unassigned: R4.2 loop detail + editor blocks.

Done 2026-09-27 (evening, freeze-era):
- Feedback gate (user directive, #175/#182 merged): NO merges with unaddressed
  CodeRabbit/peer feedback; ruleset enforces review-thread resolution on main;
  AGENTS.md + ship skill carry the rule and the pagination recipe.
- Pipeline route extraction fixed (#174, PR #181 merged): analyze.mjs also scans
  `/:orgKey/…` chunk literals; routes 119 -> 490 unique paths on 1.32.4, incl.
  `/:orgKey/loops/:viewType?`.
- Vault corpus verified COMPLETE at HEAD 6dcc083 (1,550/1,550 pretty chunks; the
  "507 missing" alert on #162 measured a stale local copy — re-clone before
  trusting partial extract numbers; vault fetch = full git clone + count check,
  #187 merged).
- H4 official-docs leg LANDED: per-page live-site digests in
  `extracts/linear-official/docs-site/` (#184, #190 merged; #197 folds in
  #191's remaining pages + the sitemap completeness bar; #186/#191 close with
  credit per the #183 dedupe). KNOWLEDGE §6 now officially sourced (incl.
  HTTP-400 + RATELIMITED exhaustion — constrains PR #155).
- Review-queue burn-down: #169 (KNOWLEDGE §4/§5/§6 corrections + sync-protocol
  supersession), #172 (EXACT-reproduction wording), #173 (merged-PR feedback
  ledger fixes) all merged.

- H1 parity harness P1 MERGED (#171 + #188 + #189; #180 closed superseded):
  `tools/parity` extract+check on the ten fact families, policy tolerances +
  improvements.json, copy+route canaries, `ci/check-ui.sh` (vacuous without
  cargo; CHECK_UI_STRICT=1 opt-in). Extract reproduced by 4 sessions on the
  complete vault corpus: 38 surfaces · 43 routes · 857 copy · 657 edges ·
  137 tokens, canaries 7/7.

USER DIRECTIVE 2026-09-27 (late, issue #220): the parity compare-DNA is
corrected. Grammar-extracted set-compare (routes/copy/…/states) DEMOTES to
drift-canary tier; the ACCEPTANCE bar is now hand-verified golden tests
computed by executing the corpus code (#215 pattern, generalized). Plan-of-
record: #220 (G0 spec claimed by sess_01a0e4cb-0cdc-7797-b503-a67080b81c96;
G1 corpus-exec LANDED 2026-09-28 (#230+#233+#234 squashed to main `78a9f69`:
run/verify + invoke/render modes, RAW `corpus/client` as the executable
authority with source-flavor provenance, injective serializer — Date/undefined/
key preserved, non-plain objects a loud typed error; 27/27 incl. the raw-tree
corpus smoke, six reviewer verifications), G2 coverage ledger LANDED 2026-09-28
(#237: tools/coverage — matrix x corpus-manifests x goldens ->
golden|improvement|GAP per surface + off-matrix table; corpus-free `coverage
check` wired as a never-vacuous ci/check-ui.sh leg; ui-theme reference
manifest), G3 theme retrofit (claimed sess_01a0e4ca-cd60), G4 first
rendered-component golden LANDED 2026-09-28 (src/ui-loops-icons:
AgentAutomationEmptyStateIcon darkDefault — corpus-executed, hand-verified vs
source, serializer-v2 bytes, TZ/locale-invariant; the pattern every rendered
slice copies) with its CLEAN REIMPLEMENTATION landed the same day (pure
theme->host-element-tree module, byte-matches the golden through the
tagged-v2 serializer as the declared observation driver; corpus-manifest joins
the G2 ledger: first golden-backed chunk on the meter, 78 chunks · 1 golden ·
77 GAP; lightDefault pair case added same day — the pair pins token flow). G5
second golden-backed chunk LANDED 2026-09-28 (AutomationsEmptyStateIcon,
same matrix row: render-tier via the G1 micro-dispatcher — useReducedMotion
stubbed false, static branch only, the isAnimated gradient branch explicitly
out of scope until the T2 renderer — darkDefault+lightDefault golden pair +
clean reimplementation; meter: 78 chunks · 2 golden · 76 GAP). G6 third
golden-backed chunk LANDED 2026-09-28 (LoopViewType, matrix §A loop view
types: zero-import pure-value chunk, first real DRIVE-mode golden — the
driver projects the module surface: enum + label map + validator probes;
with G4 invoke and G5 render this completes a worked example of all three
case modes; meter: 78 chunks · 3 golden · 75 GAP). G9 fifth golden-backed
chunk LANDED 2026-09-28 (src/ui-loops-elicitation: AgentElicitationResponseQueue
— the FIRST golden outside §A, on the §D chat substrate (Elicitations row):
drive-mode flatten of a hook-free composite closure (corpus Flex/Text executed,
0 stubs, 11 chunks), three parametrizations pinning both label branches +
the static class/var chain; clean reimplementation byte-matching; meter:
78 chunks · 4 golden · 74 GAP). G10 sixth golden-backed chunk LANDED
2026-09-28 (src/ui-loops-dialog: AutomationNewDialog, matrix §A new-loop
dialog + button — first golden through the DERIVED-theme seam:
`(useTheme().baseTheme ?? theme).elevatedTheme()` pinned from the H2 elevated
goldens, both derivation branches covered by the darkDefault/lightDefault
pair; five declared component-seam stubs (Modal/ThemeProvider/IconButton/
CloseIcon/LoopTemplateLibrary — each stays its own ledger row); invoke-tier
per the G4 finding; clean reimplementation byte-matches through the tagged-v2
driver; meter: 78 chunks · 5 golden · 73 GAP; G7/G8 in flight by peers).
G7 seventh golden-backed chunk LANDED 2026-09-28 (src/agent-session-review:
canOpenAgentSessionInReview — the first PURE-BEHAVIOR golden (no React) and
the first §E chunk on the meter (PR integration row): drive mode, one fixture
per corpus branch + negative pins (no store read on the no-PR path, userCan
never consulted while reviews are disabled) + an argument-identity pin
(store.user object + literal 'review'); one throw-on-other-reads stub at the
helper seam pinned from its hand-verified raw source; clean reimplementation
byte-matching; reclaimed after the 03:27Z claim went silent ~10h with no
branch; meter: 78 chunks · 6 golden · 72 GAP). G8 eighth golden-backed
chunk LANDED 2026-09-28 (src/ui-loops-creation-tracker: LoopCreationTracker,
matrix §A AI-assisted loop compose — the FIRST stateful/behavioral golden:
drive-mode class lifecycle with declared ClientStorage/uuid stubs and the
clock pinned through the driver; pins the six analytics events + payloads,
idempotence guards, templateKey gating, the 7-day expiry filter and the
100-entry cap; clean class byte-matching via the replayed lifecycle; taken
over stale per the 13:16Z precedent; meter: 78 chunks · 7 golden · 71 GAP).
G12 ninth golden-backed chunk LANDED 2026-09-28 (src/ui-loops-coding-agent:
CodingAgentModelSelect — the FIRST §E Coding-harness golden: drive-mode
statics on the raw tree, five declared stubs (Issue model-layer enums pinned
verbatim + throw-on-unpinned; render-only boundary throws if rendered);
pins the repo label github.com-vs-other-host branch, sandbox-size copy,
harness labels/order, autoPreference incl. its throw message, the
harness→icon identity mapping, and the nine settings description strings;
clean reimplementation byte-matching through the declared serializer-v2
driver, 7/7 tests; out of scope and still honest GAP regions: isAvailable,
the non-ZDR description branch, the observer component; meter:
78 chunks · 8 golden · 70 GAP). G11 tenth golden-backed chunk LANDED 2026-09-28 (src/ui-settings-guidance:
AgentGuidanceSettings export n — the FIRST §F Settings golden: drive-mode
projection of the settings-metadata factory, both scope branches + the
strict-equality discriminator + the applicable predicate over five declared
org fixtures; the observer component export t stays GAP pending the T3
store-fixture tier; meter: 78 chunks · 9 golden · 69 GAP). G13 eleventh
golden-backed chunk LANDED 2026-09-28 (src/ui-loops-owner-select:
AutomationOwnerSelect export t, matrix §A Owner select — drive mode through
the render-prop seam (the tooltip's render prop invoked with a pinned
content marker): both appearance branches (property default / inline) + the
disabled-configure action branch (disabledReason via the AutomationHelper
seam pinned from its hand-verified raw source — its 50KB closure reads
window at module scope, the G7 finding); component seams as declared string
markers; the restore-history hook export n stays honest GAP pending a
T2/effect tier (dialog side effects + async draft IO); clean
reimplementation byte-matching; meter: 78 chunks · 10 golden · 68 GAP). G14 twelfth golden-backed chunk LANDED 2026-09-28
(TeamAgentSkillsSettingsPage, matrix §F Team agent settings — second §F
golden, confirming the G11 scouting that §F settings pages share the
metadata shape: drive-mode verbatim projection of the pure pageMetadata
literal (no scope param, no applicable member — both pinned) + the Component
export's module-eval displayName; six declared stubs incl. the
suspenseObserver module-eval wrapper (a new seam in the pattern library);
reimplementation joins src/ui-settings-guidance with per-chunk goldens; the
route component body stays honest GAP; meter: 78 chunks · 11 golden ·
67 GAP). G15 thirteenth
golden-backed chunk LANDED 2026-09-28 (src/ui-loops-elicitation-wire:
aiConversationSendElicitationResponsesMutation — the FIRST golden on the §D
chat-substrate WIRE layer (Elicitations row, issue #14 adjacency): drive-mode
with a recording fake client; pins the full mutation document bytes, all four
kind branches incl. the hardcoded confirmed:true quirk, per-response
{elicitationId,data} narrowing vs top-level input passthrough, and the REAL
UnreachableCaseError default; enum + gql-tag stubs pinned verbatim from raw
source, throw-on-unpinned; matrix Elicitations row gains the caller chunk as
evidence per the ledger's fix direction; meter: 79 chunks · 12 golden ·
67 GAP). G16 fourteenth
golden-backed chunk LANDED 2026-09-28 (src/ui-agent-chat-banner:
useHydrateAgentConversations export n — the 'Editing message' banner, third
§D golden (Conversation list/hydration row): the G9 hook-free flatten with
the edit-icon seam as a declared marker; exports r/t (editing-state hook,
hydrate effect) stay declared GAP regions behind linking-only throwing
stubs; clean reimplementation byte-matching; meter: 79 chunks · 13 golden ·
66 GAP). G17 fifteenth golden-backed chunk LANDED 2026-09-28
(TeamAgentConnectorsSettingsPage, §F Team agent settings row's connectors
sibling — the G14 recipe verbatim: pure pageMetadata literal + module-eval
displayName, drive-mode verbatim projection, six declared stubs (both
wrappers mobx, no suspenseObserver — minor seam variation recorded);
reimplementation joins src/ui-settings-guidance; route component body honest
GAP; scouting note: TeamAgentsSettingsPage is NOT this recipe (metadata
embeds a descriptionElement JSX fragment + a sections map calling the G11
factory at module eval — needs a jsx-capturing stub or T2, stays GAP);
meter: 79 chunks · 14 golden · 65 GAP). G18 sixteenth golden-backed chunk
LANDED 2026-09-28 (TeamAgentsSettingsPage pageMetadata, fourth chunk of the
§F family — the 'blocked' jsx-fragment metadata recipe proven T1-coverable:
the REAL corpus jsx-runtime builds the descriptionElement fragment at module
eval (declared {fragment:[children]} projection; DocsLink seam as a marker
with href/children in the byte oracle, the href pinned from the raw Issue
chunk literal), and sections.agentGuidance is the OUTPUT of the REAL
golden-backed G11 factory executing inside the golden — the first
cross-chunk provenance chain; page-component exports declared honest GAP
(T2); this recipe unblocks CodingAgentSettingsPage.lcMyXnM7.js (same
fragment + sections shape); meter: 79 chunks · 15 golden · 64 GAP).
G19 seventeenth golden-backed chunk
LANDED 2026-09-28 (src/ui-settings-sections:
WorkflowAgentAutomationSettingsConstants — first golden on the §F Workflow
automation settings row: the settings section/card/row primitives, ALL FIVE
exports covered in one drive-mode case (ten parametrizations: section
title/untitled/accessory, card flush + sx composition, labeled row both
sides of the [!!divided<<0] computed-member class trick + the labelFor
ternary + optional description, description row divided/undivided, the
agent-automation-permissions anchor); corpus Flex/Text executed real (G9
flatten), the three hook/forwardRef CMA seams as declared markers (G13);
clean reimplementation byte-matching, 6/6; matrix row's brace-form token
`WorkflowAgentAutomationSettings{Constants,Page}` expanded to the two real
chunk names — it parsed as NO chunk evidence, hiding both from the
denominator (the #270 matrix-gap class, second instance); meter:
81 chunks · 16 golden · 65 GAP). G20 eighteenth golden-backed chunk LANDED
2026-09-28 (CodingAgentSettingsPage.lcMyXnM7.js export r — the coding-sessions
settings metadata, matrix §F Coding agent settings: the G18 jsx-fragment
recipe on the harder sibling, a THREE-chunk cross-provenance chain (the
golden-backed G12 CodingAgentModelSelect statics and the real
CommitSigningWorkspaceSetting execute inside the golden; the reimplementation
composes from our golden-backed helpers); Fragment via the declared
projection, DocsLink href pinned from the raw Issue literal (wJ as Ci); the
three applicable closures probed (flag seam scripted both ways + flag-key
identity, the two-feature conjunction pinned incl. agentAutomations-first
ask order, environments granted/denied); observer components declared GAP
(T2/T3); meter: 81 chunks · 17 golden ·
64 GAP). G22 nineteenth golden-backed chunk LANDED 2026-09-28
(src/ui-loops-template-launcher: useLoopTemplateLauncher export r — first
golden on the §A Template library + launcher row: the template-card
presenter statics in drive mode; pins the full trigger-copy switch
(Hourly/Daily/Weekly + On new issue/On triage/On issue change + both
UnreachableCaseError throw paths executing REAL) and the icon-color pipeline
(toCss RGB ∘ fromCss on hex + lch() fixtures, plus the fromCss [0,0,0]
fallback for out-of-grammar formats — real corpus ColorConverter executes,
provenance chains to the H2 goldens; the reimplementation composes our
golden-backed src/ui-theme color math); seventeen linking seams as declared
throw-on-use bombs (the G20 wide-linking pattern); exports n/t (builders,
launcher hook) honest GAP pending T2/store tiers; meter: 81 chunks ·
18 golden · 63 GAP). G21 nineteenth golden-backed chunk LANDED 2026-09-28
(CodingAgentSettingsPage.C73HMBrM.js — the re-export-shim pattern first
exercised (the G7 scouting note: cheapest GAP chunk once its target is
golden-backed): the shim executes as entry over the REAL G20 target chunk,
the golden pins the alias map (public export names + which target export
each surfaces) and its metadata/probes regions byte-match the G20 golden's;
component aliases stay GAP with their targets; reimplementation re-exports
our golden-backed builder; meter: 81 chunks · 19 golden · 62 GAP).
G22 twentieth golden-backed chunk LANDED 2026-09-28 (src/ui-loops-limits:
LoopLimitsPage.BrXlWYB3.js export pageMetadata — the FIRST §C golden (Credit
metering surface row): the export is a pure alias (Z=V) of the zero-import
UsageSubpageMetadata chunk, which executes REAL; the golden pins the
loop-spend-limits literal verbatim (own-key order — no description member,
unlike the §F shapes), the alias identity against the loaded target (the
G21 pattern), and the entry's export-name surface; the suspense-observer
credit-metering Component stays declared GAP (T2/T3); linking surface: 32
mechanical throw-on-use seams generated from the import map; meter:
81 chunks · 20 golden · 61 GAP). G23 twenty-first and twenty-second
golden-backed chunks LANDED 2026-09-28 (src/ui-loops-management: the
LoopsManagementPage PAIR — first §A page-level goldens (Loops management
page row, BOTH chunks): the CVnaEF7c pageMetadata pure literal
({id:'loops-management', title:'Manage loops', keywords} — no description
member) projected verbatim + export-name surface, and the BAhf8Ti3 route
shim via the G21 alias-map pattern with loaded-target identity pins from
birth; new stub-library seam: a constructible-but-throwing base class for
module-eval `class extends` (SettingsListProvider), SettingsList height
constants pinned from raw source (GROUP_HEIGHT 32 / ROW_HEIGHT 44) behind
an own-member-only proxy; page/component exports (query hooks, mobx list
providers) declared honest GAP (T2/T3); clean reimplementation
byte-matching both goldens; meter: 81 chunks · 22 golden · 59 GAP).
G25 golden-backed chunk LANDED 2026-09-28 (src/ui-settings-issuers:
AgentIssuersSettingsPage.BuFJumP7.js export pageMetadata — first golden on
the §F Issuers row: the G14 pure-literal recipe with a sections-bearing
shape variation ({id, title, description, sections:{configured, add}} — NO
keywords member, unlike the other §F shapes; per-level ownKeys projections
pin the absences) + the Component's module-eval displayName; the
suspenseObserver-wrapped issuers management page (workloadIssuers
hydration, limit gating, remove-issuer dialog) stays declared GAP (T2/T3);
12 linking-only bomb seams + 3 module-eval wrapper stubs, closure 17;
meter: 81 chunks · 23 golden · 58 GAP).
G26 golden-backed chunk LANDED 2026-09-28
(src/ui-settings-issuers: NewAgentIssuerSettingsPage export pageMetadata —
the §F Issuers row's second chunk: the G14 pure-literal recipe, a two-key
literal ({id:'new-agent-issuer', title:'Add approved issuer'} — the
smallest §F metadata shape; ownKeys pins the absence of
description/keywords/sections) + the Component's module-eval displayName;
17 declared stubs (react interop / jsx factory / suspenseObserver identity
return values, fourteen linking-only bombs); the route Component body AND
the module-LOCAL callback-params class (static parse/redirect URL
validation incl. the allowed-return-origins check — unexported,
unreachable from the module surface, the AiConversationCancel precedent)
stay declared GAP pending T2/T3; clean reimplementation byte-matching;
meter: 81 chunks · 24 golden · 57 GAP).
G36 golden-backed chunk LANDED 2026-09-28
(src/ui-agent-empty-state: LinearAgentEmptyStateHero export t — the FIRST
golden on the §E Session UI row: the hook-free empty-state hero grid in
drive mode (the G9 flatten; closure 4 chunks, 1 stub — the agent-icon seam
as a G16 declared marker, `uB` hand-located as the chunk-local
`function Jw(e)` with the gradient branch): the module-eval 253-cell grid
table executes REAL and is pinned in full (23x11 layout math, sin-hash
--peak/--peak2/--trough at offsets t/t+71/t+37, normalized --tx/--ty
incl. the (-0).toFixed(2)==='0.00' fact on the dx=0 column, animationDelay
0.4+dist/360, the single hidden cell at row 10/col 11), both
shouldAnimate branches of both computed-member class tables, and both
icon call shapes; pure Math — ambient-invariant, verified under
TZ=Asia/Tokyo + tr_TR.UTF-8; clean reimplementation byte-matching; the
matrix row's `LinearAgentEmptyState*` wildcard expanded to the two real
chunk names (it parsed as ONE ref and hid the Hero from the denominator —
the #270 matrix-gap class, third instance); meter: 82 chunks · 25 golden ·
57 GAP).
G34 golden-backed chunk LANDED 2026-09-28 (src/ui-settings-agents:
useActiveAgents BOTH exports — first golden on the matrix §F Account agents
row (the 17:49Z scouting note flagged the row's AccountAgentsSettingsPage as
a SettingsCatalog trap; this hook chunk is clean drive-mode material):
drive mode with five declared recording stubs (useStore fixture install,
resolvePromise.a recorded + thunk run synchronously, ContextualMenuActions.jR
suspense-query recorder — full chunk name pinned against the hash-rotated
twin, Issue.ni argument-identity bomb, react useMemo recorder); pins both
filter conjuncts + orderBy('name'), the queryKey literal + comma join over
concrete ids, queryFn argument identity (store.graphQLClient + the ids
array), resetKey === organization.id with a zero-arg hydrate thunk, the
useMemo [data] deps identity, the id-keyed reduce preserving element
identity, the hook's return-key surface, and the prefetch's
hydrate-then-prefetchQuery order with its argument passed through; clean
reimplementation byte-matching by replaying the driver fixtures; the store
collection surface (filter/orderBy/map/concrete) is a declared driver
fixture — the corpus collection class stays its own ledger row; meter:
82 chunks · 26 golden · 56 GAP).
H3 family expansion
beyond what is merged is ON HOLD; #218 reframes as G3.

Now (the H track — PLAN.md "harness era", the freeze's exit path):
- #231 pipeline execution-integrity guard LANDED 2026-09-28 (#232 + #239
  fix-forward squashed to main `6b5854c`, closes #231): prettify output is
  gated on parse + FULL token-stream signature vs raw (subsumes the template
  check; zero false positives measured on all 1,541 prettifiable chunks);
  cached raw fallbacks are byte-verified pre-UTF-8-decode. Real-corpus rebuild:
  1,541 prettified + 9 byte-exact raw fallbacks, 0 failures, --check
  1,550/1,550. Follow-up: #241 (Tier-2 extract-drift contract for analyze.mjs
  — the 9 raw fallbacks move ops/models counts; carved out of the #232 review).
- #241 extract-drift contract LANDED: analyze.mjs grammars are now
  layout-invariant (tree contract documented in the header; drift test
  `pipeline/analyze.test.mjs` wired into `npm test`). Finding: the old
  fixed-layout grammars UNDERCOUNTED the same corpus — real 1.32.4 numbers are
  **376 ops / 136 models (all with fields)** (was 258/87: beautifier-injected
  newlines inside template literals hid 49 model registrations; literal-pairing
  desync on escaped newlines dropped 118 ops). Anchored grammar cross-checked
  exactly against the raw minified tree (376 = 376, 136 = 136).
  extracts/{models,graphql-ops}.md regenerated; vault analysis/*.json
  re-baselined 2026-09-28 (vault `c44f2cf`): analyze.mjs from main `8674ab6`
  on the complete corpus reproduces 376 ops / 136 models (all with fields) /
  490 unique routes; regenerated extracts byte-match main's committed copies.
- G1 serializer v2 LANDED 2026-09-28 (#240 squashed to main `4a909fd`, closes
  #238): the golden serializer is a closed tagged JSON grammar
  (`corpus-exec-tagged-json-v2`) — every v1 collision pair (null≡undefined,
  0≡-0, Date≡string, sparse holes, …) now yields distinct bytes; loud,
  path-naming refusal outside the grammar; own-key order preserved. G2 goldens
  build on v2 bytes.
- H1 follow-ups: #177 closed (routes.json union + `?` params landed via
  #171/#189/#181). declaredIn route tagging LANDED (#208
  closed; #211 merged — 43 routeMeta entries, roles verified); extract
  integrity guards LANDED (#205 closed; #210+#214 merged).
- H2 generateTheme exact reimplementation (#168): `src/ui-theme/` —
  generateTheme + LCh/APCA color math + the object-hash input hash, verified
  byte-for-byte against golden vectors executed FROM the corpus generator
  (4 parametrizations × both retina branches × 116 tokens + 18 shell values +
  derived elevated/sub/menu/selected/focus/sidebar themes + dynamic functions
  + LCH/P3 formats; 13/13 tests). Harness wiring LANDED (#218): golden vectors become
  `theme.values.*` reference surfaces (8 × 133 = 1,064 exact value facts on
  1.32.4), `value:` canaries pin the wiring + theme drift.
- H3 matrix-§A fact extraction (plan-of-record now issue #213; #207 closed
  as duplicate): H3.1 order family SHIPPED via #212 (two corpus-proven
  grammars, 2 chains on 1.32.4); states family SHIPPED via #217
  (ternary-alternate grammar, states canaries); primitive family SHIPPED via
  #229 (pageMetadata-export/role:dialog signals, 8 primitives on 1.32.4 —
  drift-canary tier per the #220 pivot); behavior/bindings/icons ON HOLD per
  the pivot.
- H4 DONE (issue #185, closed): docs-site digests complete to the 26-page
  sitemap bar (#184/#190/#197 merged); citation hard rule + docs drift-check
  leg + reviewer two-source checklist merged (#196); agent-signals +
  best-practices prose digests merged (#201).
- R5.1 dataplane LANDED 2026-09-29 (#155 squashed to main `ddc478b`):
  `src/server/linear-client.ts` GraphQL client + header-driven rate budget;
  the blocking 400/RATELIMITED finding and the markExhausted/Retry-After
  gate bug fixed on-branch (#202/#204); 9/9 review threads resolved, gate
  green fresh-clone at `97dfce4`, legal clean. The pre-#295 hold was judged
  moot at merge: the #295 directive + merged #296 spine make the public-API
  data plane the projection's substrate (merge evidence on the PR,
  2026-09-29 13:04Z). R5.2/R5.3 (domain reads/writes) unblocked.

Product contract clarification (2026-09-28, owner directive): the rebuild is an
original **Loops-only** product. The sidebar contains Loops, only the Loops-required
views (such as Runs/Templates as built), and our Settings—not Linear tracker navigation
or Linear Settings. The connected account's PAT/OAuth is the documented data-plane
connection for reads/write-back. The golden goose is a separately managed user-session
bridge to normal Linear chat and remains the primary brain; external inference is
fallback-only. This changes scope wording and architecture, not the EXACT UI/behavior
bar for the Loops surfaces or the public-code legal line. Binding detail:
`SPECS/product-contract.md`; boot-level rule: `AGENTS.md`.

Next (per the #295 directive, banner above — supersedes the 70/30 wording):
**60% assembly track** (PLAN.md A-track): claim a remap shard
(`docs/remap/shards.md`), land its ledger rows, then assembly slices in
fan-in order — foundation kit -> node-render tier (shared spine of editor AND
runs transcript, Finding 2) -> composition tier -> route shells — each
transcribed per the ledger's transcription+seam rules and citing its chunk
evidence; non-golden is fine for ~80% of it. **40% harness track**: goldens
preferentially on the exactness-critical kernels the ledger marks
golden-required (engine semantics in AutomationHelper, policy/ordering
kernels, transcoder, degraded states), plus corpus-exec T2/T3 tiers. Every
slice still answers the four product-contract questions and is gated by
`parity check` + `coverage check`. Owner decisions are batched in
`docs/remap/owner-decisions.md` (11 entries, of which #8 settled-by-code) —
implementation of consuming
rows waits; research never does. Shard queue: docs/remap/shards.md (no fixed count — it grows with research
legs; R-A landed 2026-09-29, main `eb79b36` — the 29-route spine section;
TYPE-LATTICE landed 2026-09-29 — the six-value WorkflowDefinition type
dispositions + the resolveTypeForTrigger conversion kernel golden-backed in
`src/loops-type-lattice`, the first golden executing the model-layer chunk
`Issue.DRYymPCa.js` directly via the config-bootstrap seam;
R-BOOT landed 2026-09-29, main `0a54bac` — the boot/config-plane shard;
PROTO-KERNEL landed 2026-09-29 — half 1 of the ambient prototype kernel
(`b()`'s Array/String/Set/Promise/Object/Symbol installs) golden-backed in
`src/proto-kernel`, the first golden executing the boot chunk
`html.CjyPLfH8.js` itself; the date half is the claimed DATE-KERNEL slice.
NOTIF-COPY landed 2026-09-29 — the three loop-notification copy-builder
kernels golden-backed in `src/notif-copy`, reusing the TYPE-LATTICE seam,
with the branch-invariant-fixture determinism pattern for clock-reading
goldens).
R5.1 dataplane is MERGED (#155, main `ddc478b`); R5.2/R5.3 domain
reads/writes are the next dataplane slices and feed the team/workspace
projection (R-PROJ). DATE-KERNEL landed 2026-09-29 — the plain branch of the
boot-installed ambient date library (`core.PJIFv7xf.js` `fe`) golden-backed
in `src/date-kernel` with a zero-stub corpus execution; SCHED-1's goldens
are unblocked (they execute on these methods — merged R-BOOT §2 interlock).
The tz branches + the two spacetime-only methods are a declared follow-up
row in sections/boot-config.md §2.

More goldens are always claimable (the 40% track): the ledger names every
GAP chunk; the G4/G5/G6 patterns (case file + hand-verified golden +
per-entry manifest + reimplementation; invoke/render/drive modes all have
merged worked examples) are the template.

Standing work, always valid: review open PRs (AGENTS.md); UI parity bar (issue
#20); golden-goose next steps after the trace (issue #14): **E1 live
experiment is ON HOLD by owner directive (PR #256, 2026-09-28 03:29Z: "we are
not going to start E1 yet") — do NOT reclaim or start it until the owner says
otherwise** + minimal sync-reader slice when R6 lands.

Infra note: GitHub Actions is billing-locked; the gate runs locally:
`bash ci/check-src.sh`.
