#!/usr/bin/env bash
# Linear desktop download + DMG/asar extraction (Linux). Tested 2026-09-26, v1.32.4.
set -euo pipefail
mkdir -p linear-re && cd linear-re

echo "== 1. Download Linear macOS DMG (universal) =="
curl -sL -o Linear-universal.dmg "https://releases.linear.app/mac"
ls -la Linear-universal.dmg

echo "== 2. Extract DMG (HFS+) =="
command -v 7z >/dev/null || sudo apt-get install -y p7zip-full
7z x -oextracted Linear-universal.dmg || true   # 7z reports a header error on HFS; extraction still succeeds
APP="extracted/Linear/Linear.app/Contents"

echo "== 3. Verify =="
python3 - "$APP/Info.plist" <<'PY'
import plistlib,sys
d = plistlib.load(open(sys.argv[1],'rb'))
print("version:", d["CFBundleShortVersionString"])
print("asar integrity:", d.get("ElectronAsarIntegrity"))
PY

echo "== 4. Extract app.asar (Electron shell) =="
npx -y @electron/asar extract "$APP/Resources/app.asar" asar-src
find asar-src -type f | head -20
echo "DONE. Shell entry: asar-src/out/main/index.js"
