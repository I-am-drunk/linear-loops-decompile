# R-A — the loops/automation route spine (29 paths)

Shard: R-A (docs/remap/shards.md). Claimed on #225 at 2026-09-29T12:52:47Z by
sess_01a0ed1c-05eb-7244-9169-9cd89f824a4f. Research inputs harvested: #295
23:37Z (route spine + the two gap finds), 23:40Z (dataplane column), 00:56Z
(generated-not-hand-listed rule + root-set corrections).

**Generated, not hand-listed** (settled 00:56Z rule). Reproduce from a verified
FULL vault clone at `c44f2cf` (counts 1,550/1,550/1,550):

```bash
python3 - <<'PY'
import json, re
routes = json.load(open('pipeline/corpus/analysis/routes.json'))
pat = re.compile(r'loops?|automation', re.I)
uniq = {}
for r in routes:
    if pat.search(r['path']):
        uniq.setdefault(r['path'], set()).add(r['file'])
assert len(uniq) == 29, len(uniq)
for p in sorted(uniq): print(p, '|', ', '.join(sorted(uniq[p])))
PY
```

47 route entries → **29 unique paths, mounted by exactly 10 chunks** (the
README's evidence list). The registration KIND was then read at each site in
`Root.DfW4FHnP.js` (the router chunk): `V(...)`/`W(...)` = a mounted view
(lazy page import), `H(...)` = a redirect, and two paths exist ONLY in the
entity-URL pattern registry in `Issue.DRYymPCa.js` (~25739) — they are link
GRAMMAR, not router mounts. That split is the ledger's first finding: the 29
routes are **15 mounted views + 10 redirects + 2 notification deep-links +
2 pattern-registry entries**, and only the 15 views are pages to build.

Column vocabulary per `docs/remap/README.md`. `Feature rows` cross-links the
shard that owns the surface's feature-level rows (no duplication here).

## 1. Mounted views (15) — the pages the A-track assembles

| Route | Page chunk (read at the `V`/`W` site) | Disposition | Golden-req | Data plane | Feature rows |
|---|---|---|---|---|---|
| `/:orgKey/loops/:viewType?` | `AutomationsPage.CRjHv_XJ` | ASSEMBLY (shell) over KEEP-EXACT view-model | (b) viewtype slugs already golden (G-lineage); list lattice per R-LIST | OURS | R-LIST |
| `/:orgKey/team/:teamKey/loops/:viewType?` | `TeamHomePage.CVoi0ZUq` | ADAPT (team context via minimal projection) | (b) | OURS + PUB-READ (team) | R-LIST, R-T |
| `/:orgKey/loop/:loopId` | `AutomationPage.CNGjpM23` | ASSEMBLY shell; overview regions KEEP-EXACT | (b),(c) per region | OURS | R-EDITOR, R-ACTIONS, R-GOV |
| `/:orgKey/loop/:loopId/edit` | `AutomationPage.CNGjpM23` | ASSEMBLY shell; editor KEEP-EXACT | (b),(c) | OURS | R-EDITOR, R-DRAFT, R-CONTENT |
| `/:orgKey/loops/new` | `AutomationPage.CNGjpM23` | ASSEMBLY shell; template launcher KEEP-EXACT | (b) | OURS | R-EDITOR, R-TPL |
| `/:orgKey/team/:teamKey/loops/new` | `AutomationPage.CNGjpM23` | ADAPT (team preselect via activeTeams kernel, settled 00:54:08Z) | (b) | OURS + PUB-READ | R-EDITOR, R-T |
| `/:orgKey/project/:projectId/loops/new` | `AutomationPage.CNGjpM23` | ASSEMBLY; gated by `projectLoops` flag (R-SEAM census) | (b) | OURS + PUB-READ (project) | R-EDITOR, R-TPL |
| `/:orgKey/loop/:loopId/runs` | `AutomationRunsPage.DR4Bss0s` | ASSEMBLY shell; run pipeline KEEP-EXACT | (b),(c) | OURS (run store + our stream) | R-RUNS |
| `/:orgKey/loop/:loopId/run/:runId` | `AutomationRunsPage.DR4Bss0s` | ASSEMBLY shell; transcript renderer KEEP-EXACT | (b),(c) | OURS | R-RUNS, R-CONTENT |
| `/:orgKey/loop/:loopId/memories` | `ScratchpadMemoriesPage.Ck8rlCKs` | KEEP-EXACT (small surface; exact dialog copy pinned 01:16:24Z) | (b),(c) | OURS | R-GOV |
| `/:orgKey/settings/loops` | `WorkflowAgentAutomationSettingsPage._wV8723k` | ADAPT (workspace loops settings over our config store) | (b) | OURS | R-W, R-GOV |
| `/:orgKey/settings/loops/manage` | `LoopsManagementPage.BAhf8Ti3` | ADAPT | (b) | OURS | R-W (G23 lineage: management page goldens exist) |
| `/:orgKey/settings/usage/spend-limits/loops` | `LoopLimitsPage.BrXlWYB3` | ADAPT — UI/copy/math KEEP-EXACT over OUR accounting (owner decision #1; 02:15:43Z §4-§5: the 29-op usage family has zero public roots) | (b),(d) column spec + limit-math kernel | OURS | R-LIST |
| `/:orgKey/settings/teams/:teamKey/automation/:automationId/runs` | `TeamAutomationSettingsPage.kFQqkao4` | ADAPT (team-settings-hosted runs view) | (c) | OURS | R-RUNS, R-T |
| `/:orgKey/settings/teams/:teamKey/automation/:automationId/run/:runId` | `TeamAutomationSettingsPage.kFQqkao4` | ADAPT | (c) | OURS | R-RUNS, R-T |

Hash-variant note (evidence hygiene): `analysis/routes.json` attributes some
paths to the OTHER hash variant of the same chunk (`AutomationPage.FVNODuJW`,
`AutomationRunsPage.CwJzxL5C`, `ScratchpadMemoriesPage.CVgbHpr0`) than the one
the live `Root.DfW4FHnP.js` registration imports (`CNGjpM23`, `DR4Bss0s`,
`Ck8rlCKs`). Both variants ship in the corpus; rows above cite the variant the
router actually mounts. Golden manifests should resolve against the mounted
variant (and R-FACADE's tool should treat hash variants as one node).

## 2. Redirects (10) — alias grammar, cheap KEEP-EXACT rows

All read at their `H(...)` sites in `Root.DfW4FHnP.js` (~15578–15642, 14773).
The `automation(s)` family is the legacy alias vocabulary; users hold old
links, so the aliases are product surface, not cruft.

| Route | Target | Disposition |
|---|---|---|
| `/:orgKey/automations` | `toLoops` | KEEP-EXACT |
| `/:orgKey/agent-loops` | `toLoops` | KEEP-EXACT (second-generation alias) |
| `/:orgKey/automations/new` | `toNewLoop` | KEEP-EXACT |
| `/:orgKey/automation/:automationId` | `toLoop` | KEEP-EXACT |
| `/:orgKey/automation/:automationId/edit` | `toLoopEdit` | KEEP-EXACT |
| `/:orgKey/automation/:automationId/runs` | `toLoopRuns` | KEEP-EXACT |
| `/:orgKey/automation/:automationId/run/:runId` | `toLoopRun` | KEEP-EXACT |
| `/:orgKey/team/:teamKey/automations` | `toTeamLoops` | KEEP-EXACT |
| `/:orgKey/team/:teamKey/automations/new` | `toNewTeamLoop` | KEEP-EXACT |
| `/:orgKey/settings/ai/automation` | inline: throws redirect to the loops settings path, **preserving `search` + `hash` and sanitized history state** (read at site, ~14773) | KEEP-EXACT incl. the query/hash carry |

Golden shape: one table-driven test family (path in → resolved path out,
params + query/hash carried) covers all ten; criterion (b), trivially pure.

## 3. Notification deep-links (2) — owner decision #2

`/:orgKey/loop/:loopId/notification/:notificationId` and
`/:orgKey/loop/:loopId/run/:runId/notification/:notificationId` register in a
BATCH redirect (`qo([...], A.toNotificationEntity)`, Root ~16012) shared with
issue/project/document/initiative notification routes — they are inbox
deep-link resolvers, not pages. Our app receives no Linear notifications
(first-party inbox stays in Linear). Disposition: **owner decision #2** —
option (a) resolve without notification context (strip the suffix, land on
the loop/run: one line in our router, keeps old links alive) or (b) OUT.
This shard recommends (a): the batch-redirect shape means (a) is exactly what
first-party does when the notification is gone.

## 4. Pattern-registry-only entries (2) — link grammar, not mounts

`/:orgKey/settings/automation/:automationId` (`workspaceAutomation`) and
`/:orgKey/settings/teams/:teamKey/automation/:automationId` (`teamAutomation`)
appear ONLY in the entity-URL pattern registry in `Issue.DRYymPCa.js` (~25739,
with `legacyAutomation` = `/:orgKey/automation/:automationId` and `automation`
= `/:orgKey/loop/:loopId`) and its match list (~25771). No `V`/`W`/`H`
registration exists for either. They are the grammar the client uses to
RECOGNIZE and BUILD loop links (mentions, paste-resolution, entity previews).
Disposition: KEEP-EXACT as pattern data in the link-resolution module (the
R-CONTENT mention builder consumes this registry); NOT pages, NOT redirects —
building a page for them would be inventing surface (the R3.4 failure class).

## 5. Rollup

- 15 views: 1 golden-lineage list shell, 5 AutomationPage mounts (one page
  chunk, four entry modes — the A-track builds ONE page component), 2 runs
  mounts, 1 memories page, 4 settings-hosted pages, 2 team-settings-hosted.
- 10 redirects: one table-driven golden family.
- 2 notification deep-links: owner decision #2, recommend resolve-and-strip.
- 2 pattern-registry entries: link-grammar data for R-CONTENT.
- Total 29 = the README denominator; the generation command above is the
  completeness check `tools/coverage` can grow (R-PROJ interlock).
