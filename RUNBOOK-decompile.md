# RUNBOOK — reproduce the decompile corpus from scratch

Everything is scripted in `pipeline/`. A fresh Linux env with node 22 + curl + python3 is
enough. ~10 min depending on network. NEVER commit the outputs (Linear proprietary code).

## 1. Desktop app (Electron shell — for the asar + coding-tools.json research)

```bash
bash pipeline/download-and-extract.sh
# → linear-re/Linear-universal.dmg (213 MB)
# → linear-re/extracted/Linear/Linear.app/…
# → linear-re/asar-src/ (out/main/index.js etc.)
```

Verify: `Info.plist` version + `ElectronAsarIntegrity` hash are printed.
Key reads: `asar-src/out/main/index.js` (entry URL, IPC, coding-tools), `…/preload/index.js`
(ElectronBridge surface).

## 2. Full web client bundle (the real payload)

```bash
node pipeline/crawl-client.mjs
# → linear-re/client/*.js  (expect ≈1,550 chunks, ≈29 MB; entry html.<HASH>.js)
```

How it works: fetch https://linear.app/login → find
`https://static.linear.app/client/assets/html.<HASH>.js` → BFS over `"assets/….js"`
references (`__vite__mapDeps` arrays) until closure. No source maps are published.

## 3. Prettify + analyze

```bash
npm install js-beautify@1.15.4
node pipeline/prettify.mjs     # → pretty/client/*.js (≈43 MB readable)
node pipeline/analyze.mjs      # → analysis/{graphql-ops,models,routes,chunks}.json
```

Expected counts @2026-09-26: **87 models, 258 GraphQL ops, 119 unique routes**.
Drift is normal (Linear ships constantly); note deltas in `work/LOG.md` and refresh
`extracts/` if material.

## 4. Finding things in the corpus (recipes)

- Model fields: registration looks like `XX=C([M(\`ModelName\`)],XX)`; fields are
  decorated as `C([…],XX.prototype,\`field\`,void 0)` in the ~40 KB before it.
  Grep `M(\`` for the model list; most live in `Issue.<HASH>.js` (the mega-chunk).
- GraphQL ops: backtick strings starting with `query|mutation|subscription Name`.
- Pages/routes: chunk filenames are semantic (`AutomationRunsPage.<HASH>.js`); routes via
  `Gt(\`/:orgKey/…\`` patterns.
- Config/endpoints: `config.<HASH>.js` (flat VITE_* module).
- Enums: search the prettified mega-chunk for distinctive values (e.g. `directChat`).

## 5. Troubleshooting

- 7z prints "Headers Error" on the DMG — expected (HFS+), extraction still succeeds.
- Entry regex fails → login page structure changed; view-source the page and find the new
  `static.linear.app/client/assets/html.*.js` script tag manually.
- A chunk 404s mid-crawl → Linear deployed mid-crawl; re-run (hashes rotate).
