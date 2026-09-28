#!/usr/bin/env bash
# ci/check-ui.sh — the UI parity gate (SPECS/ui-parity.md).
#
# Corpus-free legs (run on EVERY invocation — a green gate always attests
# something, #225 D3):
#   1. tools/corpus-exec node tests (the golden runner, G1).
#   2. tools/coverage node tests + `coverage check` (the ledger joins
#      matrix x corpus-manifests x goldens; consistency errors are red, G2).
# Corpus/toolchain-gated legs (labeled skips, never silent):
#   3. cargo test the parity tool itself.
#   4. When the corpus (pipeline/corpus, via the vault) AND our UI facts
#      (src/ui/ui-facts.json) are both present: extract the reference and run
#      the check.

set -euo pipefail

(cd tools/corpus-exec && npm ci --no-audit --no-fund)

echo "=== tools/corpus-exec (node --test; the golden runner, G1) ==="
node --experimental-strip-types --test tools/corpus-exec/*.test.ts

echo "=== coverage ledger (node --test + check; corpus-free, never vacuous — G2) ==="
node --experimental-strip-types --test tools/coverage/coverage.test.ts
node --experimental-strip-types tools/coverage/main.ts check --repo .

if ! command -v cargo >/dev/null 2>&1; then
  if [ "${CHECK_UI_STRICT:-0}" = "1" ]; then
    echo "check-ui: FAIL — cargo not found and CHECK_UI_STRICT=1 (install Rust: rustup + gcc; see tools/parity/README.md)." >&2
    exit 1
  fi
  echo "check-ui: cargo not found — install Rust (https://rustup.rs) to run the parity gate. Vacuous pass (set CHECK_UI_STRICT=1 to make this a failure; reviewers merging UI slices should run with a toolchain)."
  exit 0
fi

echo "=== tools/parity (cargo test) ==="
cargo test --manifest-path tools/parity/Cargo.toml --quiet

if [ ! -d pipeline/corpus/pretty/client ]; then
  echo "check-ui: no local corpus (pipeline/corpus) — skipping golden re-verification and extract/check. Vacuous pass."
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

if [ ! -f src/ui/ui-facts.json ]; then
  if [ -d src/ui ]; then
    echo "check-ui: FAIL — src/ui exists but declares no ui-facts.json (SPECS/ui-parity.md: every UI slice ships its facts)." >&2
    exit 1
  fi
  echo "check-ui: no src/ui package — extraction healthy, nothing to check yet. Vacuous pass."
  exit 0
fi

echo "=== parity check ==="
cargo run --quiet --manifest-path tools/parity/Cargo.toml -- check \
  --tolerances tools/parity/policy/tolerances.json \
  --improvements tools/parity/policy/improvements.json \
  --report parity-report.md

echo "ci/check-ui.sh: OK"
