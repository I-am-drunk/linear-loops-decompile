# @loops/server — loops server skeleton (T-1101)

The composition root the whole product converges into: node:http +
node:sqlite, zero deps beyond `@loops/model` (zod) and `@loops/runtime`.
Original code; behavior per SPECS/target-architecture.md.

## Pieces

- `db.ts` — node:sqlite open + schema (loops, runs, turns, snapshots,
  settings, audit_events, idempotency_keys). Idempotent DDL, `user_version`
  stamped.
- `store.ts` — the only SQL surface. Loops validated on write via the
  model's zod schema (`parseLoopConfig`); runs/turns mirror runtime records;
  `claimRunKey` = the idempotency rail (duplicate trigger events never
  double-run — key claimed BEFORE the run row exists, hence no FK);
  `audit_events` append-only (no update/delete methods exist);
  `setSetting` refuses credential-shaped keys — secret material lives in
  src/inference's write-only store (R6), referenced here by ref at most.
- `persistence.ts` — `persistRun(runner, store, runId)`: mirrors Runner
  events into rows + a fresh snapshot per event batch. `restoreRuns` on
  boot: mid-exchange runs come back `error: interrupted` (retryable);
  parked runs come back parked.
- `http.ts` — health endpoint, static webui serving with a raw-path
  traversal guard (raw `..` segments rejected BEFORE normalize), SPA
  fallback, and the `/.well-known/t3/environment` mount passed in by the
  caller (connect → server dependency direction; never circular).
- `index.ts` — `createLoopsServer({ dbPath?, staticDir?, environmentHandler? })`
  → `{ server, db, store, runner, brainFor, harnessStore, restoredRuns, listen, close }`.
- `rpcs.ts` (T-1103, #111) — the composition-root domain RPCs the T-902
  channel was designed for: `loops.list/get/upsert/publish/setEnabled` +
  `runs.list/get` (+ `lastSeq` and the scope-gated `runs.created`
  broadcast). Upserts are DRAFTS (never re-phase); publish/setEnabled hook
  `orchestrator.reloadLoops()`. `runs.get` reads the live Runner first
  (store fallback; a parked run's question is reconstructed from the
  snapshot in `store.getRun`).
- `compose.ts` (T-1103 follow-up) — `createLiveLoopsServer(...)`: the full
  M5 wiring — TokenStore + ChannelServer + orchestrator (publish sink =
  `createRunEventPublisher`) + `registerDomainRpcs` + boot `reloadLoops()`.
  Also the two composition-root bindings: `runtimeCommandsFor` (steer on a
  parked run IS the elicitation answer; continue resolves the loop's brain)
  and `runnerRegistryView` (the channel's liveness gate over the Runner's
  `has()`/`activeRunIds()`).
- `start.ts` — the entry point:
  `node --experimental-strip-types src/server/start.ts` (PORT/LOOPS_DB/
  TICK_MS envs) — boots compose, mints an operator bootstrap token
  (printed to the operator's own terminal), ticks the scheduler.

## Wiring contract

- **Engine (R4):** `store.claimRunKey(hash(loopId, triggerEventId), runId)`
  → `runner.start({ loopId, message, brain, runId })` → `persistRun(...)`.
- **Connect (R9):** attaches its WS `upgrade` listener to `server`; the
  environment descriptor mounts via `environmentHandler`.
- **Inference (R6):** provides the Brain; usage lands via
  `runner.recordUsage` (mirrored to the runs row by persistence).
- **Domain data to the UI flows over the T3 channel, not REST** — `/api/*`
  is a deliberate 404 wall.

## Verify

```
npm install
npx tsc --noEmit
npm test    # 7/7: store rails, persistence+restore, http surface
```

## Not here (YAGNI)

Migrations beyond idempotent DDL, REST surface for domain data, auth on
HTTP (the T3 channel authenticates), secret storage (R6's), the engine
itself (R4). Multi-process anything.
