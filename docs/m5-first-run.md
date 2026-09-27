# M5 first run — operator runbook

The M5 sentence, live: **a scheduled loop matches a condition on real data, the
brain (your own inference) runs, the answer writes back, and you watch it all in
the UI.** This runbook takes a fresh checkout to that first run.

Everything below is original code in this repo; the only external accounts are
yours (your Linear workspace, your inference provider).

## 0. Prerequisites

- **Node ≥ 22.18** (type stripping runs the server straight from TypeScript).
- Per-package deps: `for d in src/*/; do (cd "$d" && npm install --no-audit --no-fund); done`
  (the CI gate `bash ci/check-src.sh` does the same and proves the tree).
- **An inference harness** — one of:
  - an **OpenRouter** key (`https://openrouter.ai/api/v1`), or
  - an **OpenAI-compatible** server you can reach (LiteLLM / vLLM / Ollama —
    loopback and LAN http work; public http is refused by policy), or
  - an **Anthropic** key.
- Optional for the write-back leg: a Linear workspace + PAT. ⚠️ The
  `start.ts` dataplane binding (env-PAT → EntityReader + comment write-back)
  is the one remaining composition follow-up — the run path works without it,
  but comments land in Linear only once that binding (and/or the dataplane
  agent-ops module, T-305) is wired into `start.ts`. Track: hub issue #59.

## 1. Boot the server

```bash
# from the repo root
LOOPS_DB=./loops.db \
PORT=7373 \
TICK_MS=30000 \
STATIC_DIR=src/ui/dist \
node --experimental-strip-types src/server/start.ts
```

Env knobs: `PORT` (default 7373) · `LOOPS_DB` (default `./loops.db`) ·
`TICK_MS` (scheduler drive, default 30000; `0` disables) · `STATIC_DIR` (serve
the built UI same-origin — required for the deep link below, because the UI
derives its websocket URL from `location.host`) · `LOOPS_SECRET_KEY` (64 hex
chars for secret encryption; absent → a `0600` `.master-key` file is generated
next to the DB — keep it with the DB, never commit it).

The boot prints three things you need:

```
loops-server listening on http://127.0.0.1:7373
connect token (operator bootstrap): <token>
UI deep link: http://127.0.0.1:7373/?connectToken=<token>
```

The operator token is Jupyter-style (printed to your terminal only). Mint
scoped tokens for real clients via pairing; never put tokens in the repo.

## 2. Build + open the UI

```bash
cd src/ui && npm run build   # → src/ui/dist
```

Open the printed deep link. The UI reads `?connectToken=`, persists it to
localStorage, and strips it from the address bar. Without a token the app runs
in fixture/demo mode (that is how you know the connect failed).

## 3. Connect your inference (one-time)

The settings.* RPC handlers (T-606) own this; until the Settings page's live
wiring (R8 follow-up) lands, the direct store path against the same DB is the
honest v1 (it is exactly what the server's brain binding reads at run time):

```bash
OPENROUTER_KEY=sk-or-… node --experimental-strip-types --input-type=module -e '
import { openDatabase } from "./src/server/db.ts";
import { createInferenceStores } from "./src/server/brain.ts";
const db = openDatabase(process.env.LOOPS_DB ?? "./loops.db");
const { harnessStore } = createInferenceStores(db, process.env.LOOPS_DB ?? "./loops.db");
const h = harnessStore.create({
  name: "openrouter-main",
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4",
  apiKey: process.env.OPENROUTER_KEY,   // write-only: encrypted at rest, never echoed back
});
console.log("created", h.id, "default:", h.isDefault, "hasKey:", h.hasApiKey);
db.close();
'
```

Notes: the first harness becomes the installation default automatically;
`baseUrl` defaults per provider (OpenRouter/Anthropic pre-filled,
OpenAI-compatible requires one); plain http is allowed for loopback, and for
LAN hosts only with `allowInsecureHttp: true`. Verify with a probe
(`settings.testInference` over the channel, or the Settings page once wired) —
a failed probe is a result, not a crash.

## 4. Create and publish a loop

In the UI: **Loops → New loop** — give it a prompt, a cron schedule (e.g.
every minute for the demo), and a condition. Save (the editor does
upsert→publish over the live seam; publishing re-phases the scheduler).

The server's boot log line `boot loops: N scheduled` and the next `TICK_MS`
interval tell you the registry picked it up. Loop writes over the channel
hook `reloadLoops()` — no restart needed, ever.

## 5. Watch the run

On the next tick: **Runs** (or the loop's runs page) shows the run appear via
the `runs.created` broadcast. Open it: thoughts/responses stream live
(snapshot + incremental tail joined by `lastSeq` — no double-render, no
gaps). Token usage folds into the run record as the brain streams.

If the run ends with an error part reading *"No inference harness is
configured"*, step 3 is incomplete (or the default was deleted — deleting the
default harness deliberately leaves no default).

Continuation is real: answer an elicitation or follow up on a completed run —
the same run record continues (complete → active), streaming the whole way.

## 6. Golden-goose preview (optional, forward-looking)

The Linear-native presentation path is code-complete on main: the presenter
(T-604) mirrors runs into native Linear agent sessions, and the inbound
webhook (T-605) lets a Linear @-mention/delegation start a run here
(`POST /webhooks/linear-agent`, HMAC-verified). Both bind at composition once
the dataplane agent-ops module (T-305) and your Linear OAuth app exist —
issue #14 is the coordination thread; the live `agentSessionCreateOnIssue`
probe waits on your OAuth app/PAT.

## Troubleshooting

- **UI shows fixtures** → no valid `connectToken`; re-open the deep link.
- **Run errors "No inference harness is configured"** → step 3; check
  `settings.get`'s `defaultId`.
- **`LOOPS_SECRET_KEY must be 64 hex characters`** → `openssl rand -hex 32`.
- **Tick not firing** → `TICK_MS` is 0, or the loop is a draft (publish it).
- **Gate before changes**: `bash ci/check-src.sh` — 8/8 packages, all tests.
