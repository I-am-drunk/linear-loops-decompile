# SPEC — the parity harness (`tools/parity`, Rust CLI)

The bar (issue #20, user directive): our Loops UI is **the same UI** Linear's
compiled client renders — structure, copy, theme, behavior — with explicit,
reviewed room for our own improvements. The v0 archive proved what happens
without a computed bar: a plausible-looking UI that is in fact invented. This
tool makes sameness *computed*, per slice, per session, before every UI PR.

## The one command (the most important thing, made perfect)

A session finishing a UI slice runs:

```bash
parity check            # ours (src/ui/ui-facts.json) vs the corpus reference
```

Exit 0 = the slice matches the reference within the declared tolerances and
declared improvements. Exit 1 = violations, with a Markdown report
(`parity-report.md`) that pastes straight into the PR as evidence. Everything
else in this tool exists to serve that command.

## Fact model (what "the same" means, computed)

Four fact families per UI surface (page/dialog/component), each an extracted
*fact* (legal line: condensed catalogs, never copied CSS/DOM/code):

1. **Routes** — exact paths (`/:orgKey/loop/:loopId/runs`, …). Source:
   `pipeline/corpus/analysis/routes.json`.
2. **Copy** — user-visible strings per surface (headings, buttons, empty
   states, aria labels). Source: string literals in the surface's corpus chunk.
   Compared *exactly* (zero tolerance — copy is the cheapest sameness).
3. **Structure** — component containment facts per surface
   (`AutomationNewDialog ⊃ LoopTemplateLibrary launcher`, sidebar item order).
   Source: chunk imports/JSX hierarchy in the prettified corpus.
4. **Theme tokens** — semantic token names (`bgBase`, `bgSub`, `textPrimary`…)
   and, where resolvable, values. Source: corpus theme chunk(s) for names and
   usage; *values* come from Linear's served CSS — see "Known seam" below.

Our side of the comparison is `src/ui/ui-facts.json`, maintained by the slice
PR (a later slice adds `parity scan` to derive it from our source). Both sides
are the same JSON shape; the checker is a pure function of two files.

## The range, for our improvements (declared, never ambient)

- `.parity/tolerances.json` (committed): global measurement bands. Strict
  defaults — copy exact, routes exact, token names exact, spacing ±1px when
  rendered measuring lands. Loosening a band is a PR-level decision.
- `.parity/improvements.json` (committed): the sanctioned-deviation list.
  `[{ surface, fact, theirs, ours, reason, issue }]`. The checker treats listed
  deviations as expected and *fails on unlisted ones*. When Linear's reference
  changes to match us, the entry is flagged stale — the list is self-cleaning.

## Commands and layers

| Command | Layer | Needs | When |
|---|---|---|---|
| `parity extract` | corpus → `.parity/reference.json` | corpus (vault fetch) | once per corpus refresh |
| `parity check` | static facts gate | reference + our facts | every UI PR (the gate) |
| `parity scan` (P2) | derive our facts from src/ui | src/ui | when hand-maintaining hurts |
| `parity render` (P2) | headless-Chrome DOM of our pages, folded into facts | a Chrome binary | per UI PR |
| `parity snap` (P3) | live capture of linear.app reference (DOM+computed styles+screenshots), local-only | the user's Linear session | occasional calibration |
| `parity shot` (P3) | pixel diff ours vs captured reference, tolerance-banded | P3 capture | before release-bar claims |

P1 ships `extract` + `check` + the fact model + tolerances/improvements. P2/P3
are documented here and built only when P1 is earning its keep (YAGNI).

## Known seam: theme token *values*

Linear's JS references hashed CSS vars (`--sx-*`); their values live in served
CSS assets the R1 crawler did not capture (JS-only BFS). Two paths, in order:
(1) pipeline slice: extend the crawl to same-origin `.css` assets — cheap,
keeps everything static; (2) P3 rendered capture reads computed styles. Until
either lands, the checker compares token *names and usage* and skips values.

## Repo fit

- Tool: `tools/parity/` — zero-dependency Rust (hand-rolled JSON; offline
  `cargo build`; no crates.io at run/build time). One static binary; sessions
  `cargo install --path tools/parity` once.
- Generated artifacts (`.parity/reference.json`, reports, captures) are
  **gitignored** — regenerated from the corpus deterministically. Committed:
  the tool, `tolerances.json`, `improvements.json`, and matrix row status
  flips with the report as evidence. Linear screenshots/captures: local only,
  never committed (issue #20 rule).
- Gate: `ci/check-ui.sh` (new) — `cargo test` for the tool, then
  `extract`+`check` when the corpus is present, vacuous pass with notice when
  not (mirrors `ci/check-src.sh`'s stance; Actions is billing-locked anyway).
- Matrix: `docs/feature-matrix.md` rows gain parity evidence by report paste;
  no auto-editing (YAGNI).

## Failure modes it must kill (the why, from the v0 incident)

- "Looks Linear-ish" invented UI → caught by copy/structure/token gates.
- Silent divergence accreting across slices → every UI PR carries the report.
- Improvements smuggled as parity → unlisted deviation = red.
- Reference rot → `extract` is deterministic per corpus; the 30-day drift
  check regenerates it and stale `improvements.json` entries self-flag.
