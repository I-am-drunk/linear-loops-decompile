# tools/remap-graph — assembly-track sizing for the #295 remap ledger

Measures what the 60% UI-assembly track (issue #295) actually is, from the raw
corpus import graph, and emits the generated extracts the remap ledger's
assembly-cost column and the R-FACADE shard consume.

```
node --experimental-strip-types tools/remap-graph/main.ts report \
  [--corpus pipeline/corpus] \
  [--out-md extracts/assembly-graph.md] [--out-json extracts/assembly-graph.json]
```

Needs the local RAW corpus (`pipeline/corpus/client/` — vault fast path in
`pipeline/README.md`). The pretty tree is NOT read: it is execution-corrupted
(issue #225 R1) and its beautified import lines can differ from the shipped form.

What it computes (definitions in `graph.ts`):

- **Import graph** — static `from"./x"`, side-effect `import"./x"`, dynamic
  `import("./x")` edges between chunks.
- **Full closure** of the configured roots (`roots.json` — the #295
  widened-scope route chunks), in chunks and bytes.
- **Assembly set** — the closure excluding the configured monster chunks, split
  vendor-named vs app-named (lowercase-first-char rule; rolldown names app
  chunks after their PascalCase entry module).
- **Fan-in** within the assembly set — the bottom-up build-order signal.
- **Monster demand** — per monster, the distinct original export names the
  assembly set imports, and which chunks import them: the exact facade surface
  R-FACADE proposes (never "reimplement the monster").

Outputs are extracted facts only (chunk names, byte counts, edge relations,
minified symbol identifiers) — the same class `extracts/graphql-ops.md`
already commits; no chunk source text is emitted. Regenerate on corpus drift
(the 30-day check) in the same pass as the other extracts; the generated
header carries the `.corpus-head` provenance stamp.

Tests (`npm test` / ci/check-ui.sh corpus-free leg) run on a synthetic
fixture corpus — no Linear material.
