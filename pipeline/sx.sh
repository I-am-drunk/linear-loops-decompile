#!/usr/bin/env bash
# sx-<hash> -> its CSS declarations. The only honest way to read a StyleX value.
#
# Linear compiles styles to atomic classes. A component chunk names the classes
# it uses; only the compiled stylesheet says what they mean. See
# docs/UI-EXACTNESS.md.
#
#   bash pipeline/sx.sh sx-16grhtn
#   sx-16grhtn => .sx-16grhtn{width:220px}
#
# A class that is not in the stylesheet is a LOOKUP FAILURE, not a value of
# zero: it exits 1 and says so on stderr. Silently printing an empty result is
# how a typo or a rotated hash becomes an uncited UI value.
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

missing=0
for c in "$@"; do
  hit=$(LC_ALL=C grep -oaE "\.$c(\.$c)*\{[^}]*\}" "$CSS" | head -1 || true)
  if [ -z "$hit" ]; then
    # A silent empty line reads as "this class declares nothing", which is
    # how a typo becomes a UI value nobody cited. Say it is a lookup failure.
    printf '%s => NOT FOUND in %s\n' "$c" "$(basename "$CSS")" >&2
    missing=$((missing + 1))
  else
    printf '%s => %s\n' "$c" "$hit"
  fi
done

if [ "$missing" -gt 0 ]; then
  echo "pipeline/sx.sh: $missing class(es) not in the stylesheet." >&2
  echo "  A class that resolves to nothing is a typo or a rotated hash, not a" >&2
  echo "  value of zero. Re-read it out of the chunk, or refresh the corpus:" >&2
  echo "  bash pipeline/run.sh" >&2
  exit 1
fi
