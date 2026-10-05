#!/usr/bin/env bash
# sx-<hash> -> its CSS declarations. The only honest way to read a StyleX value.
#
# Linear compiles styles to atomic classes. A component chunk names the classes
# it uses; only the compiled stylesheet says what they mean. See
# docs/UI-EXACTNESS.md.
#
#   bash pipeline/sx.sh sx-16grhtn
#   sx-16grhtn => .sx-16grhtn{width:220px}
set -euo pipefail
cd "$(dirname "$0")/.."

# Glob the hash: it rotates with every Linear deploy.
CSS=$(find pipeline/corpus/style -name 'style-*.css' 2>/dev/null | head -1)
if [ -z "$CSS" ]; then
  echo "pipeline/sx.sh: no stylesheet in pipeline/corpus/style — run: bash pipeline/run.sh" >&2
  exit 1
fi

if [ "$#" -eq 0 ]; then
  echo "usage: bash pipeline/sx.sh sx-16grhtn [sx-...]" >&2
  exit 2
fi

for c in "$@"; do
  printf '%s => ' "$c"
  LC_ALL=C grep -oaE "\.$c(\.$c)*\{[^}]*\}" "$CSS" | head -1 || true
  echo
done
