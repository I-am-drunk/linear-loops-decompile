#!/usr/bin/env bash
# ci/check-ui.sh — the UI parity gate (SPECS/ui-parity.md).
#
# 1. cargo test the parity tool itself.
# 2. When the corpus (pipeline/corpus, via the vault) AND our UI facts
#    (src/ui/ui-facts.json) are both present: extract the reference and run
#    the check. Without either: vacuous pass with a notice (mirrors
#    ci/check-src.sh's no-src stance; the corpus is local-only by design).

set -euo pipefail

if ! command -v cargo >/dev/null 2>&1; then
  echo "check-ui: cargo not found — install Rust (https://rustup.rs) to run the parity gate. Vacuous pass."
  exit 0
fi

echo "=== tools/parity (cargo test) ==="
cargo test --manifest-path tools/parity/Cargo.toml --quiet

if [ ! -d pipeline/corpus/pretty/client ]; then
  echo "check-ui: no local corpus (pipeline/corpus) — skipping extract/check. Vacuous pass."
  exit 0
fi
if [ ! -f src/ui/ui-facts.json ]; then
  echo "check-ui: src/ui/ui-facts.json not present — no UI facts declared yet. Vacuous pass."
  exit 0
fi

echo "=== parity extract (corpus → reference) ==="
cargo run --quiet --manifest-path tools/parity/Cargo.toml -- extract

echo "=== parity check ==="
cargo run --quiet --manifest-path tools/parity/Cargo.toml -- check \
  --tolerances tools/parity/policy/tolerances.json \
  --improvements tools/parity/policy/improvements.json \
  --report parity-report.md

echo "ci/check-ui.sh: OK"
