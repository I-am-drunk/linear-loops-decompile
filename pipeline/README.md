# pipeline: local analysis harness

## Scope and limits

This harness downloads a Linear release and unpacks it **locally** so a session
can understand how something behaves. Its output tree (`corpus/`) is gitignored
and must never enter this public repo.

This harness is how UI work gets its values. `docs/UI-EXACTNESS.md` is the
procedure; the short version is that every dimension, spacing value, radius and
font stack in our CSS is read out of the corpus this builds and cited in the
package's `ui-facts.json`. Commit only our own code — never Linear's bundles or
source.

Run it yourself:

```bash
bash pipeline/run.sh
```

There is no shared corpus repo and no token to fetch. The vault-clone fast path
and its `GIT-TOKEN.md` were removed in the 2026-10-04 rearchitecture along with
the rest of the credential machinery; if you need the corpus, generate it.

**Verify before trusting any corpus.** A partial tree fails silently and
produces confidently wrong analysis — a 1,043-of-1,550-file fetch once produced
both a false "corpus incomplete" alarm and a false "zero drift" pass.

Note what the obvious check does NOT prove. `analyze.mjs` writes one
`chunks.json` entry per `.js` file it finds, so comparing those two numbers
only shows the index matches the files on disk — an incomplete crawl agrees
with itself:

```bash
python3 -c "import json; print(len(json.load(open('pipeline/corpus/analysis/chunks.json'))))"
find pipeline/corpus/pretty/client -name '*.js' | wc -l   # equal even if the crawl skipped files
```

For completeness you need a source independent of the index: every asset
reference the crawl DISCOVERED must have been fetched. `crawl-client.mjs`
currently swallows a failed fetch without recording which asset it was — it
reports per-round totals only — **so there is no log to check and no
independent verification available today.** Treat the counts as "the index
agrees with the disk", never as "the crawl was complete". Adding per-asset
failure logging is the fix and is not done.

**Raw, not pretty, for any value you care about.** The prettifier rewrites
template-literal interiors, so a string read from `pretty/` can be byte-wrong
while looking right. Read values from the raw `client/*.js` tree or from
executed output; `pretty/` is for structure and identifiers only. The proof
case is a label whose overflow suffix has no space before the `+`: correct in
raw, corrupted in pretty, and a reviewer's pretty-tree check confirmed the
wrong bytes before anyone noticed (PR #307, #312).

This generalizes past this harness. Any formatter in a reading path needs a
byte-preservation check; js-beautify also silently corrupted three chunks into
invalid JS here, one of them the model layer.

**Indexes are a floor, not a ceiling.** `graphql-ops.json` reported 258
operations where 376 existed; `routes.json` missed routes that only appear as
chunk literals. Grep the corpus to confirm a negative; never cite an index as
proof that something is absent.

The drift check has a SECOND leg (issue #185): the official docs move under us
too (the 2026-04-01 refresh-token migration and the 2026-09-25 agent-skill ops
both shipped as doc changes). In the same pass:

1. Re-fetch every page listed in `extracts/linear-official/docs-site/README.md`
   (plain `curl` works — the pages are server-rendered).
2. Diff the FACTS against the corresponding `docs-site/<page>.md` digest —
   quotas, header names, status codes, retry ladders, token lifetimes.
3. Update the digests and bump their `Fetched` dates even when nothing changed.
4. Log material deltas in `KNOWLEDGE.md` (same rule as corpus drift).

## Running the pipeline (the 30-day job)

```bash
bash pipeline/run.sh
```

What it does:

1. Downloads the latest Linear desktop release (macOS universal DMG) and extracts
   the Electron asar shell.
2. Crawls the full production web client bundle from static.linear.app
   (~1,550 chunks, ~29 MB; BFS over Vite asset references; no source maps exist).
3. Prettifies every chunk. Every beautifier output is parsed as ESM and its
   template-token structure is compared to raw input (the narrowly targeted
   guard for js-beautify's known template-literal corruption). When a candidate
   is invalid or changes that structure, the pipeline preserves the raw bytes
   verbatim and reports a `raw-fallback`. Cached `pretty/` trees receive the
   same checks before reuse and rebuild if any artifact is invalid.
4. Analyzes the corpus into `analysis/*.json` — all of it gitignored.

   It also regenerates the committed `extracts/models.md` +
   `extracts/graphql-ops.md` catalogs when `EXTRACTS_DIR` points at the repo's
   `extracts/`; see §Where things live.

## Where things live (this is the whole point)

- `pipeline/corpus/`: ALL Linear material. Gitignored. Never committed, never
  copied into the repo, never pasted anywhere public. (Legal line; AGENTS.md.)
  - `corpus/app/`: DMG, extracted .app, `asar-src/`
  - `corpus/client/`: raw chunks
  - `corpus/pretty/client/`: readable chunks
  - `corpus/analysis/`: `graphql-ops.json`, `models.json`, `routes.json`, `chunks.json`
- `extracts/linear-official/`: Linear's own MIT-licensed schema, SDK and docs
  digests. The public-API authority — cite it for anything the public API
  guarantees.
- `extracts/models.md`, `extracts/graphql-ops.md`, `extracts/config-endpoints.md`:
  condensed catalogs of model fields and client operations, regenerated by the
  analyze stage. Facts only (names, shapes) — never Linear's code.

## Re-running

Stages skip existing outputs. `bash pipeline/run.sh --force` rebuilds everything.
The crawl stage is resumable (existing chunks are skipped); if a chunk 404s,
Linear deployed mid-crawl: re-run (hashes rotate).

## Expected counts (2026-09-28 baseline, layout-invariant grammars — issue #241)

~1,550 chunks, ~136 models (all with fields), ~376 GraphQL ops, ~490 routes
(unique paths). Earlier baselines undercounted from grammar bugs, not corpus
drift: the pre-#241 baseline said 87 models / 258 ops because (a) the old
beautifier injected newlines inside template literals, hiding 49 model
registrations from the fixed-layout grammar, and (b) the global literal-pairing
regex desynced on escaped newlines, dropping 118 ops (the anchored grammar
agrees exactly with the raw minified tree, 376 = 376). The pre-2026-09-27
route baseline said ~119 because only route-table registrations were extracted
— issue #174 added match-helper route literals, recovering e.g. the Loops list
route `/:orgKey/loops/:viewType?`. Drift is normal (Linear ships constantly):
note material deltas in `KNOWLEDGE.md`. `pipeline/analyze.test.mjs` holds the
layout-invariance contract (identical facts from a beautified and a minified
rendering).

## Finding things in the corpus

- Model fields: registration looks like ``XX=C([M(`ModelName`)],XX)``; fields
  decorate as ``C([...],XX.prototype,`field`,void 0)`` in the ~40 KB before it.
  Grep ``M(` `` for the model list; most live in the Issue mega-chunk.
- GraphQL ops: backtick strings starting with `query|mutation|subscription Name`.
- Pages/routes: chunk filenames are semantic (`AutomationRunsPage.<HASH>.js`);
  routes via ``Gt(`/:orgKey/...` `` patterns.
- Config/endpoints: `config.<HASH>.js` (flat VITE_* module).
- Enums: search the prettified mega-chunk for distinctive values (e.g.
  `directChat`).
- Golden-goose trace (issue #14): hunt the AI chat ops in
  `corpus/analysis/graphql-ops.json` first, then read their call sites in
  `corpus/pretty/client/` for the streaming mechanism and auth context.

## Troubleshooting

- 7z prints "Headers Error" on the DMG: expected (HFS+), extraction still succeeds.
- Entry regex fails: the login page structure changed; view-source
  https://linear.app/login and find the new
  `static.linear.app/client/assets/html.*.js` script tag.
