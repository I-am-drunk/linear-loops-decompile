# The #295 remap: disposition ledger for the widened scope

**Authority:** owner directive on issue #295 (2026-09-28): 60% UI / 40% harness,
~80% of shipped UI non-golden, scope widened beyond the Loops page to Settings +
Workspaces (adapted) + Teams (team-select only), used *in parallel to Linear*.
"Map out every single feature in an MD file that has to be changed, removed,
etc., and change your whole roadmap to accommodate this."

This directory is that MD file, harvested from the 23 converged research inputs
on issue #295 (2026-09-28 22:08Z – 2026-09-29 01:31Z, session ids as provenance
on each). The thread reached convergence with zero open disputes; this ledger is
the record. `docs/feature-matrix.md` remains the corpus-evidence index; this
ledger adds the disposition, data-plane, and roadmap layers over it.

## The row spine: routes, not chunk names

Rows are keyed by **route** (the user-visible unit the owner means by "every
single Loops feature"), with chunks as the evidence column. Chunk names mislead
(the loop editor lives in `AutomationHistoryDialog.DYWJ3DgX.js`; two Loops routes
were missing from the matrix entirely). Rule (settled, 00:56Z): route/root
inventories are **generated from `analysis/routes.json`**, never hand-listed.

The denominator at corpus `c44f2cf` (Linear v1.32.4): **29 unique
loops/automation route paths, mounted by exactly 10 chunks**, plus the widened
Settings/Teams/Workspace subset enumerated in `sections/`.

## Column vocabulary (converged on the thread)

| Column | Values | Meaning |
|---|---|---|
| Disposition | `KEEP-EXACT` / `ADAPT` / `ASSEMBLY` / `OUT` / `NEW` | ADAPT = exact client algorithm + exact degraded-state rendering over a **declared reduced data source**; ASSEMBLY = corpus-informed non-golden (the ~80%); NEW = a row our product needs that first-party gets from infrastructure we don't have |
| Golden-required | yes/no per the (a)–(d) test | (a) wire op ∨ (b) value-laden algorithm/copy ∨ (c) reachable degraded state ∨ (d) theme/layout math |
| Data plane | `OURS` / `PUB-READ` / `PUB-WRITE` / `WEBHOOK` / `POLL` / `BRIDGE` / `N-A` | See settled Finding 1 below |
| Old code | `REFERENCE` / `PATTERN` / `IGNORE` | vs `archive/v0-swarm-era` |
| Evidence class | corpus-cited / docs-cited / `OBSERVED/UNVERIFIED` | The third class covers server-runtime semantics a client bundle structurally cannot settle (misfire, webhook dedupe, poll-diff) |
| Flag | one of the 14 loop-family flags (UNION rule: definition site ∪ consumers, 01:26:32Z correction) + `ON-exact`/`OFF-exact`/`owner-decision` | Census from the `Features` definition site, not consumer grep |

## Settled findings (multiply reproduced; cite, don't re-derive)

1. **No public loop ops.** Zero public root operations exist for
   `workflowDefinition(s)`, `aiConversation(s)`, `loopExecution` — no read, no
   write; only 3 of 30 loop-relevant client ops have public equivalents, and
   loop CRUD has no named mutation even client-side (`publishDraft` rides sync
   transactions). The loop store is **OURS** by necessity.
   (sess_01a0ea5b-3018 + sess_01a0ea5b-56ed + sess_01a0ea5a-ff65, 3×.)
2. **The document stack dominates the closure.** Static-only, the
   widened-scope import closure is ~586 chunks / 14.2 MB — but all pre-01:26Z
   graphs were LAZY-BLIND (raw-tree dynamic imports are backtick-quoted;
   the double-quote regexes matched none of the 536 lazy edges). Lazy-aware:
   **1,062 chunks / 21.8 MB**, and the editor/doc stack's share is ~92% of
   chunks / 97% of bytes — NOT severable either way (the node-render pipeline
   is multiply reached; the runs transcript renders through it too). The
   node-render tier is shared spine of editor AND transcript and ships in the
   early assembly batches. Closure numbers on ledger rows must come from the
   committed two-tier (eager/lazy-tagged) tool, self-checked against
   `__vite__mapDeps`, never from prose regexes — the eager tier is a route's
   boot cost, the lazy tier is feature reachability, and the corpus's lazy
   boundaries are themselves parity surface (preserve them, don't flatten).
   (sess_01a0eaaf-fcf6 + sess_01a0eaaf-ed60 static 2×; lazy correction
   sess_01a0eaaf-bdaf, reproduced by sess_01a0eaae-45af.)
3. **`activeTeams` ordering is fully derivable from public fields**
   (per-membership `sortOrder`, Infinity-for-non-member, inherited retirement,
   ancestor-injected DFS flatten) — `defaultTeamForNewLoop` is servable exactly.
   (sess_01a0ea9a-00da.)
4. **Run deltas and tool-approval decisions ride OUR transport** (R3.1
   WebSocket): no public loop ops + E1 on hold + zero GraphQL subscriptions.
   Three independent derivations. (00:54:38Z, 01:16:24Z, 01:16:55Z.)
5. **Trigger feasibility**: Issue/Project/Initiative/Document = WEBHOOK;
   Cycle = WEBHOOK + our boundary derivation; Team/Release = POLL (no webhook
   resource type); Schedule = OURS; Chat(Slack) = re-home/drop.
   (sess_01a0ea5b-56ed + sess_01a0ea5a-ff65.)
6. **The template catalog is client-baked data** — 12 full loop templates
   (~52 KB instruction text) + 7 chat presets live in the bundle; the only wire
   call is `FreeLoopCredit`. Templates ship as transcribed data with the
   `resolveTrigger` selection lattice golden-required. (sess_01a0eaaf-e1a7.)

## Files

- `sections/` — one file per shard (the row tables). Created by the shard-taker
  in their own PR; the shard map below is the claim queue.
- `owner-decisions.md` — the batched list awaiting the owner (single file, so
  the owner answers once).
- `shards.md` — the shard map: scope, offering session, research inputs to
  harvest, interlocks. Claim a shard on #225 with the normal discipline.

## Collaboration protocol (what already works here)

1. Claim a shard on #225 (check tail + open PRs first; earliest claim wins).
2. One shard = one file under `sections/` = one PR; no cross-file edits, so
   parallel PRs never collide.
3. Rows carry chunk evidence + session provenance; transcribed copy is cited
   per template/chunk key so review is a mechanical grep of the corpus.
4. Ledger tables are machine-parseable (00:48Z format request): pipe-tables
   with fixed column names, so `tools/coverage` can grow route-completeness and
   disposition-consistency legs (proposed; see shards.md R-PROJ).
