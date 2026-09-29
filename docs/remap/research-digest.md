# Research digest — every settled #295 finding in one file

**What this is:** the single consolidated record of all 46 research inputs on
issue #295 (2026-09-28 22:08Z → 2026-09-29 17:16Z), written so a session can
stay on track WITHOUT re-reading the thread. Ordered by owner request
(17:16:48Z message: "make a huge document combining all of the research so far
… for you guys to actually stay on track"). Claimed on #225 at 17:21:09Z by
sess_01a0ee1b-845b-7233-9faa-e12b823c9aa9.

**How to use it:** each section names the plane, the settled facts (with the
#295 timestamp + session provenance to cite), the evidence home in the corpus,
and where the work goes (shard / track / owner decision). The thread remains
the primary source; this file is the index and the converged position. When
this file and a later #295/#225 comment disagree, the comment is fresher —
fix this file in the same PR as the work.

**Corpus baseline for every fact here:** vault `c44f2cf`, Linear v1.32.4,
1,550 chunks (verified `analysis/chunks.json` = `pretty/client` = raw
`client/*.js`). Style sheet `corpus/style/style-YZZHHG9P.css` (565,310 bytes).

---

## 0. The directive (the goal every fact serves)

Owner, 2026-09-28 (#295 body): **60% of effort builds the UI, 40% the
harness. ~80% of shipped UI needs no golden** (transcription + seam rules are
its bar). Scope: Loops + Settings (first-class) + Workspaces (adapted context)
+ Teams (team-SELECT only). The product runs **in parallel to Linear**: the
owner keeps first-party Linear for everything else (inbox included); loops run
through the public API wherever a public surface exists. E1 (live golden-goose
chat) stays NOT started; PAT/OAuth is the data plane.

Owner, 17:16:48Z: plainer language, one consolidated research doc (this file),
a clear plan + forecast (answered on #295 at 17:23:26Z).

---

## 1. Settled findings (multiply reproduced — cite, never re-derive)

These carry 2×+ independent-clone provenance and are load-bearing everywhere:

1. **No public loop ops** (3×: 23:40Z, 23:45:11Z, 23:45:49Z; op-level
   extension 02:15:43Z §5 — the whole usage/limits family, 29 ops, zero
   public roots). No public read/write for `workflowDefinition(s)`,
   `aiConversation(s)`, `loopExecution`. Loop CRUD has no named mutation even
   client-side (`publishDraft` rides sync transactions). **The loop store is
   OURS.** One refinement (14:41:10Z §5): `WorkflowDefinitionNotification` is
   a PUBLIC type reachable from `Query.notifications` — the only public read
   surface returning a `WorkflowDefinition` at all.
2. **The document stack dominates the closure** (2× static 01:17:39Z/01:22:53Z;
   lazy correction 01:26:32Z reproduced by 01:31:03Z). Lazy-aware widened
   closure ≈ 1,062 chunks / 21.8 MB; editor/doc stack ≈ 92% of chunks / 97%
   of bytes; NOT severable (runs transcripts render through the same
   node pipeline). Method rule: raw-tree dynamic imports are BACKTICK-quoted —
   every closure number must come from the committed two-tier tool
   (eager/lazy), self-checked against `__vite__mapDeps`, never prose regexes.
3. **`activeTeams` ordering is fully public-derivable** (00:54:08Z):
   per-membership `sortOrder`, Infinity-for-non-member, inherited retirement,
   ancestor-injected DFS flatten. `defaultTeamForNewLoop` servable exactly.
   Correction in the same input: `Organization.agentAutomationEnabled` IS on
   the public type ([INTERNAL]-annotated) — a one-query probe exists for
   owner decision #3(b).
4. **Run deltas + tool approvals ride OUR transport** (3×: 00:54:38Z,
   01:16:24Z, 01:16:55Z). Zero GraphQL subscriptions in the corpus; streaming
   rides the sync queue first-party; ours rides R3.1 WebSocket. Runs LIST is
   paginated query; run DETAIL is observer-over-stream.
5. **Trigger feasibility** (2×: 23:45:11Z, 23:45:49Z):
   Issue/Project/Initiative/Document = WEBHOOK · Cycle = WEBHOOK + our
   boundary derivation · Team/Release = POLL (no webhook resource type) ·
   Schedule = OURS · Chat(Slack) = re-home or drop (owner call).
6. **The template catalog is client-baked data** (01:16:55Z): 12 full loop
   templates (~52 KB instruction text) + 7 chat presets live in
   `Issue.DRYymPCa.js`; only wire call is `FreeLoopCredit`. Ships as
   transcribed data; the `resolveTrigger` selection lattice is golden-required.
7. **The schedule kernel** — QUADRUPLE-settled (12:29:34Z / 12:30:51Z /
   12:32:36Z / 12:33:50Z + three reconciliations; picker leg 12:46:17Z makes
   five derivations). See §3.1.
8. **Prompt storage format — settled by the code** (01:31:03Z; owner-decisions
   #8): storage is ProseMirror doc JSON; `publishDraft` canonicalizes through
   a markdown round-trip (`parseBack(toMarkdown(doc))`) and publishes the
   round-tripped doc. The transcoder is both the brain boundary AND the
   publish normalizer. Not a choice; pinned behavior.
9. **Boot plane** — settled 2× (16:21:52Z + 16:41:38Z reconciliation + two
   PR #300 reviews). See §3.9.
10. **Style delivery** — settled 3× (14:38:00Z, 14:53:41Z, 15:29:08Z). See §3.8.
11. **Notification plane** — settled 2× (14:41:10Z, 14:42:39Z + 14:45:25Z
    reconciliation). See §3.7.

---

## 2. The vocabulary (converged; used by every ledger row)

- **Row spine = routes**, generated from `analysis/routes.json`, never
  hand-listed (00:56:02Z rule; hand-picked denominators diverged ~70%).
  Denominator: **29 unique loops/automation paths, mounted by exactly 10
  chunks** (R-A landed as `sections/a-loops-routes.md`: 15 mounted views +
  10 redirects + 2 notification deep-links + 2 pattern-registry entries).
- **Dispositions:** `KEEP-EXACT` / `ADAPT` (exact algorithm + exact degraded
  states over a DECLARED reduced data source) / `ASSEMBLY` (corpus-informed
  non-golden — the ~80%) / `OUT` (explicit row, never silence) / `NEW`.
- **Golden-required test (a)–(d)** (23:37:21Z): (a) wire op ∨ (b) value-laden
  algorithm/copy ∨ (c) reachable degraded state ∨ (d) theme/layout math.
- **Data plane:** `OURS` / `PUB-READ` / `PUB-WRITE` / `WEBHOOK` / `POLL` /
  `BRIDGE` / `N-A` (23:40Z + 23:45Z WEBHOOK/POLL refinement).
- **Evidence classes:** corpus-cited / docs-cited / `OBSERVED/UNVERIFIED`
  (server semantics a client bundle structurally cannot settle: misfire
  policy, webhook dedupe, poll diff, retention — 23:45:07Z).
- **Transcription rule (anti-R3.4, the bar for the non-golden 80%)**
  (23:38:34Z): structure/copy transcribed from a cited chunk, per chunk;
  owner-licensed changes ONLY in seam implementations on the closed seam list
  (~34 chunks, 00:54:59Z).
- **Flag census: 14 loop-family flags** by the UNION rule (definition site ∪
  consumers; 01:26:32Z — corrects both the 4-count and 8-count).
- **Old-code column** (23:45:07Z): v0 engine/dataplane/runtime = REFERENCE;
  v0 UI = IGNORE-values / INDEX-existence. NOT-RRULE warning: v0's rrule
  scheduler is the wrong shape for the real kernel (12:39:09Z).

---

## 3. The planes, one by one (what was mapped, where it lives, who owns it)

### 3.1 Schedule kernel + picker (R-SCHED; SCHED-1 claimed by sess_01a0ed1c-2a7c)

- Kernel: ONE ~270-line pure-statics class, `Issue.DRYymPCa.js` ~L6092–6360
  (local `ug`, exported `yC`); zod schemas directly above (timed discriminator
  `'hour' in e && 'timezone' in e`). Shared with recurring-issue templates
  (which lack `hours`).
- Settled semantics: `nextDate` hours-type closed-form catch-up (misfires
  collapse to the aligned slot); UTC month-end clamp in `addCalendarPeriods`
  (Jan-31 → Feb-28 → Mar-31, no drift); Monday-anchored epoch-week parity for
  multi-week `daysOfWeek`; schedule-tz occurrence math; null-schedule default
  = next full hour, daily; two exact throw strings; the 3-variant `inWords`
  humanizer grid (Bi-weekly/Quarterly/`through`-collapse).
- Picker (12:46:17Z): lives in misnamed `RecurringIssueTemplateControls.C_WzwiQc.js`;
  EVERY schedule edit resets `lastRecurredAt(+Timestamp)`; interval 1–12;
  weekday-toggle seeding via `e.toLocalDate('UTC').getUTCDay()`; `daysOfWeek`
  stored in the editing user's DISPLAY order, not sorted.
- **Interlock (16:41:38Z): the kernel executes ON the ambient date methods
  (§3.9) — ship the date kernel with or before SCHED-1 or its goldens pass/fail
  silently wrong.**

### 3.2 Editor + content + draft/publish (R-EDITOR, R-CONTENT, R-DRAFT)

- The editor lives in misnamed `AutomationHistoryDialog.DYWJ3DgX.js` (116 KB)
  (01:17:39Z). The prompt IS a Linear document (`CollaborativeEditor`); the
  ProseMirror stack is the center of gravity of the 60% (Finding 2).
- `bodyData`/`documentContent` PM doc format is the product lingua franca:
  loop instructions, memories, chat, tool-approval decisions (01:22:53Z).
- Drafts are PER-USER (keyed workflowDefinitionId+creatorId — the concurrency
  model); `publishDraft` is our publish endpoint's field-for-field spec:
  canonicalization (Finding 8), trim rule, create-only fields, enablement
  rule (01:31:03Z).
- Publish also runs `resolveTypeForTrigger` (§3.10) — landed golden-backed as
  PR #301 `src/loops-type-lattice`.
- Editor inventory: trigger-picker taxonomy, 20 placeholder strings (15-branch
  function), model-picker values, connector/trust mount
  (`AutomationTrustedSourceEditorOptions` — R-GOV owns the kernel), publish
  flow copy, versions/history, run-now gating, draft quotas.

### 3.3 List/browse + actions (R-LIST, R-ACTIONS)

- `AutomationListProvider` (in `ViewHeaderViewControls.BFmsZSlE.js`): closed
  grouping/ordering/preference lattice; exact 4-block filter vocabulary;
  connector-health badge lattice; spend-limits table + limit-math kernel
  (`/settings/usage/spend-limits/loops`) (02:15:43Z).
- 13-action loop command catalog = ONE registry (contextual menu + palette)
  mounted in `rootActions`; edit-access lattice (`resolveWorkflowAccess`,
  `getEditAccessPresentation`) is a pure golden kernel; Move flow = wire op +
  15-sentence consequence builder; manual-run loop ranking = second ordering
  kernel; subscribers = flag-gated OURS feature with exact limits (02:18:03Z).
- List groups by `effectiveTeam ?? (hasUnknownEffectiveTeam ? 'Private team'
  : …)` — data plane must preserve team privacy/boundary shape.

### 3.4 Runs + store seam (R-RUNS, R-SEAM)

- Run render pipeline: run LIST = paginated query (react-query leg); run
  DETAIL = observer-over-stream; stats chart + cost caption; preference keys;
  `retryResolution` degraded renders; LoopExecution join (00:54:38Z).
- `src/ui-store` = the projected model layer behind the seam (two writers:
  public-API intake + our own store; hydrate-with-our-semantics); the ~34-chunk
  seam contract is the closed list where owner-licensed changes live
  (00:54:59Z). Run-event stream = NEW OURS transport row over R3.1.
- Inbox remount (14:31:45Z §3): `AutomationInboxView` = SplitViewPanel remount
  of `AutomationPage(readonly, showPageHeader:false)` with
  `resultContext {type:'notification', notificationId, turnId, awaitingApproval}`
  — settles owner decision #2's cost.

### 3.5 Governance + templates + memories (R-GOV, R-TPL)

- Trusted sources: three layers (policy statics, source-key grammar/editor
  algorithm, degraded flow). **Keying is owned by R-SRV** (trust-store key =
  actor attribution = echo suppression; one grammar, defined in R-GOV kernel
  rows, cited by R-SRV) (01:16:24Z + shards interlock).
- Tool approvals ride the CHAT SEND path (`useSendAiMessage` collision site).
- Memories: 3-valued enum `productIntelligence`/`projectContext`/`scratchpad`
  (`projectContext` has NO consumer → explicit GAP/OUT row); `createdAt desc,
  id asc` tiebreak; `forWorkflow(...).delete.kind` gate; exact dialog copy;
  three mount points; OURS plane (01:16:24Z + 01:16:55Z §2, reconciled).
- Templates: Finding 6. Credit badge folds into owner decision #1.

### 3.6 Team-select + workspace (R-T claimed, R-W claimed)

- `AutomationHelper.B0HEcOoo.js` (67 KB) is the policy kernel: team-boundary
  validation lattice (`boundaryRootTeam`, restricted descent,
  `applyToSubTeams`, workspace-vs-team-list exclusivity) with TEN exact error
  strings — golden-required (23:38:34Z). Permission fork L1525:
  `automation|triageAutomation → automationManagement`, else `teamManagement`.
- Team projection is validator-declared minimal (01:31:03Z); measured minimal
  projections: Team 32/191 fields, Org 20/214, User 22/115 (00:48:07Z).
- `canCreateLoop`/`defaultTeamForNewLoop` resolvers + activeTeams ordering
  (Finding 3) + `hasUnknownEffectiveTeam` degraded rendering + TeamLabel;
  `ParentTeamSelect` is a false friend (OUT row).

### 3.7 Notifications (folds into R-SRV + R-RUNS; settled 2×)

- Exactly four `agentAutomation*` types (closed enum, `Issue.DRYymPCa.js`
  L10054): Disabled / FailedToRun / RunResponse / UserMessage. Presenter
  registry by naming kernel `upperFirst(type)+'NotificationPresenter'`.
- Copy-builder kernels: five-reason failure vocabulary (`creditsExhausted`,
  `usageLimitReached`, `untrustedSource`, `skillUnavailable`, `error`);
  single-positive-reason rule (mixed buckets collapse to bare form — NOT max);
  tz-sensitive "N times today" day-bucketing; `||` vs `??` asymmetry between
  response and user-message defaults.
- Grouping keys are a SERVER contract: per-conversation vs per-day-bucket vs
  per-definition. All four types are ALWAYS priority-inbox (L10129).
- Category copy: `Loops` / `Messages, responses, and failures from loops`.
- `metadata.agentAutomationFailure`/`agentAutomationRun` payloads are
  field-for-field OUR run-outcome event schemas (R-SRV).
- Public API has no notification-create mutation → we cannot inject into the
  owner's Linear inbox. Generation fork = owner decision (§4, notification
  entry): recommend OUT-chrome (runs list carries the copy kernels).

### 3.8 Style delivery (R-STYLE offered by sess_01a0ed79-1f02; settled 3×)

- Three-stage pipeline: compiled atomic stylesheet (6,856/6,857 `.sx-*`
  classes; 771 `@media`, 96 `@keyframes`) → runtime var injection
  (ThemeProvider ~40-line kernel, `__varGroupHash__` = `sx-1xr6qsj`) →
  class-names-as-DATA in chunks (transcription rule).
- CORRECTION (14:53:41Z): `--sx-*` vars are NOT all empty — 245 total: 145
  empty (runtime theme) + 100 never-empty (117 literal defaults in 50 var
  groups + data-attr-conditioned dynamics). An injection layer that ships only
  generateTheme output silently drops ~40% of the var plane → the facts
  schema needs a `varDecls` family.
- The naming law is EXECUTABLE (15:29:08Z): `sx-` + murmur2_32("<>"+dashedProp
  +value+modifier, seed 1) base36; 3,618/4,403 plain atoms reproduce
  byte-exact from Meta's MIT `@stylexjs/babel-plugin`; 254 are `defineConsts`
  aliases. Upgrades owner decision #12(a) to derive-and-check with a
  hash-canary. Demand lists must be GENERATED (denominator lesson: 414 vs 438
  vs 442 across three hand globs).
- 9 non-`sx` vars (`--header-height`, `--pointer`, `--scrollbar-width`,
  `--settings-list-view-*`, `--x-*`) = closed seam list for shell layout rows.

### 3.9 Boot/config + ambient kernel (R-BOOT = PR #300; settled 2×)

- Boot spine: `html.CjyPLfH8.js` → `entry.BGeHYrTB.js`; pinned order:
  prototype installer `b()` → `injectConfig(CONFIG)` → `window.__toStaticUrl`
  → entry import. A1's shell must reproduce those steps before mounting
  anything or transcribed chunks throw at module eval.
- `b()` half 1: Array (`distinct` with ≤15 indexOf fork, `concrete`,
  Map-`groupBy`, `orderBy`/`sortBy`, `count`), String (`capitalize`,
  `toQuestion`), Set (`isEqualTo`, `difference`), `Promise.raceFind`,
  `withResolvers`. Conditional-polyfill vs unconditional split matters for
  goldens (native vs Linear-authored).
- `b()` half 2 (16:41:38Z — the delta PR #300 must absorb):
  `core.PJIFv7xf.js` `fe` installs the 11-method `Date.prototype` family
  (`toTimelessDate`, `midnight`, `offsetByDays` = calendar math ≠
  `offsetByHours(24)` across DST, `daysTo`, …; each with a spacetime tz
  BRANCH, not parameter) + `String.prototype.toLocalDate` (205 uses/24 files;
  invalid-date self-recursion strips trailing chars). **SCHED-1 goldens sit
  on these.**
- Config seam: 82 accessor keys (64 required `n()` / 18 optional `r()`; the
  "90" prose figure counts derived props — 16:44:19Z correction), 74 `VITE_*`
  fallbacks, `window.CLIENT_ENV` wins — this IS our deployment surface;
  telemetry self-disables via unset optional keys (Sentry OUT for free).
- Corpus gaps (honest rows + pipeline follow-ups): `sw.js` not in fetch set;
  `renderer/index.html` 0 bytes at `c44f2cf`. DesktopServer = OUT.

### 3.10 Triage/type lattice (landed as PR #301) + settings/entry-points

- `WorkflowDefinition.type` is SIX-valued: {sla, automation, viewSubscription,
  triage, triageAutomation, release}. `isTriage`/`isAutomation` OVERLAP on
  `triageAutomation` (it is BOTH; `isLoop` = isAutomation). `resolveTypeForTrigger`
  (3-line kernel, runs in the `firstTrigger` setter): `automation` +
  issue/`entityInTriage` → `triageAutomation`; `triageAutomation` + anything
  else → `automation`; identity otherwise. sla/viewSubscription/release = one
  explicit OUT row each (16:19:58Z; golden-backed in `src/loops-type-lattice`).
- Triage RULES are `type: triage` WorkflowDefinitions on our store with exact
  value-laden defaults; `TriageSuggestionAutomationRules` (23.5 KB) is an
  inheritance/tombstone lattice whose public-API story forces owner decision
  #11 (recommend OUT).
- Settings plane (14:31:45Z): `WorkflowAgentAutomationSettingsPage` pageMetadata
  registry = exact DATA golden for settings-search; the settings-chrome fork
  (`BZ`/`HZ` URL kernel) makes `TeamAutomationSettingsPage` a 1.2 KB shim;
  creation-affordance lattice = `getLoopCreateDisabledReason` +
  `loopTemplateLibrary` entry fork.

### 3.11 Write-back identity (rows in R-SRV; owner decision #10)

- The write credential decides everything downstream (02:30:36Z): under PAT
  the webhook `actor` is the owner's User → our write-backs echo into our own
  intake unfilterably (self-triggering loops; needs a write ledger,
  OBSERVED/UNVERIFIED). Under OAuth `actor=app` the echo is an exact
  documented filter — but `actor=app` cannot hold `admin` scope, so webhook
  registration needs a separate admin credential. The echo ledger doubles as
  the idempotency spine.

### 3.12 Assembly architecture (R-FACADE; the A-track's math)

- Fan-in-ordered bottom-up build: ~46 primitives absorb ~49% of the graph's
  import edges (A1); node-render tier is shared spine of editor AND transcript
  (A2, NOT deferrable); monsters (ContextualMenuActions, Issue) are consumed
  through lazy facades with TOOL-EMITTED demand lists, never reimplemented
  whole; eager tier = boot cost, lazy tier = feature reachability, and the
  corpus's lazy boundaries are themselves parity surface — preserve them
  (00:49:13Z + 00:56:02Z corrections + 01:26:32Z two-tier rule).

---

## 4. Owner decisions — status at this writing

Filed in `owner-decisions.md` (entries 1–10 on main; PR #301 adds Triage
Intelligence as #11). **Numbering collisions to resolve in the next
owner-decisions PR:** the thread produced three candidate "#11"s — style/CSS
shipping (14:38:00Z), notification generation (14:42:39Z, folded into
14:41:10Z §6), and Triage Intelligence (16:19:58Z, now in PR #301). Suggested:
#11 Triage (already in a PR) · #12 CSS delivery (recommend (a) facts-file +
generator + hash-canary; all three style legs support it) · #13 notification
generation (recommend (a) OUT-chrome). Settled and needing NO answer: #8
(prompt format — code settled it). Two more sub-forks recorded: fallback-brain
memory access (#6) and editor collab (#7, natural answer (a) local-only).

**These decisions block implementation of their consuming rows, not research.
Getting the file answered is the highest-leverage owner action.**

---

## 5. Process rules that came out of this thread (now governing)

- **Research is not done until posted** (AGENTS.md, merged PR #299; born from
  the owner's 02:53Z lost-schedule-kernel comment; proposed independently by
  all four recovery legs): post partials at least every ~hour; a claim silent
  ~2h with zero partials is reclaimable.
- **Posting races are normal; reconcile, don't duplicate** (00:56:14Z
  convention): earliest input is primary; later racers drop duplicated
  sections, endorse, and post only deltas. Earliest CLAIM keeps a slice.
- **Generated denominators**: route lists, demand lists, closure numbers, and
  config-key censuses come from tools/commands committed with the row — every
  hand count on the thread diverged (routes, sx-classes, config keys).
- **Full vault clone + count check before trusting corpus numbers** (three
  counts: chunks.json = pretty/client = raw client). Stamp `.corpus-head`.
- **Feedback gate** unchanged: no merges with unaddressed threads.

## 6. Where the effort goes NOW (post-17:16Z owner message)

Research saturated — the last new planes (boot, triage) closed the map, and
recent comments were reconciliations. The default next task is A-track build
work, not new research: A1 (foundation kit + router + CSS delivery per §3.8/§3.9,
gated on decision #12) → A2 (node-render tier) → A3 (`src/ui-store` + run
stream) → A4/A5 (route shells). The 40% continues on golden kernels in claim
order: SCHED-1 (+ambient date kernel first), draft/publish, edit-access,
notification copy builders. Open shard files in `shards.md` remain claimable
for transcription of §3's already-posted research.
