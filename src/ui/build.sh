#!/usr/bin/env bash
# Emit the client bundle into a static dir the server can serve.
#
# No bundler: `tsc` compiles the shell's module graph to plain ESM and the
# browser loads it directly. The only transform is dropping types, which is
# why every import here is extension-qualified.
set -euo pipefail
cd "$(dirname "$0")"
out="${1:-../server/static}/ui"

test -x node_modules/.bin/tsc || npm install --no-audit --no-fund >/dev/null

mkdir -p "$out"
# Same strict set as tsconfig.json, including the two repo-convention options.
# Only our three browser modules are inputs — the theme runs server-side, so
# `ui-theme` is not in this graph at all (see TYPECHECK.md).
node_modules/.bin/tsc \
  --target es2023 --module esnext --moduleResolution bundler \
  --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess \
  --skipLibCheck --lib es2023,dom \
  --rewriteRelativeImportExtensions \
  --outDir "$out" \
  client.ts shell.ts routes.ts

echo "built -> $out"
