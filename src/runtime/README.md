# @loops/runtime — agent runtime (R5)

The conversation/turn state machine that executes a loop run against a
pluggable brain. Original code; behavior per SPECS/agent.md §runtime-contract
and SPECS/loops.md §run-view.

## Pieces

- `run-machine.ts` — pure transition table:
  `pending → waiting → active ⇄ awaitingInput → complete | error | canceled`,
  with the two deliberate extras: `active → active` (steer-drain, no
  complete-flicker) and `complete → active` (continuation). Timestamp
  invariants (`startedAt`/`endedAt`) enforced by `assertRunInvariants`.
- `runner.ts` — the Runner: drives exchanges against a `Brain`, appends
  streamed parts to turns, queues steers and drains them between exchanges,
  parks on elicitation (`awaitingInput` → `respond`), cooperative cancel via
  AbortSignal (partial parts kept), continuation of complete runs, per-run
  gapless `seq` event stream with ring-buffer replay (`subscribe(runId, fn,
  sinceSeq)`), `whenIdle` for tests/drains.
- `brain.ts` — the Brain seam (`stream(input, signal) → AsyncIterable<Part>`).
  The runtime knows nothing about providers; the three planned backends are
  R6's user-harness adapters and the two golden-goose brains (issue #14).
  `ScriptBrain` is the test brain.
- `types.ts` — Run/Turn/Part/RunEvent. Status vocabulary is imported from
  `@loops/model` (single source of truth); this package owns runtime-only
  shapes.

- `context.ts` — context assembler (T-502): `flattenPrompt` (markdown |
  ProseMirror-ish doc | junk → text, never throws) and `assembleContext`
  (prompt + entity context via the `EntityReader` seam that R3's dataplane
  implements) → the `message` an exchange answers.
- `snapshot.ts` — run snapshots (T-502): `toSnapshot`/`fromSnapshot`
  (versioned JSON, junk rejected). A run snapshotted mid-exchange restores
  as retryable `error: "interrupted"`; a parked run restores parked and
  continues via `Runner.respond(runId, text, brain)`.

## Not here (YAGNI, by design)

- Persistence itself: the server (T-1101) subscribes to events and stores
  snapshots (`toSnapshot` per event batch).
- Token budgets, templating, memory/traits.

## Verify

```
npm install
npx tsc --noEmit          # strict + exactOptionalPropertyTypes + verbatimModuleSyntax
npm test                  # node --experimental-strip-types --test
```

## Concept → spec map

| Concept | Spec |
|---|---|
| Run/Turn/Part kinds, lifecycle | SPECS/agent.md §runtime-contract |
| Activity stream shown per run | SPECS/loops.md §run-view |
| Continuation ("continue previous runs") | SPECS/agent.md |
| Steer queue | SPECS/agent.md (`shouldQueueMessages` analog) |
| Entity context seam (`EntityReader`) | SPECS/target-architecture.md (dataplane) |
| Brain backends | SPECS/target-architecture.md §inference, issue #14 |
