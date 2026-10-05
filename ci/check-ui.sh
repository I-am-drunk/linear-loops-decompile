#!/usr/bin/env bash
# ci/check-ui.sh — the UI parity gate (SPECS/ui-parity.md).
#
# Corpus-free legs (run on EVERY invocation — a green gate always attests
# something, #225 D3):
#   1. tools/corpus-exec node tests (the golden runner, G1).
#   2. tools/coverage node tests + `coverage check` (the ledger joins
#      matrix x corpus-manifests x goldens; consistency errors are red, G2).
# Toolchain-gated:
#   3. A UI package must declare ui-facts.json (corpus-free; runs ALWAYS).
# Corpus-gated legs (labeled skips, never silent):
#   4. cargo test the parity tool; golden re-verification; extract + check of
#      our declared facts against the corpus reference.
#
# Ordering is load-bearing: every corpus-free leg runs before the corpus gate,
# so a sandbox without a corpus still cannot green-light an undeclared UI.

set -euo pipefail

echo "=== tools/corpus-exec (node --test; the golden runner, G1) ==="
node --experimental-strip-types --test tools/corpus-exec/corpus-exec.test.ts

echo "=== coverage ledger (node --test + check; corpus-free, never vacuous — G2) ==="
node --experimental-strip-types --test tools/coverage/coverage.test.ts
node --experimental-strip-types tools/coverage/main.ts check --repo .
# ---------------------------------------------------------------------------
# Corpus-FREE declaration checks. These run BEFORE *both* early returns.
#
# There are two `exit 0`s below — one for a missing Rust toolchain, one for a
# missing corpus — and a declaration check placed after either is unreachable
# in exactly the situation a fresh sandbox is in. A factless UI package then
# gets a GREEN gate. That is the hole issue #200 was filed about; PR #320 fell
# through the corpus one, and PR #324's review caught that the cargo one was
# still open. Asking whether a package declares its facts needs neither a
# corpus nor a toolchain, so it is asked first and unconditionally.
# ---------------------------------------------------------------------------
echo "=== ui-facts: every UI value declared and cited (corpus-free) ==="
node --test tools/ui-facts/ui-facts.test.mjs
node tools/ui-facts/main.mjs .

echo "=== doc cross-references resolve (corpus-free) ==="
node tools/ui-facts/check-links.mjs .

# Belt-and-braces: ui-facts/main.mjs only treats a dir as a UI package when it
# emits CSS. A UI dir that ships markup but no stylesheet yet still owes facts.
if [ -d src/ui ] && [ ! -f src/ui/ui-facts.json ]; then
  echo "check-ui: FAIL — src/ui exists but declares no ui-facts.json." >&2
  echo "  Every UI slice ships the facts it claims (SPECS/ui-parity.md)." >&2
  echo "  Each entry: the value, and the corpus citation it came from." >&2
  echo "  A UI package with no facts file has nothing to check and cannot pass." >&2
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  if [ "${CHECK_UI_STRICT:-0}" = "1" ]; then
    echo "check-ui: FAIL — cargo not found and CHECK_UI_STRICT=1 (install Rust: rustup + gcc; see tools/parity/README.md)." >&2
    exit 1
  fi
  echo "check-ui: cargo not found — declaration legs passed; the parity VALUE legs did NOT run."
  echo "check-ui: install Rust (https://rustup.rs) to run them, or set CHECK_UI_STRICT=1 to make this a failure."
  echo "check-ui: a reviewer merging a UI slice should run with a toolchain."
  exit 0
fi

echo "=== tools/parity (cargo test) ==="
cargo test --manifest-path tools/parity/Cargo.toml --quiet


# Two different corpus needs, so two separate gates:
#   - VALUE legs (parity extract/check) read raw `client/` + `style/*.css`.
#     StyleX classes resolve against the stylesheet and literals are exact in
#     minified source, so a crawl-only corpus is enough.
#   - GOLDEN re-verification EXECUTES corpus modules, which needs the
#     prettified ESM tree from the prettify stage.
# Gating everything on `pretty/` made a usable crawl-only corpus look absent.
if [ ! -d pipeline/corpus/client ]; then
  echo "check-ui: no local corpus (pipeline/corpus) — golden re-verification and parity extract/check SKIPPED."
  echo "check-ui: regenerate with 'bash pipeline/run.sh' (public assets, no credentials) before reviewing a UI slice."
  echo "check-ui: declaration legs passed; VALUE comparison did NOT run."
  exit 0
fi

echo "=== corpus-exec verify: every committed golden case re-executes byte-identically (#257 review) ==="
# Without this leg a guard regression in the CORPUS-side behavior a case pins
# (e.g. the reduced-motion override) stays invisible: the package tests only
# compare committed bytes to committed bytes. A corpus-exec case is a
# src/*/golden/*.json with a sibling *.expected.json (H2 theme VECTOR files
# have no expected sibling and are re-derived by the corpus-exec suite's own
# smoke instead).
find src -path '*/golden/*.json' ! -name '*.expected.json' -print0 | while IFS= read -r -d '' case_file; do
  [ -f "${case_file%.json}.expected.json" ] || continue
  echo "--- verify: $case_file"
  node --experimental-strip-types tools/corpus-exec/main.ts verify "$case_file" --corpus pipeline/corpus
done
echo "=== parity extract (corpus → reference; canaries enforced) ==="
cargo run --quiet --manifest-path tools/parity/Cargo.toml -- extract

# The FAIL case for a factless src/ui is handled corpus-free above.
if [ ! -f src/ui/ui-facts.json ]; then
  echo "check-ui: no src/ui package — extraction healthy; there is no UI slice to compare yet."
  exit 0
fi

echo "=== parity check ==="
cargo run --quiet --manifest-path tools/parity/Cargo.toml -- check \
  --tolerances tools/parity/policy/tolerances.json \
  --improvements tools/parity/policy/improvements.json \
  --report parity-report.md

echo "ci/check-ui.sh: OK"
