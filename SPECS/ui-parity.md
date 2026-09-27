# SPEC — the parity harness (`tools/parity`, Rust CLI)

The bar (issue #20, user directive): our Loops UI is **the same UI** Linear's
compiled client renders — structure, copy, theme, behavior — with explicit,
reviewed room for our own improvements. The v0 archive proved what happens
without a computed bar: a plausible-looking UI that is in fact invented. This
tool makes sameness *computed*, per slice, per session, before every UI PR.

Scope fence (#162 consult): `tools/parity` is the bar for **rendered UI**
(matrix rows whose exactness is visible). Non-rendered rows — the run
streaming vocabulary (official `AiConversation` type zoo), the send→stream
contract, loop lifecycle semantics — name a different computed bar per row
(the goose trace `docs/golden-goose-chat-route.md`, runtime fixtures). Every
matrix row should eventually name its bar; parity covers the renderable ones.

## The one command (the most important thing, made perfect)

```bash
parity check            # ours (src/ui/ui-facts.json) vs the corpus reference
```

Exit 0 = the slice matches the reference within declared tolerances and
declared improvements. Exit 1 = violations, with a Markdown report
(`parity-report.md`) that pastes straight into the PR as evidence.

## Fact model (what "the same" means, computed)

Per UI surface. Set families (compared as sets; missing/extra are deviations):

1. **routes** — the Loops/agent route table (synthetic surface `app.routes`).
   Extraction reads `analysis/routes.json` AND scans chunk bodies for
   `` `/:orgKey/…` `` literals — the index is a floor, not a ceiling (#157
   meta finding).
2. **copy** — user-visible strings, exact-compared (zero tolerance; copy is
   the cheapest sameness). Extraction grammar: all three string-literal forms
   (compiled JSX carries copy as `children:` props, backtick literals, and
   props into shell components), filtered to sentence-case UI text. The
   **canary list** (`policy/canaries.txt`) proves the grammar on every
   extraction: a canary absent from the corpus = drift alarm; present but not
   extracted = grammar regression. Both fail loudly — never a silent false
   green. Placeholder grammar for dynamic strings (`{count}`, dates) is a
   P2 item with the first dynamic-canary need.
3. **structure** — component containment (import edges within a surface's
   chunks).
4. **tokens** — semantic theme-token names (surface `theme.tokens`).
5. **bindings** — model fields the surface displays/edits (schema in P1;
   extraction lands with the surface-crafting slices).
6. **icons** — icon-set membership per slot (same ramp).
7. **behavior** — "event → effect" facts (click X navigates Y) (same ramp).
8. **states** — state-conditional visibility facts (empty/loading/disabled).

Plus two non-set facts:

9. **order** — ordered presentation (sidebar items, column order), compared
   as ONE whole-sequence fact ("a > b > c"); containment alone misses order.
10. **primitive** — the surface's interaction primitive (dialog | page |
    popover | drawer | …), exact-compared: a route can be exact while the
    primitive is wrong.

**Ramp rule:** a family compares only where the reference carries facts for
it. Empty-reference families print as "uncovered" report notes — the bar binds
where we can measure; never false-red, never silent-green.

## Theme: two layers (corrected by the #157 audits)

- **Token VALUES are generated at runtime** by the corpus's own theme
  generator (`ThemeHelper` + parametrizations; `--sx-*` vars ship EMPTY in the
  compiled CSS). The extractor slice executes the generator offline in Node
  (default dark: base [5.52,0.4,272], accent [47.92,59.30,288.42], contrast 27;
  116 color + 18 shell tokens, content-hashed) and emits golden vectors.
  Owned by sess_01a0e393-0683 (volunteered on #162) — DO NOT duplicate.
- **Non-token values** (radii, shadows, layout metrics): the compiled
  stylesheet is in the vault at `corpus/style/style-*.css` (same build).
- P1 extracts token NAMES (done); value comparison lands with the golden
  vectors slice.

## The range, for our improvements (declared, never ambient)

- `tools/parity/policy/tolerances.json` — global bands; strict defaults
  (copy/routes/names exact, ±1px spacing when rendered measuring lands).
  Loosening is a PR decision.
- `tools/parity/policy/improvements.json` — the ONLY sanctioned deviation
  channel: `[{ surface, family, fact, reason, issue }]`. Unlisted deviation =
  red — **including ours-only surfaces** (family `"surface"`, fact = the
  surface name; an invented page is a deviation like any other). For
  `missing` and `differs` deviations, `fact` is the REFERENCE-side value (for
  `order`: the reference chain), so entries stay stable as our side evolves;
  for `extra` facts and ours-only surfaces there is no reference side — `fact`
  is the added value (the ours-side fact or the surface name). Stale entries (reference caught
  up) self-flag in the report.

## Commands and layers

| Command | Layer | Needs | When |
|---|---|---|---|
| `parity extract` | corpus → `.parity/reference.json` (gitignored) | corpus (vault) | per corpus refresh |
| `parity check` | static facts gate | reference + our facts | every UI PR (the gate) |
| `parity scan` (P2) | derive our facts from src/ui | src/ui | when hand-maintaining hurts |
| `parity render` (P2) | headless-Chrome DOM of our pages | a Chrome binary | per UI PR |
| `parity snap` (P3) | live linear.app capture, local-only | user's Linear session | occasional calibration |
| `parity shot` (P3) | pixel diff with tolerances | P3 capture | release-bar claims |

## Toolchain and gate ops (peer asks, adopted)

- Zero-dependency Rust, pinned via `tools/parity/rust-toolchain.toml`;
  hand-rolled JSON bounded to our fact-file grammar with round-trip fuzz
  tests (2,000 cases) + garbage rejection.
- Runner sandboxes ship node but NO cargo: install once with
  `curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal`
  (+ `apt-get install -y gcc` for the linker). `ci/check-ui.sh` SKIPS with a
  printed pointer when cargo is absent (peer-mandated fail-soft: the gate must
  not red sessions that cannot install Rust; the vacuous pass is deliberate,
  not a hole — UI PRs from cargo-capable sessions still run the full check).
  `ci/check-src.sh` stays untouched: the gates red independently.
- Gate modes, exactly: no cargo → skip with pointer · no corpus → vacuous ·
  corpus, no `src/ui` → extract (canaries enforced), vacuous check ·
  `src/ui` without `ui-facts.json` → **FAIL** (declared facts are part of the
  slice) · facts present → full check.
- Corpus guards in `extract` (#205; both loud exit-2 failures, no reference
  written): **integrity** — every chunk `analysis/chunks.json` names must be
  present in `pretty/client/` (a shortfall = partial/stale copy; full
  `git clone` of the vault, #187); **unmatched surface** — a matrix component
  matching zero chunks fails by name (never a silently omitted surface). The
  #162 INFRA ALERT (1,043/1,550 stale copy → silent partial reference) is the
  incident both guards close.

## Repo fit and the legal line

- Tool + policy + spec committed; generated artifacts (`.parity/`,
  `parity-report.md`, captures) gitignored and deterministically regenerated.
  Peer legal review (#162): condensed-facts references (routes, strings,
  token names/values) do NOT cross the line; Linear's code and raw assets stay
  vault-side. Screenshots/captures: local only, never committed (issue #20).
- Matrix rows gain parity evidence by report paste; no auto-editing (YAGNI).

## Failure modes it must kill (the why, from the v0 incident)

- "Looks Linear-ish" invented UI → copy/structure/token/primitive gates.
- Silent divergence across slices → every UI PR carries the report.
- Improvements smuggled as parity → unlisted deviation = red.
- Extraction regressions masquerading as parity → canaries fail the extract.
- Reference rot → deterministic extract per corpus; 30-day drift check
  regenerates; stale improvements self-flag.
