# PLAN: rebuild-era milestones

The bar for every milestone: verified against the decompile corpus or Linear's
official docs. Never plausibility.

## The doctrine: thin slices, perfected as we go

We build slowly and incrementally, on purpose. The first implementation failed by
building breadth before depth, so:

- ONE PR = ONE thin vertical slice, reviewable in minutes. Never a whole layer,
  never the whole stack.
- Foundation slices first (transport, boot, settings): they set the patterns
  every later slice copies, so they get extra care and review while change is
  cheap.
- A slice is done when: the gate passes on a fresh clone, the diff is audited
  against the legal lines, a sibling session has reviewed it when one is around
  (self-merge only when blocking and no reviewer exists), and STATUS.md plus
  docs/feature-matrix.md are updated in the same PR.
- Code stays small: zero runtime deps, strict TS, boring patterns. If a slice
  feels big, it is two slices.
- Anything touching Linear behavior is verified against the corpus
  (`pipeline/corpus/`, via the vault) and the matrix row is noted.

Done: R0 reset (2026-09-27), R1 pipeline harness + corpus in the vault, R2
feature matrix.

## R3: foundation slices (the architecture, perfected)

- R3.1 transport: `src/connect` (RFC 6455 framing + JSON-RPC + server mount +
  client + round-trip test).
- R3.2 boot: `src/server` (http + static + environment descriptor + dev token +
  node:sqlite store + health).
- R3.3 settings vertical (server): `settings.*` RPCs + `dataplane.probe`.
  Write-only secrets; probes never hit the network in tests.
- R3.4 UI shell: `src/ui` skeleton (sidebar, routes, theme tokens from
  `docs/ui-reference.md`, empty states) with the Settings page wired to the
  R3.3 RPCs.

## R4: loops domain slices

- R4.1 `loops.list/upsert/publish/setEnabled` + the loops list page.
- R4.2 loop detail + editor blocks (trigger picker, schedule, conditions,
  prompt).
- R4.3 template library + new-loop prefill.

## R5: dataplane slices (Linear as the data plane)

- R5.1 GraphQL client + rate budget (promote the R3.3 probe).
- R5.2 reads (issues, projects, teams, labels, states) with fixtures.
- R5.3 writes (comment create, issue update) + idempotency + audit.

## R6: engine + runtime slices

- R6.1 scheduler (rrule) + trigger evaluator.
- R6.2 run state machine + turns/parts + streaming (`runs.subscribe` seq/resume).
- R6.3 brain interface + first harness adapter (OpenRouter-compatible).
- R6.4 steer/continue/cancel + elicitations.

## R7: the golden goose (research in parallel; integrate after R6)

- Trace `AiConversationSendMessage` call sites in the corpus (streaming shape,
  auth context), reading only, anytime.
- Live probe with the user's Linear credentials (user-guided).
- If proven: goose brain adapter behind the same Brain interface as the external
  harnesses.

## R8: matrix burn-down

Rows to `built` then `exact`. Release bar: every row verified, UI checked against
the corpus (issue #20).
