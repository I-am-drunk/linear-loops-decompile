#!/usr/bin/env bash
# pipeline/run.sh: the one command: download Linear, build the local corpus
# (gitignored). Stages skip existing outputs;
# `--force` rebuilds everything. Invoke from the repo root:  bash pipeline/run.sh
#   (the script self-locates once launched; the invocation path is relative).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD/.."
CORPUS="$PWD/corpus"
FORCE="${1:-}"
skip() { [ "$FORCE" != "--force" ] && [ -e "$1" ]; }

echo "== deps =="
command -v 7z >/dev/null || {
  if command -v sudo >/dev/null; then sudo apt-get update && sudo apt-get install -y p7zip-full; else apt-get update && apt-get install -y p7zip-full; fi
}
npm install --no-audit --no-fund   # js-beautify (pipeline/package.json)

if skip "$CORPUS/app/asar-src/out/main/index.js"; then
  echo "== 1/4 app: cached =="
else
  echo "== 1/4 app: download + extract =="
  bash download-and-extract.sh
fi

echo "== 2/4 client bundle crawl (resumable) =="
(cd "$CORPUS" && node ../crawl-client.mjs)

COUNT_CLIENT=$(find "$CORPUS/client" -name '*.js' 2>/dev/null | wc -l || true)
COUNT_PRETTY=$(find "$CORPUS/pretty/client" -name '*.js' 2>/dev/null | wc -l || true)
if [ "$COUNT_PRETTY" -eq "$COUNT_CLIENT" ] && [ "$COUNT_PRETTY" -gt 0 ] && [ "$FORCE" != "--force" ]; then
  echo "== 3/4 prettify: cached ($COUNT_PRETTY files); validating parse integrity =="
  if ! (cd "$CORPUS" && node ../prettify.mjs --check); then
    echo "== 3/4 prettify: cached output invalid; rebuilding with raw fallbacks =="
    (cd "$CORPUS" && node ../prettify.mjs)
  fi
else
  echo "== 3/4 prettify =="
  (cd "$CORPUS" && node ../prettify.mjs)
fi

# Analysis output stays INSIDE the gitignored corpus. It used to write
# `extracts/models.md` + `graphql-ops.md` in the repo root for committing;
# those catalogue Linear's internal API surface, so docs/PROVENANCE.md stops
# us refreshing them (owner decision 8 covers the files that already exist).
echo "== 4/4 analyze -> corpus/analysis (gitignored) =="
(cd "$CORPUS" && EXTRACTS_DIR="$CORPUS/analysis" node ../analyze.mjs)

echo "DONE. Everything written under pipeline/corpus/ — local only, never committed."
echo "Nothing to commit from this run; note material count deltas in KNOWLEDGE.md."
