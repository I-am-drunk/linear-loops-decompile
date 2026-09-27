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
  echo "check-ui: no local corpus (pipeline/corpus) — skipping extract/check. Vacuous pass."
  exit 0
fi
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
