#!/usr/bin/env bash
# ci/check-src.sh — typecheck + test every package under src/, package-driven.
#
# Each src/<pkg>/ with a tsconfig.json is checked with ITS OWN tsconfig (the
# package is the source of truth for its compiler options — see work/LANDING.md
# §Conventions for the two legal import-extension styles). Runs the package's
# own `npm test` when it declares one; otherwise:
#   - packages with a tsconfig.build.json (`.js`-extension, compile-first style)
#     are emitted to dist/ and the emitted *.test.js are run;
#   - everything else (`.ts`-extension style) runs *.test.ts directly via
#     Node's type stripping (Node >= 22.18; the flag is passed explicitly so
#     older 22.x still works).
#
# Bare package.json manifests (no devDependencies — e.g. zero-runtime-dep
# packages) get a pinned typescript + @types/node installed --no-save.
#
# Exits non-zero on the first failing package. Safe on a repo with no src/
# packages yet (passes vacuously with a notice).

set -euo pipefail

TSC_VERSION="5.9"
TYPES_NODE_VERSION="22"

# --- dependency pre-pass -----------------------------------------------------
# Cross-package type imports (e.g. engine → ../model/loop-config.ts → zod)
# resolve node_modules from the IMPORTED package's tree, never the importer's
# — so every package's deps must exist before ANY package compiles. The
# check loop installs per-package in glob order (engine before model), which
# dies on a pristine clone (found by agent-02@gen4, issue #2). Install all
# package deps up front; the loop below then no-ops on install.
for tsconfig in src/*/tsconfig.json; do
  [ -e "$tsconfig" ] || continue
  pkg=$(dirname "$tsconfig")
  [ -f "$pkg/package.json" ] || continue
  echo "=== $pkg (install) ==="
  (cd "$pkg" && npm install --no-audit --no-fund)
done

has_jq_expr() { # has_jq_expr <dir> <node-eval-expr-over-p>
  (cd "$1" && node -e "const p=require('./package.json');process.exit(($2)?0:1)")
}

# ---------------------------------------------------------------------------
# UI exactness. Lives here because `typecheck` is the required CI check and
# this must run on EVERY PR — it is the gate that stops a UI built from memory
# (docs/UI-EXACTNESS.md). Corpus-free and ~1s, so it costs nothing.
#
# `ci/check-ui.sh` runs these too, plus the corpus value comparison. Keeping
# them in both is deliberate: the one that always runs must never be the one
# that can be skipped.
# ---------------------------------------------------------------------------
echo "=== ui-facts: every UI value declared and cited ==="
node --test tools/ui-facts/ui-facts.test.mjs tools/ui-facts/check-links.test.mjs
node tools/ui-facts/main.mjs .

echo "=== doc cross-references resolve ==="
node tools/ui-facts/check-links.mjs .

found=0
for tsconfig in src/*/tsconfig.json; do
  [ -e "$tsconfig" ] || continue
  pkg=$(dirname "$tsconfig")
  found=1
  echo "=== $pkg ==="
  (
    cd "$pkg"

    # --- dependencies -------------------------------------------------------
    if [ ! -f package.json ]; then
      npm init -y >/dev/null
    fi
    npm install --no-audit --no-fund
    if ! has_jq_expr . "p.devDependencies && p.devDependencies.typescript"; then
      echo "($pkg: no declared typescript — installing pinned toolchain --no-save)"
      npm install --no-save --no-audit --no-fund \
        "typescript@$TSC_VERSION" "@types/node@$TYPES_NODE_VERSION"
    fi

    # --- typecheck ----------------------------------------------------------
    echo "--- tsc --noEmit -p tsconfig.json"
    npx tsc --noEmit -p tsconfig.json

    # --- tests --------------------------------------------------------------
    if has_jq_expr . "p.scripts && p.scripts.test"; then
      echo "--- npm test"
      npm test
    elif [ -f tsconfig.build.json ]; then
      echo "--- compile-first tests (tsconfig.build.json -> dist/)"
      rm -rf dist
      npx tsc -p tsconfig.build.json
      mapfile -t emitted < <(find dist -name '*.test.js' | sort)
      if [ "${#emitted[@]}" -gt 0 ]; then
        node --test "${emitted[@]}"
      else
        echo "(no emitted *.test.js — typecheck only)"
      fi
    else
      mapfile -t tts < <(find . -path ./node_modules -prune -o -name '*.test.ts' -print | sort)
      if [ "${#tts[@]}" -gt 0 ]; then
        echo "--- node --experimental-strip-types --test (${#tts[@]} files)"
        node --experimental-strip-types --test "${tts[@]}"
      else
        echo "(no tests — typecheck only)"
      fi
    fi
  )
done

if [ "$found" = 0 ]; then
  echo "No src/* packages with tsconfig.json found — nothing to check (vacuous pass)."
fi
echo "ci/check-src.sh: OK"
