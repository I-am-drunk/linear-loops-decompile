# parity — the UI parity harness (SPECS/ui-parity.md)

Computes whether our Loops UI matches the UI Linear's compiled client renders —
per slice, per PR, with a declared range for our improvements. Zero-dependency
Rust; builds offline; no runtime deps.

## The loop

```bash
# once per corpus refresh (corpus comes from the vault — pipeline/README.md):
cargo run -p parity --manifest-path tools/parity/Cargo.toml -- extract
# → .parity/reference.json (gitignored, deterministic per corpus)

# every UI slice, before the PR:
cargo run -p parity --manifest-path tools/parity/Cargo.toml -- check
# exit 0 = pass; exit 1 = undeclared deviations (see stdout + parity-report.md)
```

`check` compares `src/ui/ui-facts.json` (your slice declares the facts it
ships: routes, copy strings, component containment, theme-token usage) against
the reference. Paste `parity-report.md` into the PR as the parity evidence.

## The range, for our improvements

- `tools/parity/policy/tolerances.json` — global bands (strict defaults;
  loosening is a PR decision).
- `tools/parity/policy/improvements.json` — the only sanctioned deviation
  channel: `[{ surface, family, fact, reason, issue }]`. Unlisted deviation =
  red. Stale entries (reference caught up) are flagged in the report.

## Facts (legal line)

Fact files are condensed catalogs of observable facts (route paths, UI strings,
component names, token names) — the same category as `extracts/`. The corpus,
the generated reference, reports, and any Linear captures stay local and
gitignored.

## Commands

```
parity extract [--corpus pipeline/corpus] [--matrix docs/feature-matrix.md]
               [--out .parity/reference.json] [--canaries FILE]
parity check   [--facts src/ui/ui-facts.json] [--ref .parity/reference.json]
               [--tolerances FILE] [--improvements FILE] [--report FILE]
```

`extract` enforces the copy canaries (`policy/canaries.txt` by default): a
canary missing from the corpus is a drift alarm; present-but-not-extracted is
a grammar regression. Both fail loudly.

Exit codes: 0 pass · 1 parity violations · 2 usage/tooling error.

Fact families: routes, copy, structure, tokens, bindings, icons, behavior,
states (set-compared) + order (whole-sequence) + primitive (exact scalar).
A family compares only where the reference has facts for it (ramp rule).
`order` extraction (H3 #207): `` orderingKey: `k` `` chains (column order) and
`` key:/name: `` options-array chains (filter/section order); longest chain per
surface; pinned by `order:<Surface>=<a> > <b> > …` canary lines.
Synthetic app-level surfaces: `app.routes` (route table — chunk-body scan,
because the analysis index is a floor) and `theme.tokens` (token namespace;
VALUES come from the theme-generator golden-vectors slice, #162).

No cargo on a fresh sandbox? `curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal`
(+ `apt-get install -y gcc` for the linker). The gate skips with a pointer
when cargo is absent.

Tests: `cargo test --manifest-path tools/parity/Cargo.toml` (fixture corpus,
no real corpus needed). Gate: `bash ci/check-ui.sh`.
