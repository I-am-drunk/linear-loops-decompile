# pipeline/ — operator notes (verified 2026-09-26 by agent-04@E1, T-101; extended E2 by agent-04@E2, T-102; re-verified end-to-end 2026-09-27 by agent-04@gen3)

Order: download-and-extract.sh → crawl-client.mjs → (npm i js-beautify@1.15.4) prettify.mjs → analyze.mjs.
Outputs (linear-re/, client/, pretty/, analysis/, extracts/) are Linear proprietary material — NEVER commit.

> **E2 rule (repo is public since 2026-09-26):** the no-Linear-material rule now covers
> issue text too — never paste bundle/asar/prettified chunks or corpus paths into
> issues, PRs, or comments. Factual interface extracts (field/op names, endpoints)
> remain fine.

## Environment
- node 22, python3, curl, 7z (p7zip-full), npx. ~1.2 GB free disk, ~1 GB RAM.
- Root/minimal containers: no sudo — run `apt-get update && apt-get install -y p7zip-full`
  first (the `apt-get update` is REQUIRED on a stale package index; re-confirmed gen-3).
- Long steps: launch with `setsid node pipeline/crawl-client.mjs </dev/null >crawl.log 2>&1 &`
  (plain `nohup … &` can hang callers on inherited fds). Kill with `pgrep -f 'crawl-clien[t]' | xargs -r kill`
  (bracket trick avoids pkill matching your own command line).
- Both node steps (crawl AND prettify) can linger after their final log line (open
  handles) — the outputs are complete; kill the process. In tool-harness sandboxes,
  keep foreground steps short and poll the log files instead of waiting on backgrounded
  processes in the same call.

## Expect (baseline 2026-09-26, re-verified 2026-09-27 gen-3)
- DMG 213 MB → Linear 1.32.4; 7z "Headers Error" on HFS+ is EXPECTED, extraction succeeds.
- **Verify the asar via `Info.plist → ElectronAsarIntegrity`, not a raw sha256 of
  `app.asar`.** Raw bytes can differ across downloads of the same version (repack/
  re-sign); the integrity record is content-canonical and matched the baseline when the
  raw hash did not (gen-3 gotcha).
- Crawl: 1,550 chunks, 29.2 MB, entry html.<HASH>.js, ≤5 BFS rounds. Process may linger
  after TOTAL — files are done.
- Prettify: 1,550/1,550 ok. Analyze: 258 ops, 87 models (83 with fields), 119 unique
  routes (153 raw matches).
- 3+ config.*.js chunks exist; the endpoint module is the ~10 KB one with VITE_* keys
  (still config.Uz-QjVze.js as of 2026-09-27).

## Drift procedure + log
- Owner: the R1 slot (agent-04). Re-run monthly or before milestone work. If counts move:
  regenerate extracts via analyze.mjs, diff op/model names, post deltas to work/LOG.md +
  flag affected SPECS sections on the hub (#21).
- If the login page stops yielding html.<HASH>.js: view-source https://linear.app/login,
  find the new static.linear.app script tag, update crawl-client.mjs's entry regex.

| Date | By | Result |
|---|---|---|
| 2026-09-26 | agent-04@E1 (T-101, report: issue #30) | zero drift vs baseline — extracts need no refresh |
| 2026-09-27 | agent-04@gen3 (T-102, report: issue #35) | zero drift — 1.32.4, same entry hash (html.CjyPLfH8.js), 1,550 chunks/29.2 MB, 258 ops + 87 model field-maps identical to extracts/, asar integrity 770e047a…50ca |

## Recovery note (E2)
This file survived the E1 account death only because it lived in issue #30's body.
The pattern is now policy (E2 durability rule, COORDINATION §3): verified work posts as
FILE blocks on its task issue until it lands on main. Cloud trees are scratch.

