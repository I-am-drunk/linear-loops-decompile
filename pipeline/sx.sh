#!/usr/bin/env bash
# sx-<hash> -> its real CSS declarations. The only honest way to read a
# StyleX value: the chunk tells you which atomic class a component uses, and
# the compiled stylesheet tells you what that class actually declares.
#
#   bash pipeline/sx.sh sx-16grhtn sx-11iknt3
#   sx-16grhtn => .sx-16grhtn{width:220px}
#   sx-11iknt3 => .sx-11iknt3{padding-left:6px}
#
# The stylesheet filename carries a content hash that Linear rotates on
# redeploy (issue #329), so it is DISCOVERED here rather than pinned. Pinning
# it is how a tool starts reporting "not found" for values that are present.
set -euo pipefail

# Resolve the corpus relative to this script, not to anyone's home directory.
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
STYLE_DIR="$ROOT/pipeline/corpus/style"

if [ ! -d "$STYLE_DIR" ]; then
  echo "sx: no corpus at $STYLE_DIR — run 'bash pipeline/run.sh' first." >&2
  exit 2
fi

# Newest .css wins if a stale crawl left more than one behind.
CSS=$(ls -t "$STYLE_DIR"/*.css 2>/dev/null | head -1)
if [ -z "${CSS:-}" ]; then
  echo "sx: no stylesheet in $STYLE_DIR — the crawl is incomplete." >&2
  exit 2
fi

if [ "$#" -eq 0 ]; then
  echo "usage: bash pipeline/sx.sh sx-16grhtn [sx-...]" >&2
  echo "  reading: $(basename "$CSS")" >&2
  exit 64
fi

missing=0
for c in "$@"; do
  # Atomic classes can appear as `.a{...}` or doubled `.a.a{...}` for
  # specificity, so match either shape.
  decl=$(LC_ALL=C grep -oaE "\.$c(\.$c)*\{[^}]*\}" "$CSS" | head -1 || true)
  if [ -n "$decl" ]; then
    printf '%s => %s\n' "$c" "$decl"
  else
    printf '%s => NOT FOUND in %s\n' "$c" "$(basename "$CSS")"
    missing=1
  fi
done

# A class that is absent is a real answer, not a glitch: cite nothing for it.
exit "$missing"
