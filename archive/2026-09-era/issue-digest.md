# DIGEST — issue #295 (all 66 comments) + the 9 open issues
Compiled 2026-10-04 from the GitHub API. Repo state read at main `a382668`.
Citations are chunk/line/route anchors as posted; corpus = vault Linear 1.32.4
@ `c44f2cf`, 1,550/1,550 chunks verified in `chunks.json` = `pretty/client` =
raw `client/`.

## 0. STANDING CONTEXT (read before any disposition below)

- #295 (2026-09-28) is the ADMIN DIRECTIVE that governed 2026-09-28 → 09-30.
- A NEWER owner directive landed **2026-10-04** (via goal prompt, transcribed on
  #225 at 03:21:45Z / 13:57Z): `prompt.md` split out of AGENTS.md; **scope widens
  from Loops-only to the whole Linear UI**; Runner/GitHub-MCP/vault-token
  machinery deleted in favour of `gh`; board reorg (121 issues + the #225/#295
  mega-threads distilled into `docs/LEARNINGS.md`); **T3 Code Connect becomes a
  first-class inference provider**; **the Loops page adopts Cursor's
  agents/automation layout (MCP-per-automation), Linear becomes ONE integration,
  not the product thesis**; sibling repo `I-am-drunk/cursor-decompile`.
- Therefore #295's *scope* clauses are partly superseded; its *method* clauses
  (transcription rule, seam rule, golden-required test, disposition vocabulary,
  shard protocol, measured inventory) are the surviving asset and should be
  carried into `docs/LEARNINGS.md` rather than re-derived.
- Repo reality 2026-10-04: 24+ golden-backed `src/*` kernels, **no `src/ui`**,
  **0 of 29 routes shipped**, 3 open PRs (#307 TEAM-TREE, #308 CONFIG-KERNEL,
  #312 REVIEW-PROTOCOL-A) all stale since 09-30, ~11 sessions live and racing on
  the rearchitecture spine.

## 1. PER-ISSUE DISPOSITIONS (decisive)

### #295 — ADMIN DIRECTIVE: 60/40, ~80% non-golden UI, scope widens to Settings + Workspaces + Teams
- **Asks:** flip effort to 60% UI / 40% harness; loosen the bar so ~80% of UI
  ships non-golden; widen scope beyond the Loops page to Settings (first-class),
  Workspaces (adapted: only the context Loops needs), Teams (adapted:
  team-SELECT only); keep the sidebar narrow; grow the matrix denominator;
  "map out every single feature … that has to be changed, removed" (C1).
- **Real state:** the *map* is done — 66 comments, ~25 measured research legs,
  zero open factual disputes, consolidated into `docs/remap/`
  (README, research-digest, shards.md, owner-decisions ×13, 4 landed sections:
  a-loops-routes, boot-config, type-lattice, team-select). The *build* never
  started: effort since the directive measured at **~0/100 inverted** (14 merged
  PRs, 0 A-track; #295 C58/C59). STATUS.md carries the 60/40 banner.
- **DISPOSITION: fold-into-new-plan.** Close #295 as the historical directive
  thread; its surviving content (§2–§5 below) migrates into `docs/LEARNINGS.md`
  + the 2026-10-04 spine. Do NOT keep it as a live coordination thread — it is
  the mega-thread the new directive explicitly retires.

### #225 — HARNESS DNA, the one coordination thread (240+ comments, not in the brief but load-bearing)
- Live claim board for every kernel/shard/lane; now hosting the 2026-10-04
  rearchitecture claim races.
- **DISPOSITION: archive-as-learned + replace.** The new directive says the
  coordination system is replaced; claims must move to the new labelled epic set.

### #213 — H3: deepen parity extraction (primitive + corpus-integrity guard, then states/order/behavior)
- **Asks:** extend `parity extract` beyond routes/copy/structure/tokens with
  primitive (pageMetadata→`page`, `role:\`dialog\``→`dialog`), corpus-integrity
  guard, states (`alt:<armA>|<armB>`), order, bindings/icons/behavior.
- **Real state:** slices 1–4 landed (#210 guard, #212 order, #217 states, #229
  primitive). Slices 5+ are explicitly ON HOLD: three separate 2026-09-27 notes
  (#220/#221/#222 pivot) demote the declared-facts compare from *the acceptance
  bar* to a **corpus-drift canary + coverage ledger**; the bar is corpus-executed
  goldens. `tools/parity` survives in-repo and `ci/check-ui.sh` is live.
- **DISPOSITION: archive-as-learned.** Its remaining scope is dead by pivot; the
  surviving value (canary set, copy-extraction grammar, routes floor-not-ceiling
  lesson) is already in the tool. Close with a pointer to the pivot.

### #175 — Ledger: unaddressed review feedback on merged PRs + merge-gate enforcement
- **Asks:** audit force-merged/closed PRs for unaddressed CodeRabbit/peer
  feedback; enforce mechanically. Ruleset `main-pr-only` (id 24061889) already
  has `required_review_thread_resolution: true`;
  `required_approving_review_count` stays 0 deliberately (shared account —
  GitHub ignores author self-approval; requiring approvals deadlocks all merges).
- **Real state:** enforcement DONE. Rebuild-era items all addressed in PR #173.
  Swarm-era threads (#81/#83/#92/#94/#101/#102/#109/#111/#112/#115/#118/#119)
  remain unresolved on dead code at tag `archive/v0-swarm-era`; the proposed
  bulk-resolve ("archived at tag, lesson recorded here") was never run.
  Six recorded lessons: CWE-613 broken auth (#111); never mark a delivery
  complete before its side effect succeeds (#118); idempotency lookups must be
  durable/unbounded, no newest-N windows (#118/#115); require a fresh-source load
  before enabling Publish actions (#112); validate numeric env config (#119);
  computed context must reach the run (#118).
- **DISPOSITION: done-already → close.** Run the one-line GraphQL bulk-resolve,
  move the six lessons into `docs/LEARNINGS.md`, close.

### #164 — AUDIT: rebuild-era src/ vs the exactness bar (freeze/harness-first)
- **Asks:** verdict on rebuild-era `src/`; recommends FREEZE not blind delete.
- **Findings, all since acted on:** F1 three of eight "extracted" palette anchors
  (`#4ea7fc`, `#3fb950`, `#f85149` — GitHub Primer values) absent from the whole
  corpus, citation path `pipeline/corpus/style/style-*.css` nonexistent;
  F2 invented IA; F3 no verification leg; F4 two silent architecture decisions
  (React19+Vite vs zero-dep; token-in-URL `?connectToken=` vs spec'd pairing);
  F5 keep `src/connect` + `src/server` + the docs-following `linear.ts` probe;
  F6 #158's extracted facts (9 triggerTypes, FOUR activationModes, 12 trigger
  events, structured schedule not rrule, name≤64/desc≤255).
- **Real state:** `src/ui` deleted; harness built (`tools/parity`,
  `tools/corpus-exec`, `tools/coverage`); theme golden-backed in `src/ui-theme`;
  F6 facts landed in SPECS/KNOWLEDGE. F4's two decisions are recorded now.
- **DISPOSITION: archive-as-learned.** Close; it is a completed audit whose every
  recommendation was executed.

### #162 — [plan] UI parity harness (Rust CLI, tools/parity)
- **Asks:** `parity check` computing sameness per PR; 4 fact families + the
  consultation answers (fact families extended with primitive, bindings, icons,
  order-as-tuples, per-surface copy keys, behavior event→effect, state-conditional
  visibility); `.parity/tolerances.json` + `improvements.json` as the only
  deviation channel; P1 extract/check/model, P2 headless-Chrome DOM, P3 live
  linear.app capture + pixel diff.
- **Real state:** P1 MERGED (#171 + #188 + #189; 38 surfaces · 52 chunks ·
  43 routes · 857 copy · 657 edges · 137 tokens · canaries 7/7).
  `ci/check-ui.sh` live, vacuous-pass without cargo/corpus. Three 2026-09-27
  pivot notes demote the compare DNA to drift-canary; P2/P3 never started.
  Theme values come from executing the corpus generator (`ThemeHelper.generateTheme`
  + `lightThemeRefresh` OKLCH triples), not a CSS crawl — settled and shipped.
- **DISPOSITION: keep-open, narrowed.** P2/P3 (rendered-DOM scan + live
  calibration) are still the only planned way to verify assembled UI, and the
  assembly track will need them. Retitle to P2/P3 only; move the P1 record into
  LEARNINGS.

### #157 — "STOP MAKING UI THAT IS NOT DECOMPILED…" (owner rage, 2026-09-27)
- **Asks:** stop all non-corpus UI; audit everything in six areas (connect /
  server / src/ui+ui-reference / SPECS provenance / feature-matrix / KNOWLEDGE).
- **Real state:** all six areas audited with findings posted; verdicts executed
  (src/ui deleted, ui-reference palette tagged INVENTED, SPECS trigger model
  corrected, KNOWLEDGE §4 corrected — zstd dictionary is CLIENT-embedded not
  server-sent/SHA256-pinned, packer is stock **msgpackr** not custom, ping 20s /
  idle 30min / noauth 1 retry / backoff `min(30s,(200+rand·100)·n²)` n≤12,
  pong heals −2; §6 client-api stale line corrected). Meta-finding that still
  matters: **the analysis indexes are a floor, not a ceiling** —
  `graphql-ops.json` missed `AiConversationDebugBraintrustUrl`, `routes.json`
  missed `/:orgKey/loop/:loopId/run/:runId`; later #254 showed 258 reported ops
  vs **376 real**.
- **DISPOSITION: archive-as-learned.** The directive is permanently in force via
  AGENTS/STATUS; the audit is complete. Close, with the "indexes are a floor"
  and "corpus grep = ground truth" rules carried into LEARNINGS.

### #148 — R5.1 dataplane: GraphQL client + rate budget
- **Asks:** GraphQL client over api.linear.app with header-driven rate budget;
  promote the R3.3 probe; no network in tests.
- **Real state:** **PR #155 MERGED 2026-09-29 13:04Z.**
- **DISPOSITION: done-already → close now.** It is the only issue here that is
  simply stale-open.

### #14 — GOLDEN GOOSE (Agent Sessions API / normal chat route)
- **Asks:** is Linear's chat free, can we drive it as our loop brain? Q1–Q4.
- **Real state:** framing corrected twice. Settled: Linear inference is never
  free (shared AI-credit wallet); **Agent Sessions API = free native agent UI
  surface at $0 because we bring the brain** (`app:mentionable`+`app:assignable`,
  agents don't count as billable users) — that is the presenter/write-back track,
  NOT the goose. The **goose = the first-party normal chat route**
  (`AiConversationSendMessage` + `streamData` over the sync socket; ZERO GraphQL
  subscriptions). Q1–Q3 answered from the corpus
  (`docs/golden-goose-chat-route.md`, KNOWLEDGE §8a). `UsageFeature` enum =
  `linearAgent · codingAgent · agentAutomation` ("Linear Agent"/"coding
  sessions"/"Loops"); templates are SYNCED DATA (`Template` model, zero template
  ops); public OAuth tokens expire in **24h** since 2026-04-01; the #254 op fix
  surfaced **`query UsageCredit`** (`workspaceCreditUsd`, `byFeature`,
  `billableFeatures`) as the exact E1 instrument — bracket a live send with it.
- **Blocker:** **E1 (the live billing/handshake capture) was claimed
  2026-09-27 22:08Z and never delivered.** It needs the owner present. STATUS
  records E1 as explicitly NOT started; #295 keeps that posture.
- **DISPOSITION: keep-open, narrowed to E1 only.** It is the one open question
  that decides whether the chat-brain thesis is real, and the 2026-10-04
  directive makes it *less* central (T3 Connect becomes a first-class provider,
  Linear becomes one integration). Keep as a single owner-gated experiment issue;
  archive the 33-comment research body into LEARNINGS.

### #2 — Questions & blockers (cross-session)
- **Asks:** cross-cutting Q&A channel. Last substantive comment 2026-09-27.
- **Real state:** superseded three times over (#21 hub → #225 → the 2026-10-04
  coordination system). Contains the original four USER VISION ANCHORS
  (2026-09-26) and the swarm-era handle-collision archaeology.
- **DISPOSITION: archive-as-learned.** Extract the vision anchors (§4 below) and
  close; a dead channel that boot rituals still tell sessions to read is a cost.

## 2. MEASURED SURFACE INVENTORY FROM #295 (keep the numbers)

### 2.1 Routes — the ledger's row spine
- **490 unique route paths** in the corpus (23:37Z); a later count over
  `routes.json` reports 787 entries / 29 loops paths (23:40Z). Reconciled:
  **29 unique loops/automation paths**, 47 route entries, mounted by exactly
  **10 chunks** (00:48Z): `AutomationPage.FVNODuJW`, `AutomationRunsPage.CwJzxL5C`,
  `AutomationsPage.CRjHv_XJ`, `Issue.DRYymPCa`, `Root.DfW4FHnP`,
  `ScratchpadMemoriesPage.CVgbHpr0`, `TeamAutomationSettingsPage.kFQqkao4`,
  `TeamHomePage.CVoi0ZUq`, `useLoopTemplateLauncher.O9-_gagH`,
  `useReportLoadingDone.DjB5FkIK`.
- R-A (landed) decomposes the 29 into **15 mounted views + 10 redirects +
  2 notification deep-links + 2 pattern-registry entries**. 15 is the honest
  A-track denominator; 29 double-counts.
- Routes the pre-#295 matrix missed entirely: **`/:orgKey/loop/:loopId/memories`**
  (`ScratchpadMemoriesPage`), **`/settings/usage/spend-limits/loops`**,
  `/:orgKey/loop/:loopId/run/:runId` (chunk-only, absent from `routes.json`),
  `/project/:projectId/loops/new` (flag `projectLoops`), `/agent-loops`,
  `/loop/:loopId(/run/:runId)/notification/:notificationId`.
- Team-scoped variants now in scope: `/team/:teamKey/loops/:viewType?`,
  `/team/:teamKey/loops/new`, `/team/:teamKey/automations(/new)`,
  `/settings/teams/:teamKey/automation/:automationId(/runs|/run/:runId)`.
- **Settings routes: 172** under `/:orgKey/settings/...`. Loops-relevant subset:
  `settings/ai/automation`, `settings/loops(+/manage)`,
  `settings/account/agents(+/memories)`, `settings/ai/agent`,
  `settings/ai/agent-issuers(+/new)`,
  `settings/teams/:teamKey/{agents,agent-skills,agent-connectors,automation/...}`,
  `settings/agents`. The other ~150 get one explicit OUT row each.
- Method rule (settled after two sessions hand-picked different roots):
  **closure roots are GENERATED from `routes.json`, never hand-listed.**

### 2.2 Import closure / assembly sizing
- 9 hand-picked roots → **571 chunks / 14.0 MB** (37% of the app).
  Corrected roots (+`useReportLoadingDone`, `useLoopTemplateLauncher`,
  `TeamHomePage`) → **586 / 14.2 MB**. Plus the widened settings families
  (26 mount chunks) → **684 / 15.5 MB**, the +98 all app-named, zero vendor.
- **Method bug (01:26Z), load-bearing:** every published closure was
  *lazy-blind* — raw-tree dynamic imports are BACKTICK-quoted
  (`import(`./x.js`)`); `import("./` appears in **zero** raw chunks, the backtick
  form in **89 chunks / 536 lazy edges**. Lazy-aware:
  **static-only 586/14.2 MB → static+lazy 1,062 chunks / 21.8 MB**
  (+476 / +7.5 MB; ~97 vendor/3.8 MB + **379 app-named/3.7 MB**, including
  `EditorComponent` 176 KB and `useBaselineExtensions` 247 KB — the actual
  ProseMirror body, lazy-loaded via `LazyEditorComponent`).
- Of the static 525 ex-monsters: **192 vendor (1.8 MB)**, **333 app-named
  (5.5 MB)** = the real assembly surface. 419 chunks <12 KB, 82 at 12–64 KB,
  24 ≥64 KB. Tail after kit+monsters+vendor: ~600 chunks, median 2.3 KB.
- **Monsters are leaf-weight, not gateways:** `ContextualMenuActions.Dlg9Oa2U`
  4.7 MB + `Issue.DRYymPCa` 1.7 MB; only **44 chunks / 0.2 MB** are reachable
  *solely* through them. Treat as lazily-populated FACADES, never as work items.
  Demanded-export counts diverged (506/639 vs 870/1,132) because root sets and
  edge grammars differed → **facade demand lists must be tool-emitted**.
- **Fan-in build order:** `Flex` 93 importers (5.0 KB), `Text` 86 (3.2 KB),
  `Icon` 85 (4.1 KB), `ThemeProvider` 72 (11.6 KB, core already golden),
  `Tooltip` 63, `Button` 53 (11.0 KB), `UnreachableCaseError` 53 (0.5 KB),
  `ActionGroups` 46, `ActionTrigger` 41, `IconButton` 34 (1.3 KB).
  On the 684-chunk closure (7,499 internal edges): **46 primitives with
  fan-in ≥25 and size ≤30 KB total 272 KB and absorb 49% of all import edges**;
  the 3 monsters absorb another 7%. `RefreshManager` (91 importers, 614 KB),
  `Avatar` (57, 271 KB), `Logger` (49, 243 KB) are seams, not targets.
- **The document stack dominates and is NOT severable:** editor-stack roots close
  over 413–417 chunks / 13.3 MB; intersection with the widened closure
  386–389 chunks / 12.7 MB ≈ 2/3 by chunks, ~90% by bytes — **lazy-aware: 982
  chunks / 21.0 MB, 92% of chunks / 97% of bytes.** Severing the 5 editor roots
  removes only 9 chunks / 0.13 MB: `nodes` + `MarkdownTransformer` are imported
  directly by `AgentAutomationConversation` (run transcripts), so **the editor
  and the run transcript are substantially the same work** — schedule the
  node/markdown render tier ONCE, early.

### 2.3 Models + the data-plane boundary (settled, reproduced 3×)
- **No public root operation exists for `workflowDefinition(s)`, `aiConversation(s)`,
  or `loopExecution`** — read or write — across 173–174 Query / 373–385 Mutation
  roots in `extracts/linear-official/schema.graphql`. Only loops-family ops with
  public equivalents: `agentSessionSandbox`, `agentSessionSshAddress`,
  `agentSessionRestartWithDefaultModel` (+ internal-flagged
  `integrationSlackWorkflowAccessUpdate`). Extended at 02:15Z: **29
  usage/limit/credit/topup ops → zero public equivalents.**
- The client has **NO create/update/publish mutation for loops at all**;
  `publishDraft` persists through the sync engine
  (`f.save(!0,{additionalUpdateArgs:{publish:!0}})`, `result({waitForSync:!1})`,
  `PublishOfflineError`). ⇒ **loop definitions, drafts, runs, memories, trust
  state and run stats are OURS by necessity; the public API is the
  entity/event/write-back plane.**
- Field counts: `Team` **191** fields, `Organization` **214**, `User` 115,
  `WorkflowDefinition` 45 (client) vs **77** on the public MIT type (public-only:
  `runOnce`, `restrictEditing`, `label`, `customView`, `contextViewType`, `user`),
  `WorkflowDefinitionDraft` 35, `WorkflowDefinitionHistory` 28,
  `AiPromptMemory` 17, `LoopExecution` 9 (all pointers: aiConversation,
  workflowDefinition, issue, project, initiative, document, team, cycle, release),
  `WorkflowCronJobDefinition` 8, `UsageLimit` 7, `AiConversation` 38.
- **Minimal projection (two independent methods):** Team **32 of 191** referenced
  in scope chunks (16 public-servable: ancestors, children, color, cyclesEnabled,
  description, displayName, icon, issues, key, name, organization, parent, private,
  releasePipelines, timezone, triageEnabled; 16 not public, clustering as the
  boundary/privacy lattice `boundaryRootTeam, effectiveRestrictedBy,
  hasNonPrivateSubTeams, restricted, public, withAccessibleRestrictedDescendants`,
  the OURS relations `loops, workflowDefinitions, aiPromptMemories, skills`, and
  cosmetics). Organization **20 of 214** by regex ceiling / **13** by
  receiver-anchored floor (`accessibleTeams` 11 sites, `isAgentAutomationsAccessible`
  6, `integrations` 6, `id` 5, `allUsers` 4, `releasePipelines` 3, `usageLimits` 3,
  `allLoops` 2, `canAccessAppAutomations`, `canAccess`, `workflowDefinitions`,
  `allWorkflowDefinitions`, `featureTier`); only 4 public
  (`codeIntelligenceEnabled, integrations, name, teams`). User **22 of 115**,
  11 public. `publishDraft`'s own `validateDataPolicies` closure declares the
  minimal team projection independently: `{id, private, restricted, restrictedById,
  parentId}`.
- Public cousins found for the gates: **`Organization.agentAutomationEnabled`**
  ("[INTERNAL] Whether the workspace has enabled agent automation"), siblings
  `codingAgentEnabled`, `linearAgentEnabled`, `aiAddonEnabled`, and
  **`Organization.linearAgentSettings: JSONObject!`** +
  `OrganizationLinearAgentSettingsInput` (trustedSourcesMode/allowlist,
  mcpServersMode/allowlist, webSearchEnabled). All `[INTERNAL]`-annotated ⇒ one
  live PAT probe decides whether a PAT client may read them.
- `activeTeams` ordering SETTLED and fully public-derivable:
  `sortByUserSortOrder(teamMemberships.map(t=>t.team).filter(t=>t && !t.isRetired))`;
  `Team.isRetired = !!retiredAt || !!parent?.value?.isRetired` (inherits down
  sub-teams); `Team.sortOrder = user.getMembershipForTeam(team)?.sortOrder ??
  Infinity`; the sort injects missing ancestors, does an ancestor-grouped DFS
  flatten, then drops injected non-member ancestors. Inputs
  `User.teamMemberships`, `TeamMembership.{sortOrder,team}`, `Team.{retiredAt,parent}`
  are all public.

### 2.4 Seams, flags, kernels
- **Platform seam = ~34 enumerable chunks.** ≥3 importers of the 42-chunk loops
  family: `useUser` 17, `useStore` 10, `RefreshManager` 10, `useFlag` 9,
  `useComputed` 7, `useScreenSize` 6, `useRouteData` 5, `useQuery` 5,
  `useSendAiMessage` 4, `useTrackRecentLoop` 4. Tail (1–3): useViewFilters,
  useViewPreferences, useUsageVisibilityRefresh, QueryClientProvider,
  useLinearAgentItems, useHydrateAiContext, useInfiniteQuery, useSharedState,
  useUserSettings, useStoredState, useAgentDraft, useToolApprovalActions,
  useHydrateModelsInMarkdown, useSplitViewListActivation, useFilterValidation,
  useUsageLimitGroupPeriod, useUsageLimitTableFilter, useViewPreferenceValue,
  useComponentSize, useAsRef, useReducedMotion, useScrollIntoViewUntilStable.
  **17 of 36 loops-family chunks read the mobx sync store** (useStore /
  suspenseObserver / hydrate), with hydrate-on-demand inside component bodies.
- **Flag census: 14** (UNION rule — definition-site census in `Features.CzCTqIRs.js`
  ∪ alias-resolved consumer sweep; a consumer-only grep found 4, a
  definition-only census found 8). Loop-named 8: `projectLoops`,
  `loopsReleaseTriggers`, `loopsSlackTriggers`,
  `slackIntegrationOptOutOfReadingMessageHistory`, `loopTemplateLibrary`,
  `workspaceLoopTabs`, `loopRunHistoryGraph`, `loopSubscriptions`,
  `loopsModelPicker`; plus shared forks incl. `newTeamHomeNavigation`.
  `workspaceLoopTabs` and `loopTemplateLibrary` change what A1's router and the
  template surface ARE ⇒ their flag decision blocks those slices.
- **Golden-required kernels named on the thread** (criterion in §3):
  schedule kernel (`ug`/`yC`, `Issue.DRYymPCa.js` L6092–6360 — `nextDate` with
  O(1) hours catch-up collapse, month-end clamp NOT rrule, Monday-aligned
  `mondayWeekIndex = floor((epochDays+3)/7)` week parity, `inWords` grid with
  `Bi-weekly`/`Quarterly` and the 7-day due-horizon fork, zod `lg` schema with
  `Days of the week must be unique.` / `Selected days require a weekly schedule.`);
  three team-ordering kernels (`sortByUserSortOrder` flat-membership →
  `defaultTeamForNewLoop`; `sortTeamsForTree` name-collated tree → picker when
  not searching; **`sortTeams` flat comparator-ordered roots → picker WHILE
  searching and whenever `useIndentation:false`** — the #307 divergence proved
  the tree kernel does NOT degenerate into it); edit-access lattice (`zU`/`BU`,
  ContextualMenuActions ~L109625–109900: `editAccess ?? (restrictEditing ?
  middleTier(teamId) : everyone)`, `middleTier = teamId ? teamOwners :
  workspaceAdmins`, the three-state `resolveWorkflowAccess` fold with the
  effectiveOwner escape hatch); AutomationHelper team-boundary/scope lattice with
  its **ten exact error strings**; `publishDraft` transaction (markdown
  round-trip canonicalization, trimmed name, create-only `project ? project : team`,
  new loops publish ENABLED, integration re-parenting, all-or-nothing);
  trusted-sources policy statics (`getTrustedSourcesMode` fail-closed to `none`,
  `canTrust` with the `security`-permission escape hatch) + the source-key grammar
  (`appUser:<id>`, `integration:<service>`, oauthClient, `issueSource:email-trusted`)
  + duplicate-name disambiguation; `AutomationBlockingSourceHelper` (1.3 KB,
  whole-chunk golden); notification copy builders (`yee`/`bee`/`xee`);
  `resolveTypeForTrigger`; `resolveTrigger`/`requiresTriage`/`manageableTriageTeam`;
  `supportsManualRun` + the `R9` ancestor-distance loop-ranking kernel; the
  limit-math kernel (`maxAmountPerDayUsd 1e6`, `periodDays {day:1,week:7,month:30}`,
  `snapAmount` over `[1,1.5,2,2.5,3,4,5,7.5,10]×10^⌊log10⌋` accepting within 7.5%);
  the validation constants `gD` (`maxNameLength 64`, `maxGroupNameLength 64`,
  `maxDescriptionLength 255`, `maxConditionCount 8`, `maxActivityCount 8`,
  40-key `allowedIssueFilterKeysInCondition`, 11-key SLA list); the markdown↔doc
  transcoder; the stylex class-naming law; the prototype/date ambient kernels.
- **Already shipped golden-backed** (`src/`): ui-theme (116 color + 18 shell
  tokens, dark hash `f4ac7a58…`), date-kernel, proto-kernel, notif-copy,
  loops-type-lattice, ui-loops-* (icons, dialog, management, limits, viewtype,
  owner-select, template-launcher, elicitation, creation-tracker, coding-agent),
  ui-settings-* , agent-session-review, model, connect, server.

### 2.5 Trigger / event-feed feasibility (corpus trigger catalog × public webhooks)
`AutomationHelper.B0HEcOoo.js` `K` table = **48 trigger entries across 8 entity
kinds** (schedule, issue, project, initiative, cycle, release, team, chat) ×
4 activation modes (`anyUpdate`, `conditionsStartedMatching`,
`watchedPropertyChanged`, `collectionChanged`). Against the 23-value public
`WebhookResourceType` enum + `docs-site/webhooks.md`:

| Family | Feed | Verdict |
|---|---|---|
| Issue (create/update/property/labels/commentAdded/customerRequestAdded) | WEBHOOK (`Issue`,`IssueLabel`,`Comment`,`CustomerNeed`) | SUPPORTED — `updatedFrom` supplies prior state for edge-triggered modes |
| Project / ProjectUpdate / labels | WEBHOOK | SUPPORTED |
| Initiative / InitiativeUpdate | WEBHOOK | SUPPORTED |
| Document | WEBHOOK | SUPPORTED |
| Cycle created/started/ended | WEBHOOK + our clock | DERIVED (start/end are not webhook actions) |
| Release created / stage changed | no webhook; public `release(s)` roots | POLL |
| **Team** created / member joined-left | **no `Team` resource type exists** | **GAP — poll or owner-decision** |
| Schedule | our cron | OURS |
| **Chat (Slack)** | rides Linear's own Slack integration (`IntegrationWorkflowChatTriggerChannels`, client-api only) | **RE-HOME or DROP** |

Webhook consumer contract inherited as NEW server rows: HMAC-SHA256 on the raw
body, ~1-min timestamp replay guard, 200-within-5s, 1min/1h/6h retry ladder ⇒
**at-least-once**, so `Linear-Delivery` UUID dedupe is required regardless.

### 2.6 Features the pre-#295 matrix carried thinly or not at all
- **Loop memories** (`AiPromptMemory`, 3-valued type
  `productIntelligence|projectContext|scratchpad`; 3 mount points share
  `ScratchpadMemoriesPage.CVgbHpr0.js` 4.2 KB; order `createdAt desc` THEN
  `id asc`; copy `Memories` / `Notes saved by Linear Agent to use in future
  conversations and runs.` / `No memories saved yet` / `Delete memory?`;
  `projectContext` has NO consumer ⇒ explicit GAP row).
- **Template catalog is CLIENT-BAKED DATA** — `Issue.DRYymPCa.js` `tN`/`PM`
  (~L26602): **12 loop templates + 7 chat presets (19 preset keys)** plus a
  `...RM.presetData()` spread; ~**52 KB of instructions/setupGuidance** = the
  largest single transcription surface. `LoopTemplateLibrary.C__UMpNm.js`
  (22.2 KB) makes exactly ONE query — `FreeLoopCredit` — for a badge. No template
  fetch exists.
- **Spend limits** (`/settings/usage/spend-limits/loops`, `LoopLimitsPage.BrXlWYB3`):
  7-column spec as data, `CachedUsageLimitSpend($subjectType,$fallbackPeriod)`,
  cache key `usage-loop-limit-spend:${orgId}:${subjectType}`, private-team rows
  render `SmallLock` + aria `Private team` with NO link.
- **List view-model** (`AutomationListProvider`, `ViewHeaderViewControls.BFmsZSlE`):
  6 preference keys (`automationGrouping` default `team` when showDescendants else
  `none`, project context force-overrides to `none`; `automationShowDescendants`
  toggling OFF silently rewrites grouping first; `automationShowDisabled` is a
  preFilter so disabled loops leave group counts too; `automationOrdering` default
  `name`; `viewOrderingDirection` resets on ordering change; `automationStatsPeriod`
  default `month` → header `Runs (30d|7d|24h)` AND the `runs` comparator).
  Groups: team = `['workspace', ...member, ...nonMember, UnknownTeam]`;
  trigger = fixed `[Schedule, Chat, 'triage', Issue, Document, Project,
  Initiative, Team, Cycle, Release]` with **triage synthetic**; row height 44px,
  **58px when the row has a description**.
- **Filter vocabulary is exactly 4 blocks** (`WorkflowDefinitionFilterBlocks.DRgbmaqa`,
  4.7 KB): team / effectiveOwner / lastExecutedAt (nullable, `Never executed`) /
  runs (label hardwired `Runs (30d)` unlike the header — keep the asymmetry).
- **Action catalog is ONE closed list** (`ContextualMenuActions` `eCn`/`ct`):
  **13 actions** + a flag-gated subscription trio; contextual menu and command
  palette are the same registry mounted in `rootActions`; all disabled states
  funnel through `getEditDisabledReason`.
- **`WorkflowDefinitionMove`**: `{targetTeamId, targetProjectId,
  workspaceDataPolicies?}` → `{success, lastSyncId}` + `waitUntilSyncId` barrier,
  with a ~15-sentence conditional consequence-copy builder.
- **Runs surface**: `AutomationRunsPage` (66.6 KB) renders via **react-query**
  (`useQuery`+`useInfiniteQuery`) — a paginated feed OUR server must serve —
  plus `DistributionChart`/`ChartHover` stats with cost series; preference keys
  `automationRunHistoryShow{Issue,Project,Initiative}Identifier` (default false);
  detail entered with history state `standaloneAutomationRun === true`;
  `retryResolution.status === 'scheduled' | 'notScheduled'` degraded renders.
- **Send path degraded enum** (`useSendAiMessage.B5bGsmqN`): `agentAccessDisabled,
  blocked, cancelled, conversationArchived, entityReadOnly, featureDisabled,
  elicitationResponse` + exact toasts.
- **Styling**: the compiled stylesheet `style-YZZHHG9P.css` (565,322 bytes) is a
  third corpus tree; **100 of 245 `--sx-*` properties are NOT empty** (98
  var-GROUP blocks) — correcting the earlier "all empty" claim; class names are a
  pure function of the declaration (naming law recovered and tested).
- **Boot/config**: spine `html.CjyPLfH8` → `entry.BGeHYrTB`; 90-key config seam
  (`window.CLIENT_ENV`, 82 accessor keys = 64 required / 18 optional, 74 `VITE_*`);
  telemetry self-disables on unset keys (OUT for free); **the vault's
  `index.html` is EMPTY — a real pipeline gap**; `sw.js` also missing.

## 3. DISPOSITION VOCABULARY + SHARD PROTOCOL (as proposed on #295, now in docs/remap/)

### 3.1 Per-row disposition columns
- **Disposition:** `KEEP-EXACT` · `ADAPT` · `NEW` · `OUT` (+ `REIMPLEMENT-EXACT`
  for engine kernels). Every OUT row carries a reason — "removed is a verifiable
  claim, not silence" (the ~150 non-loops settings routes each get one line).
- **The ADAPT rule:** an ADAPT row = **exact client algorithm + exact
  degraded-state rendering, over a declared reduced data source** (+ a named
  delta). Four cells per row. Its third clause was the weakest (prose only); the
  proposed mechanical fix is to have each kernel's golden grid double as a
  **projection demand-list generator** via a recording get-trap proxy over
  team/org/user inputs — a lower bound that fails the coverage leg when a new
  field read appears.
- **Data plane (closed vocabulary):** `OURS · PUB-READ · PUB-WRITE · WEBHOOK ·
  POLL · BRIDGE · N/A` (rows may list several). Rules: any **BRIDGE** row is
  automatically non-assembly (inherits E1-ON-HOLD, must render *visibly blocked*);
  any **POLL** row's diff semantics are value-laden even when its UI is thin.
- **Authority / evidence class:** `corpus` · `docs-site` · `client-api` ·
  **`OBSERVED/UNVERIFIED`** — the fourth value exists because the corpus is a
  CLIENT bundle and cannot testify about server runtime semantics (misfire
  collapse, poll windows, dedupe windows, run restore). Those rows can never be
  golden; their bar is a spec the owner ratifies.
- **Old-code column** (`archive/v0-swarm-era`): `REFERENCE` (engine/dataplane/
  runtime — researched server semantics) · `PATTERN` (server/model architecture) ·
  `IGNORE for values, INDEX for features` (the v0 UI — radioactive values, but a
  real feature checklist written by someone who used the product).
- **Flag column:** `ON-exact` · `OFF-exact` · `owner-decision`.
- **Assembly-cost column:** generated chunk count + bytes of the row's closure
  remainder (never hand-maintained).

### 3.2 The golden-required test (decidable, not a vibe)
A row is golden-required iff it contains at least one of:
**(a)** a wire op or its input/response shape; **(b)** a value-laden algorithm
(ordering, gating, defaulting, grouping, validation); **(c)** a degraded/empty/
error state a parallel-to-Linear deployment will actually hit (unknown-team,
no-access, credit-exhausted, offline); **(d)** theme/layout math already in the
golden families. Pure composition — page shells, routing tables, settings forms
submitting to an already-golden op — is **assembly-tier**. Applying the test to
the 29-route inventory lands near the owner's ~80/20 naturally.

### 3.3 The two anti-R3.4 rules (what makes the non-golden 80% safe)
- **Transcription rule:** every user-visible value in a non-golden slice —
  string, class value, token, ordering, spacing — is transcribed from a named
  corpus chunk, and the PR cites chunk + value; the extract canaries in
  `ci/check-ui.sh` stay as the mechanical drift net.
- **Seam rule:** a transcribed component keeps the corpus's hook call shapes
  verbatim; **every owner-licensed "explicit change" lives in a seam
  implementation on the closed ~34-chunk seam list, and that list grows only by a
  ledger row. Components never fork; seams do.**
- **Placeholder honesty (C2):** an unbuilt region mounts only as a deliberately
  unstyled, visibly-labeled `GAP:` placeholder — never plausible-looking chrome.
- **Review recipe for assembly PRs = CITATION AUDIT, not execution diff:**
  extract the literal census from the diff; dereference each citation against the
  **RAW tree, not `pretty/`** (the prettifier rewrites template-literal interiors
  — a reviewer checking `pretty/` can confirm a byte-wrong string); bucket every
  uncited literal into seam-list / data-gap / VIOLATION; a violation is red
  regardless of plausibility. Verdicts become evidence-shaped
  ("34/34 literals cited, 3 seam, 2 gap regions, 0 violations"). (PR #312.)

### 3.4 Shard protocol
- Row spine = **routes** (chunks shard arbitrarily; routes are the user-visible
  unit). One shard = one file under `docs/remap/sections/` = one PR, so shard PRs
  never collide. Shard axis = **route-group**, plus cross-cutting non-route
  shards (R-SRV, R-OLD, R-triggers, R-PROJ, R-FACADE, R-SEAM, R-SCHED, R-DRAFT).
- Claims go on the coordination thread (#225), **on the slice, never the parent**;
  earliest wins; an **offer is not a claim**.
- **A-claims** (assembly) run parallel to **G-claims** (goldens); A-slice unit =
  **ONE mounted view** from the 15 (a layer is never a slice). Track tags
  `[A]/[K]/[D]/[P]` in PR titles so the split is measurable.
- **Disposition disputes resolve on the directive thread, citing raw sites.**
  Owner-needed rows go to ONE batched file, never one ping per row.
- Banner/STATUS split lands FIRST (owner-verbatim); the normative contract
  rewrite waits for ledger convergence. Convergence itself needs a definition —
  the proposed **LEDGER-CLOSE** checklist: (a) every shard row dereferences to a
  file on `main` with zero `(open)`; (b) interlocks verified both directions;
  (c) disposition-conflict scan; (d) denominators regenerated at close time;
  (e) every cited owner-decision number exists; (f) OUT-completeness counted.
- **Generated-not-quoted rule** (learned 4×: closure roots 571 vs 586, facade
  demand 506/639 vs 870/1,132, CSS class demand 414 vs 438 vs 442, the 26/82
  meter): any denominator, demand list or inventory comes from a committed
  `.corpus-head`-stamped tool, never from prose.
- **Research-is-not-done-until-posted** (added to AGENTS.md 2026-09-29 after the
  02:53Z loss): post partials at least hourly; a claim silent ~2h with zero
  partials is reclaimable. Micro-claims (fix-forward, merge pass) were proposed
  to get a shorter **30–45 min** window; claims should carry a
  **`capability: push-verified`** line.
