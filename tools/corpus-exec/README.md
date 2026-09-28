# corpus-exec — the golden runner (G1; SPECS/ui-parity.md "golden tier")

Executes a captured raw corpus chunk offline and records its computed outputs, so a
hand-made golden test is cheap to author and mechanical to re-verify. It
generalizes the H2/#215 recipe (issue #168) that produced the generateTheme
golden vectors, plus the render-mode spike from #225.

The tool never chooses inputs and never blesses outputs: the AUTHOR writes
the case file by hand, reads the emitted draft against the corpus source,
and commits it only after the verification block in the PR is filled. The
REVIEWER re-executes with `--verify` (mechanical byte-compare) and spot-reads
the corpus source. See the D2 protocol on issue #225.

### Executable source

When a corpus contains `client/`, corpus-exec executes that captured **raw**
ESM tree and records `{ flavor: "raw", path: "client" }` in provenance. The
readable `pretty/client/` projection is used only for legacy corpora that lack
raw bytes; it is never preferred when both exist. This prevents a prettifier
transform from becoming the behavioral oracle.

## Usage (needs a local corpus — pipeline/README.md)

```bash
# author a draft golden from a case file:
node --experimental-strip-types tools/corpus-exec/main.ts run <case.json> \
  [--corpus pipeline/corpus] [--out <file>]     # default: <case>.expected.json next to the case

# reviewer / CI re-verification (rebuild sandbox, re-run, byte-compare):
node --experimental-strip-types tools/corpus-exec/main.ts verify <case.json> \
  [--corpus pipeline/corpus] [--expected <file>]
```

Exit codes: 0 ok · 1 verify mismatch · 2 usage/tooling error (bad case file,
missing corpus, missing chunk, sandbox failure).

## The case file (committed; one per golden case)

```jsonc
{
  "unit": "ui-theme/generateTheme",        // the src module this golden proves
  "chunk": "ThemeHelper",                  // full basename OR prefix up to the first dot —
                                           // prefixes survive hash rotation across corpus
                                           // refreshes; the resolved full name + hash land in
                                           // provenance; ambiguity is a loud error, never a pick
  "stubs": {                                // chunk name/prefix -> replacement ESM
    "ThemeProvider": {
      "source": "export const l = false;", // inline for one-liners …
      // "file": "stubs/theme-provider.mjs", // … or a sibling file for real, reviewable ESM
      "why": "retina matchMedia boolean; both branch values pinned across the retina0/retina1 case pair"
    }
  },
  "invoke": {                               // plain-function mode …
    "export": "n",                          // minified export name …
    "exportMeaning": "generateTheme (ThemeHelper.CeMKYPhf.js:642 `export { u as n … }`)",
    "args": [{ "base": [5.52, 0.4, 272] }]
  },
  // … OR render mode (render-phase-pure React components only):
  // "render": { "export": "t", "exportMeaning": "…", "props": {},
  //             "context": { "value": { "color": {} }, "why": "…" } },
  // … OR drive mode, for setups JSON args cannot express (multi-step calls,
  // memoization checks): a hand-written sibling ESM driver, reviewed like a stub:
  // "drive": { "file": "drivers/derived-themes.mjs",
  //            "exportMeaning": "calls generateTheme then its elevatedTheme() member" },
  // the driver default-exports async ({ entry, load }) => value-to-serialize
  "notes": "what this case pins and why these inputs were chosen"
}
```

- **stubs** are the ONLY fake surface, each with a `why`; nondeterminism is
  quarantined at the stub (pin both branch values across a case pair when a
  branch matters), never normalized after the fact.
- **invoke** calls one export with the given args. **render** calls a React
  function component under a micro-dispatcher built on the CORPUS's own
  React: `useContext` returns `context.value`, `useSyncExternalStore`
  returns `getSnapshot()`, effects are no-ops, `useId` is pinned. Any hook
  the dispatcher does not implement throws loudly — a component that needs
  more is NOT coverable by this tier and stays on the coverage ledger as a
  gap (never silently faked).
- `exportMeaning` records the author's identification of the minified export
  with corpus-file evidence; identifying it IS part of the hand-verification.

## What it emits

`<case>.expected.json`: `{ provenance, output }`. Provenance is ordinary,
reviewable JSON (corpus git HEAD, entry + closure chunk hashes, stubs, closure
size). `output` is a recursively **tagged** value grammar: every accepted
JavaScript type is explicit (`null`, `undefined`, number including `-0`/NaN,
string, bigint, Date, sparse-array hole, plain object, host React element).
This is intentionally not ordinary JSON projection: a string such as
`"$date:…"` cannot masquerade as a Date. Values that have no injective,
reviewable representation—functions/symbols, accessors or nonstandard own
properties, instances, cycles, and composite React elements—fail loudly with
a path; drivers must project them explicitly or the unit waits for the T2
renderer. The sandbox closure is printed BEFORE execution (with its size) so
the author can judge feasibility and pick stub cut points from data — a
page-scale closure (hundreds of chunks) means "stub deeper or split the unit",
not "execute the world".

Committed goldens are computed values (facts) — the same legal category as
`extracts/` and `src/ui-theme/golden/` (#215 precedent). The corpus itself
never leaves `pipeline/corpus/`.

## Tests

`node --experimental-strip-types --test tools/corpus-exec/*.test.ts` runs on
fixture chunks under `fixtures/` (a miniature fake corpus) with no vault
needed. With a real corpus present, the corpus smoke re-derives one H2 theme
value and compares it against `src/ui-theme/golden/`; without one it skips
with a pointer.
