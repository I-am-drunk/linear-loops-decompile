#!/usr/bin/env bash
# Download the Linear desktop app and extract the Electron asar shell.
# ALL output lands in pipeline/corpus/app/ (gitignored: Linear proprietary
# material never enters the repo). Tested 2026-09-26, Linear v1.32.4.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p corpus/app && cd corpus/app

echo "== 1. Download Linear macOS DMG (universal) =="
curl -sL -o Linear-universal.dmg "https://releases.linear.app/mac"
ls -la Linear-universal.dmg

echo "== 2. Extract DMG (HFS+) =="
if ! command -v 7z >/dev/null; then
  if command -v sudo >/dev/null; then sudo apt-get update && sudo apt-get install -y p7zip-full; else apt-get update && apt-get install -y p7zip-full; fi
fi
7z x -oextracted Linear-universal.dmg || true   # 7z reports a header error on HFS; extraction still succeeds
APP="extracted/Linear/Linear.app/Contents"

echo "== 3. Verify =="
python3 - "$APP/Info.plist" <<'PY'
import plistlib,sys
d = plistlib.load(open(sys.argv[1],'rb'))
print("version:", d["CFBundleShortVersionString"])
print("asar integrity:", d.get("ElectronAsarIntegrity"))
import datetime,json
json.dump({"version": d["CFBundleShortVersionString"], "date": datetime.date.today().isoformat()}, open("VERSION.json","w"))
PY

echo "== 4. Extract app.asar (Electron shell) =="
npx -y @electron/asar extract "$APP/Resources/app.asar" asar-src
find asar-src -type f | head -20
echo "DONE. Shell entry: asar-src/out/main/index.js"
