# R-T — team-select (the ADAPT spec for the widened Teams scope)

Shard: R-T (docs/remap/shards.md). Claimed on #225 at 2026-09-30T00:11:44Z by
sess_01a0ef9f-c1b4-725a-88b0-d9fbd5ffc955. Research inputs harvested (#295, all
independently corpus-verified by their authors at `c44f2cf`, cited here per the
cite-don't-re-derive rule and the 23:52:10Z harvest map): 23:37:21Z §1–§2
(resolvers + ADAPT rule), 23:38:34Z §1 (AutomationHelper policy kernel + the
two T-facts), 00:48:07Z §1 (the Team 32/191 projection measurement),
00:54:08Z (activeTeams ordering settled + `userCanAccessTeam` + the
`agentAutomationEnabled` correction), 02:18:03Z (edit-access interlock +
move-destination consumers), 20:57:45Z (the O2 presentation family + the
raw-site transcription rule), and the PR #307 review thread (22:08:45Z — the
flat-leg `sortTeams` divergence). Where a fact below is not yet reproduced by
a second clone or a merged golden, its row says so.

**Scope authority (owner directive, issue #295):** Teams are reimplemented but
adapted — "not the full Teams functionality — only the ability to SELECT a
team in Linear for a loop." Everything here serves team-select for loops:
choosing where a loop lands, showing teams in pickers, validating team
scope/boundary, and rendering the degraded states a parallel-to-Linear
deployment hits when its team snapshot is thinner than first-party's.

Column vocabulary per `docs/remap/README.md`. ADAPT rows here carry FOUR
cells (proposed in my 00:14:27Z #295 input, extending the settled three-part
ADAPT rule): **algorithm** (exact, golden or golden-cited) · **degraded
states** (enumerated with rendering evidence) · **reduced data source**
(projection fields, each `public`/`derived`/`ours`/`owner-decision`) ·
**divergence residue** (the honest line naming where behavior CAN drift and
why that is acceptable — an ADAPT row without this cell is where the next
R3.4 incubates).

## A. The resolver kernels (which team a loop lands on / who may create)

| Row | Disposition | Golden-req | Data plane | Evidence | Feature rows |
|---|---|---|---|---|---|
| `canCreateLoop(user, team, scope)` = `organization.canAccessAppAutomations && organization.isAgentAutomationsAccessible && hasPermissionToManageWorkflowDefinition(user, team, scope)` | ADAPT | yes (b) | OURS + PUB-READ | ContextualMenuActions.Dlg9Oa2U, read in full 23:37Z §2 | R-ACTIONS (the lattice it composes with), R-EDITOR |
| `defaultTeamForNewLoop(user)`: org-wide-capable → `undefined`; else first match in `user.activeTeams`; else first match in `organization.accessibleTeams` | ADAPT | yes (b) — `.find` first-match decides where a new loop lands | OURS + PUB-READ | 23:37Z §2; ordering feed settled 00:54:08Z | R-EDITOR |
| Template-launcher placement: `parent ?? (requiresTriage(template) ? manageableTriageTeam(user) : defaultTeamForNewLoop(user))` | ADAPT | yes (b) — triage templates route through a DIFFERENT team resolver | OURS + PUB-READ | 23:37Z §2 (useLoopTemplateLauncher) | R-TPL; TYPE-LATTICE owns `manageableTriageTeam` — cite, don't re-derive |

Four-cell detail, `canCreateLoop`:
- **Algorithm**: as above; the org gates are client-DERIVED getters
  (plan/featureTier + flags), not 1:1 public reads (00:54:08Z §2 caveat (a)).
- **Degraded states**: gate false → creation affordances absent (menu action
  `applicable` false), plus the AutomationHelper copy in §C when a team-scope
  check is what fails.
- **Reduced data source**: org gates = **owner-decision #3** (three options on
  file: hardwire TRUE / mirror plan tiers / read public
  `Organization.agentAutomationEnabled` and honor it — the third recovered
  00:54:08Z §2 with the `[INTERNAL]`-annotation runtime-refusal caveat, one
  PAT probe to settle once a client exists). Permission leg = `derived`
  (membership/role via public `User.teamMemberships` + `Team` fields).
- **Divergence residue**: until #3 is answered, our deployment may show
  creation affordances first-party would hide on lower plan tiers —
  bounded to the gate, not the permission leg.

Four-cell detail, `defaultTeamForNewLoop`:
- **Algorithm**: org-wide short-circuit to no-team; `activeTeams` =
  `sortByUserSortOrder(teamMemberships.map(m => m.team).filter(t => t && !t.isRetired))`
  with `isRetired` INHERITING down the sub-team tree and missing membership
  sorting LAST (Infinity) — the full recovered chain, settled 00:54:08Z §1
  (README settled finding 3).
- **Degraded states**: none rendered by this kernel itself; a wrong result IS
  the failure (silent misplacement), which is why it is golden-required.
- **Reduced data source**: `derived (algorithm recovered)` — every input
  public: `User.teamMemberships` → `TeamMembership.{team, sortOrder}`,
  `Team.{retiredAt, parent}` (ancestors derive from parent).
- **Divergence residue** (settled, carried verbatim from 00:54:08Z): the
  FALLBACK leg iterates `organization.accessibleTeams` in first-party STORE
  order; ours approximates with public `teams` query order. Divergence
  reachable only when the user can create in NO active team but SOME
  accessible team — narrow, degraded-adjacent; escalate to the owner-decision
  batch only if a live probe shows the public order unstable.

## B. The ordering kernels — three kernels, one family, name the kernel per surface-STATE

The `O2` namespace (`Issue.DRYymPCa.js`, export `ar`, 17 importing chunks —
20:57:45Z §1) carries THREE distinct team-ordering kernels. The PR #307
review (22:08:45Z) proved conflating them is a silent failure mode: tests
pinned tree≡flat and passed; only a corpus read caught it. Rule for every row
below and for future shards: **name the specific kernel function, never the
family.**

| Kernel | What it decides | Ordering semantics | Disposition | Golden status |
|---|---|---|---|---|
| `sortByUserSortOrder` (= `sortTeams` with the `sortOrder` comparator) | which team a new loop LANDS on (feeds §A) | membership-sortOrder comparator, missing→Infinity, ancestor-inject-then-drop DFS flatten | KEEP-EXACT | golden-required (b); settled 00:54:08Z, not yet a merged golden — natural companion to the #307 module |
| `sortTeamsForTree` | what the picker SHOWS when NOT searching | NAME-collated siblings (Intl natural, null-last), min-input-index ROOT blocks, selected partition pinned first, injected ancestors bump indentation only | KEEP-EXACT | **golden merged-in-flight: PR #307** (`src/team-tree`), byte-identical re-execution ×3 clones |
| `sortTeams` (flat leg) | what the picker shows WHEN SEARCHING (`useIndentation: searchInputLength === 0`) and every `useIndentation:false` call | comparator-ordered ROOTS — NO min-input-index re-sort; different root order than the tree | KEEP-EXACT | golden-required (b); the #307 FIX-FORWARD's graduated probe case is the golden — cite it, don't duplicate |

Picker-site state map (the five loops-family `ar` sites, 20:57:45Z §1):

| Site | Chunk (raw) | Kernel(s) ridden |
|---|---|---|
| Save-to team picker | `AutomationPage.FVNODuJW.js` L524 | `sortTeamsForTree` ⇄ `sortTeams` on search |
| Editor Select-teams multi-select (`Search teams…` / `No matching teams`) | `AutomationHistoryDialog.DYWJ3DgX.js` L2709 + L4159 | `sortTeamsForTree` (selected pinned) ⇄ `sortTeams` on search |
| Management-page team filter | `LoopsManagementPage.CVnaEF7c.js` L465 | `sortTeamsForTree` family |
| Template-library picker | `LoopTemplateLibrary.C__UMpNm.js` L283 | `sortTeamsForTreeByDivider` over `availableTeams` |
| Usage filter pills | `UsageAppliedFilterPills.DOHoQ9Wz.js` L229 | presentation family |

Move-destination computation (`sortTeamsForTreeByDivider` +
`findClosestCommonParent`) is R-ACTIONS' row (02:18:03Z §3) — cross-link.
Transcription hazard, binding for every copy row in this file: value-laden
string literals cite RAW sites or corpus-executed goldens; `pretty/`
citations only for structure and identifiers (20:57:45Z §3 — the
`labelForTeams` `+ ${n-3}` no-space-before-`+` byte fact is the proof case,
pinned in #307's golden).

## C. The AutomationHelper boundary/scope policy kernel

`AutomationHelper.B0HEcOoo.js` (the 50 KB window-at-module-scope closure; G13
lineage): `applyToSubTeams` handling (6 sites), `teamBoundary` /
`teamBoundaryError` validation, `TeamScope`, and byte-exact user-facing copy.
KEEP-EXACT, golden-required (b)+(c) — gating plus degraded states our
deployment hits MORE often than first-party (thin team snapshot). One row,
distinct from the §A resolvers (23:38Z §1). Copy list to pin at RAW sites
(the 23:38Z leg quoted these from a verified clone; the golden slice re-cites
raw offsets per the §B hazard rule):

- `Scope can only contain all public teams or a list of teams, but not both at the same time.`
- `Only team members can create a new loop` / `Only team owners can create a new loop`
- `Only full workspace members who belong to a project team can create a loop`
- boundary check fails when `boundaryTeams.some(e => e.private || e.restricted)`

**UNVERIFIED (flagged, not guessed):** whether the PUBLIC `teams` query's
viewer scoping already filters `private`/`restricted` teams such that our
reduced projection never SEES a team the boundary validator must reject. If
so, several degraded branches here are reachable-only-via-stale-cache in our
deployment — still shipped, still exact, marked as such. Settles with one
docs-site citation or PAT probe (raised in my 00:14:27Z input).

## D. TeamLabel + presentation residue

| Row | Disposition | Golden-req | Evidence |
|---|---|---|---|
| `TeamLabel.CTNAPaDj.js` (7.7 KB, hook-light, high fan-in — the team display primitive nearly every loops surface imports; consumes `hideAncestors` from §B's tree kernel to trim breadcrumb prefixes) | KEEP-EXACT | yes (b) small — early-golden candidate per 23:38Z §1 | 23:38Z §1; indentation math already pinned in PR #307 |
| Editor team-picker REGION (`Search teams…`, `No matching teams`, `initialTeamId`, tracking name `TeamAutomationNewPage`) — embedded in `AutomationPage.FVNODuJW.js`, not a standalone chunk | ASSEMBLY (transcription; copy rows cite raw) | no (composes §B kernels + §C policy, both golden elsewhere) | 23:38Z §1 |
| Comparator class `E` (Decorators chunk, export `et`): `Intl.Collator(undefined, {numeric:true})`, null/undefined LAST, `Date→getTime`, chainable `and()` | KEEP-EXACT — A1 foundation-kit ambient-adjacent primitive (invisible-drift material) | yes (b) | 20:57:45Z §2; exercised by #307's golden |

## E. The reduced data source (the projection this shard declares)

Per the 00:48:07Z measurement (candidate ceiling — regex sweep, per-field
confirmation at consumption sites is each consuming slice's job): **Team: 32
of 191 fields referenced** in loops-scope chunks. Resolution:

| Field group | Fields | Mark |
|---|---|---|
| Public-servable | `ancestors`(derives from parent), `children`, `color`, `cyclesEnabled`, `description`, `displayName`, `icon`, `issues`, `key`, `name`, `organization`, `parent`, `private`, `releasePipelines`, `timezone`, `triageEnabled` | `public` |
| Ordering feed | `sortOrder` (client getter = viewer's membership sortOrder ?? Infinity), `isRetired` (retiredAt + inherited via parent) | `derived (algorithm recovered, 00:54:08Z)` |
| Boundary/privacy lattice | `boundaryRootTeam`, `effectiveRestrictedBy`, `hasNonPrivateSubTeams`, `restricted`, `public`, `withAccessibleRestrictedDescendants` | `derived-partial` — each needs a derivation note at its §C consumption site; where underivable, the consumer renders the degraded state instead (the design intent of `hasUnknownEffectiveTeam`) |
| Loops-side relations | `loops`, `workflowDefinitions`, `aiPromptMemories`, `skills` | `ours` (settled Finding 1 — no public loop ops) |
| Cosmetic/minor | `keys`, `traits`, `viewPreferences`, `allProjectLabels` | `public`/`ours` per site; low stakes |

Org/User legs: `Organization` 20 referenced / 4 public — the access-gate pair
is **owner-decision #3** (see §A); `User` 22 referenced / 11 public —
`activeTeams` fully derived (00:54:08Z). `userCanAccessTeam` (recovered
00:54:08Z: `public ? nonGuest||member : restricted ? member||effectiveRestrictedBy?.userIsMember : member`)
matters for scope VALIDATION and degraded rendering only — team LISTING is
already viewer-scoped server-side by the public API (scoped to the VIEWER's
access, per the docs-site pagination/filtering digest; whether that scoping
also EXCLUDES `private`/`restricted` teams from the result set is exactly the
§C UNVERIFIED — this line does not settle it).

The union projection page (`SPECS/data-projection.md`) is R-PROJ's deliverable;
this table is R-T's contribution to it — cross-link, don't duplicate.

## F. OUT rows (so "removed" is a verifiable claim)

| Surface | Disposition | Reason |
|---|---|---|
| `ParentTeamSelect.BTWgGm6X.js` | OUT — **false friend** | The bundle's only standalone team-select, but it is tracker set-parent-team (`teamManagement`/`teamCreation` permissions, `administrableTeams`, sub-team validation). Never cite it as team-select evidence (23:38Z §1). |
| Team administration (create/edit/retire/members) | OUT | Owner directive: SELECT only. Our Settings never grows team CRUD. |
| Team creation from the picker | OUT | Same; first-party's "create team" affordances in pickers do not ship. |
| `getMaxNestingErrorMessage` / `maxNestingDepth` (O2 members) | OUT | Nesting-depth authoring guards — team administration surface, not selection. |

## Interlocks (cross-link, don't duplicate)

- **TYPE-LATTICE** owns `manageableTriageTeam` and the triage routing the
  template-launcher resolver forks on.
- **R-ACTIONS** owns the edit-access lattice (`zU`/`BU`, 02:18:03Z §2) every
  loop action gates through, and the Move destination flow.
- **R-A** owns the `/settings/teams/:teamKey/automation/...` and
  `/:orgKey/team/:teamKey/loops/...` route rows; this file owns their
  team-select semantics.
- **R-PROJ** owns the union projection doc; §E feeds it.
- **R-SEAM** flag census: no team-select surface found flag-gated in the
  harvested inputs; `projectLoops` touches the project-picker leg of Move
  (R-ACTIONS' row).
