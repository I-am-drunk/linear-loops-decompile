# Learnings

Distilled from 121 issues, issue #225 (244 comments), issue #295 (66), and
three eras of this repo. The threads are archived; this file is what they were
for. Read it once and you can skip them.

## The eras, briefly

| Era | What happened | Why it ended |
|---|---|---|
| Swarm (to 2026-09-27) | ~26k LOC, M0–M5, tests green | Built to plausibility with no evidence. Archived at tag `archive/v0-swarm-era`. |
| Rebuild / harness (09-27 → 09-28) | Pipeline, feature matrix, parity harness, golden-test harness | The UI shell failed its own exactness audit and was deleted. Harness outlived it. |
| Assembly (09-28 → 09-30) | 60/40 UI-vs-harness split; ~16 golden-backed chunks; research shards | Ran out of sessions mid-stride. `main` sat untouched from 09-30 to 10-04. |
| Rearchitecture (10-04) | This. Whole-Linear-UI scope, Cursor-style automations page, provenance rule | — |

## What actually went wrong, three times

**1. Building breadth before evidence.** The swarm era shipped a working
product that matched nothing. Lesson kept: a slice names its evidence or it
does not ship.

**2. Then evidence became the product.** The correction overshot. Nine of ten
sessions ended up building the apparatus that proves exactness — parity
harness, corpus executor, coverage ledger, golden manifests, review recipes
for reviewing the recipes — while the thing a user could open stayed empty.
After three days the meter read *78 chunks · 16 golden · 62 GAP*: months of
runway to finish proving, and no product. The owner's 60/40 directive (#295)
was aimed exactly here and arrived late.

**3. Reviewing UI by eye let invented work through, fifty times.** Agents
built shells from a recollection of Linear rather than from the corpus,
screenshotted them, judged them plausible, and shipped. Colors were right —
they come from the golden-backed generator. Every dimension the generator does
not cover was made up. Linear's stylesheet holds 118 distinct width values, so
guessing a real one is a coin flip. Fixed mechanically rather than by
exhortation: `docs/UI-EXACTNESS.md` plus `tools/ui-facts`, wired into the
required CI check. Related: a fact queue where 3 of 4 headline strings were
wrong, each written from a guess *about* an artifact and then cited — a
citation is necessary, not sufficient.

## Coordination: what the thread taught

The 100+-comment mega-thread was named "horrible coordination" by the owner,
correctly. Measured failures:

- **Simultaneous claims.** 2026-10-04 13:55–13:57Z: four sessions claimed "the
  rearchitecture" within 23 seconds, each having read a tail that predated the
  others. None had landed anything 100 minutes later. Earliest-claim-wins
  cannot arbitrate ties it cannot see.
- **Claims are not work.** Both 03:21Z and 03:40Z claims went 10 hours with
  zero pushes. A claim is a lock, and an unpushed lock starves the queue.
- **Reclaim windows kept being renegotiated** (2h for research, ~40min
  proposed for micro-claims, 10h de-facto precedent) in thread prose, so no
  session could tell which applied.
- **Coordination overhead exceeded the work.** 600-word claim comments
  announcing timed backstops for reviews of review protocols. Several sessions
  spent their entire run coordinating.

Rules that earned their place (now in `AGENTS.md`):

1. **Push within the hour, or you hold nothing.** Durability is the branch,
   not the claim. Unpushed is unclaimed, full stop — this replaces every
   negotiated window.
2. **Claims are ≤5 lines**: lane, scope, session id. Findings go in files and
   PRs. Never thread prose.
3. **One lane issue per workstream**, not one thread for everything and not
   one issue per claim (that mistake produced ~70 junk issues).
4. **Review before you author** when the queue is non-empty.
5. **Oldest PR first.** Recency bias starved #307 for days behind two silent
   claims.

## Technical findings worth keeping

- **Loop chat and normal AI chat are the same substrate**; Loops is the
  credit-metered wrapper. Zero GraphQL subscriptions — streaming rides the
  sync queue. (#14, KNOWLEDGE §8.)
- **Trigger entities are PascalCase model values** (`Issue`, `Project`,
  `Document`, `Initiative`, `Team`, `Release`, `Cycle`, `Schedule`, `Chat`) —
  not a `schedule|chat|event` type with a separate event field. Encoding the
  wrong model killed two PRs.
- **Rate limiting is header-driven**, never hardcoded: `RATELIMITED` can
  arrive on HTTP 400, and exhausted-window resets (request/endpoint/
  complexity) must each be honored separately. `src/server/linear-client.ts`
  implements this and is worth keeping.
- **The node-render pipeline is shared** by the loop editor and the runs
  transcript. It is not deferrable as "editor, later."
- **Two monster chunks** (`ContextualMenuActions`, `Issue`) should be consumed
  through narrow facades, never reimplemented whole.
- **Prettifiers are not compilers.** js-beautify silently corrupted 3 chunks
  into invalid JS, one of them the model layer. Any formatter in a reading
  path needs a parse-or-fall-back gate and a byte-preservation check.
- **Verify a corpus before trusting it.** A stale partial clone produced a
  false "507 chunks missing" alarm and a false "zero drift" pass. Full clone,
  count check, then trust.

## Carried-forward owner decisions

From `docs/remap/owner-decisions.md`, still open and still relevant: credit
meter out vs reimplemented (self-hosted has no Linear billing); notification
deep-link routes; run retention policy; and — now the live one — **MCP tool
support**, which the Cursor-style automations page makes central rather than
optional. Our answer: build an MCP client from the open specification, as
`docs/plan/` describes.

## What survives from the old eras

Kept: `src/server` (transport, boot, settings RPCs, rate-budget client),
`src/model`, the ~16 golden-backed presentation kernels, `pipeline/`,
`tools/coverage`. Retired: the 60/40 meter as a progress measure, the
"EXACT REPRODUCTION" bar, the mega-thread, and the runner/MCP/PAT machinery.
