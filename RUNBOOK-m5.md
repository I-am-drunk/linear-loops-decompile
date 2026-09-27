# RUNBOOK-m5 — the first real end-to-end run (operator path)

M5 is code-complete on main. This runbook takes a fresh clone to a **real
scheduled loop firing against your real Linear account, with the run's brain
on YOUR inference, its write-back comment posted to Linear, and the whole
thing streaming live in the web UI** — cron → condition → brain → write-back
→ visible history. Nothing here needs GitHub Actions, a cloud service, or
any credential leaving your machine except to Linear and your inference
provider.

## 0. Prereqs

- Node 22 (≥22.18) — `node --version`.
- A fresh clone of this repo, deps installed per package
  (`bash ci/check-src.sh` once is the pleasant way — it also proves the gate:
  every package tsc + tests).
- A **Linear personal API key** (`lin_api_…` — Linear Settings → API). It is
  verified against the real API before it is stored, and stored encrypted
  (write-only — never echoed anywhere).
- An **inference harness**: OpenRouter key, or an OpenAI-compatible server
  (LiteLLM/vLLM/Ollama), or an Anthropic key.

## 1. Build the two artifacts (one time per checkout)

```bash
npx tsc -p src/dataplane/tsconfig.build.json   # the dataplane is compile-first
npm --prefix src/ui run build                  # the web UI → src/ui/dist
```

(The server runs without either — API-only with Linear features disabled —
but the full path needs both.)

## 2. Start the loops server

```bash
node --experimental-strip-types src/server/start.ts
# envs: PORT=7373 (default) · LOOPS_DB=./loops.db · TICK_MS=30000 (scheduler drive)
```

It prints: the http address, the boot loop counts, an **operator bootstrap
token**, and the **UI URL** (`http://127.0.0.1:7373/?connectToken=…`). The
token is a full-scope T3 session token printed to YOUR terminal only — open
the URL in your browser; the UI stores it locally (and strips it from the
address bar).

## 3. Connect inference (Settings → Connect inference)

- Provider + base URL (OpenRouter prefills `https://openrouter.ai/api/v1`),
  API key (write-only), model id, effort.
- Plain-http rule: https always OK; http OK for loopback, and for LAN
  addresses only with the "Allow plain http" opt-in (Ollama at home).
- **Probe models** proves the key + model list before you rely on them.
  First harness saved with "make default" becomes the loops' brain.

## 4. Connect Linear (Settings → Connect Linear)

Paste the PAT → it is verified against the real API (viewer round-trip — a
bad key fails loudly, nothing is stored) → stored encrypted. The page shows
who the token acts as. `dataplane.probe` re-verifies live anytime.

## 5. Write + publish a loop

Loops → New loop: name it, pick the schedule trigger (e.g. every 15 min),
write the prompt, Save (the editor's save = upsert-then-publish: one re-phase
per save, exactly like Linear). Event-trigger loops (issue created/updated)
work too — they fire via `handleEvent` (webhook/poll rides next milestone;
schedule + manual are today's drives).

## 6. Watch it run

- Within a scheduler tick (`TICK_MS`, default 30s) the loop fires.
  **Runs** shows it appear live (no refresh — `runs.created`), then open it:
  the activity stream (thoughts/actions/responses) streams as the brain works.
- Steer a live run, answer an elicitation ("Send answer"), cancel, or send a
  follow-up to a finished one ("Continue") — all live over the same channel.
- On completion with `comment` capability and an issue target, the run's
  response posts as a **Linear comment** (idempotent — reruns never double-post).
- Toggle a loop off/on in the list; the change is server-authoritative and
  re-phases the schedule immediately (no restart).

## Troubleshooting

- **"No inference harness is configured"** run errors → Settings → Connect
  inference, save a default harness; runs self-heal on the next fire.
- **Run errors "Linear is not connected"** → Settings → Connect Linear. The
  reader/write-back bind per call, so connecting mid-run just works.
- **A loop didn't fire after downtime**: the misfire policy is Linear's
  "collapse" (skip) — missed occurrences collapse to the latest, they never
  storm. Waterlines live in-memory for now (restart = fresh schedule).
- **Restart behavior**: runs persist to `LOOPS_DB` (SQLite) continuously;
  mid-exchange runs restore as `error: interrupted`, parked runs restore
  parked (their question survives).
- **Where secrets live**: PAT + harness keys in the SecretStore (encrypted at
  rest in the db file); the settings table holds only opaque refs. Nothing
  secret is ever returned by any RPC.
- **CI**: GitHub Actions is billing-locked account-wide (ticket #4797514) —
  `bash ci/check-src.sh` locally is the gate.

## Not yet (honest edges at this milestone)

- Settings pages: delete/setDefault harness + pairing management ride the
  settings UI's next pass (create+probe+makeDefault cover the operator path).
- Event triggers fire via `handleEvent` calls (engine poll bridge and
  webhook registration exist; the always-on delivery driver is M6 work).
- Golden goose (drive Linear's own Agent Sessions UI as the run surface —
  #14): substrate landed (T-604 presenter, T-605 inbound webhooks, T-305 in
  flight); the live probe needs a Linear OAuth app owned by the user.
