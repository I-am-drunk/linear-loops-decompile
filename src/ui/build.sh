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
node_modules/.bin/tsc \
  --target es2023 --module esnext --moduleResolution bundler \
  --strict --skipLibCheck --lib es2023,dom \
  --rewriteRelativeImportExtensions \
  --outDir "$out" \
  client.ts shell.ts routes.ts

echo "built -> $out"
