# Master plan

## What exists (verified 2026-09-26, see KNOWLEDGE.md)

- Linear Loops = `WorkflowDefinition` (+ `WorkflowCronJobDefinition` for schedules). A run
  = server-side `AiConversation` (`initialSource: workflow`) joined by `LoopExecution`.
  The brain is 100% server-side Linear infra (Braintrust-traced); it cannot be swapped,
  and the desktop app is a thin Electron shell — so we rebuild, not patch.
- We have the full decompile pipeline + extracted interface facts (this repo's
  `pipeline/`, `extracts/`).
- The user's hub conventions exist from a sibling project: zero-dep Node 22 + node:sqlite
  server, React 19 + Vite client, registry-as-data, secrets write-only.

## Target (see SPECS/target-architecture.md)

```
webui (React) ──T3 connect (WS RPC)──▶ loops-server (Node+TS+SQLite)
                                            │
        ┌────────────────────────────────┼───────────────────────┐
        ▼                                   ▼                        ▼
  dataplane: Linear public API      engine: cron/webhook       runtime: conversation
  (user's PAT/OAuth, 2.5k req/h)    triggers + conditions      state machine + activities
                                            │                        │
                                            └───────▶ run ─────────┤
                                                                     ▼
                                                          inference: user's harness
                                                          (OpenRouter/vLLM/…)
```

## Milestones

- **M0 — Corpus & specs stable.** R1 verifies pipeline; extracts refreshed; specs reviewed
  by R2/R4/R5/R7 leads. Exit: nobody is blocked on "how does Linear do X".
- **M1 — Foundations.** R2 model types; R3 dataplane reads a real Linear workspace with a
  PAT (fixture-mode tests pass); R9 T3 connect echoes between two local peers.
- **M2 — Engine fires.** R4 scheduler + conditions run a loop on cron against fixtures;
  idempotency + concurrency limits proven by tests.
- **M3 — First real run.** R5+R6: a loop with a stub prompt executes against OpenRouter,
  activities stream over T3; cancel works; usage counters recorded.
- **M4 — UI parity.** R7+R8: loops list/detail/runs/run-view + sidebar/settings; connect
  Linear (PAT) and inference through the UI; a run watched live in the browser.
- **M5 — End-to-end.** Scheduled loop → condition match on real Linear data → brain run →
  comment written back to Linear via dataplane → visible in UI run history.
- **M6 — Hardening.** Budgets, failure controls, audit log, error surfaces, docs, v0.1 tag.

## Initial task board

(IDs match work/STATUS.md; roles own their column.)

- T-101 (R1) Verify runbook end-to-end in a fresh env; refresh extracts.
- T-102 (R1) pipeline/README.md gotchas + drift notes vs 2026-09-26.
- T-201 (R2) Enums + WorkflowDefinition*/LoopExecution types + zod loop-config schema.
- T-202 (R2) AiConversation*/AgentSession/AgentActivity types.
- T-301 (R3) GraphQL client + PAT auth + rate-limit budget + fixture mode.
- T-302 (R3) Typed reads (issues/projects/teams/comments/labels/cycles/states).
- T-303 (R3) Writes (comment/update/state) + webhook registration + poll fallback.
- T-401 (R4) rrule scheduler + cron definitions.
- T-402 (R4) Trigger/condition evaluator (event + watchedPropertyChanged + commentMatch).
- T-403 (R4) Run queue: concurrency, budgets, idempotency.
- T-501 (R5) Run state machine + activities + streaming.
- T-502 (R5) Context assembler + Brain interface + resume/continuation.
- T-601 (R6) Harness settings schema + secret storage.
- T-602 (R6) OpenRouter + OpenAI-compatible adapters (streaming).
- T-603 (R6) Anthropic adapter + model probe + usage counters.
- T-701 (R7) Loops list + enabled toggle + last-run status.
- T-702 (R7) Loop editor (trigger/schedule/conditions/prompt/trusted sources).
- T-703 (R7) Runs pages + live activity stream + cancel.
- T-801 (R8) Shell + sidebar (loops-only) + router + dark theme.
- T-802 (R8) Settings: connect Linear (PAT verify) + connect inference (probe+test).
- T-901 (R9) Environment descriptor + pairing + scoped tokens.
- T-902 (R9) WS RPC channel: subscriptions, steer/cancel, reconnect/resume.
- T-1001 (R10) CI typecheck workflow + landing process doc.

## Working agreements

- Dependencies: justify in `work/LOG.md`; prefer stdlib (`node:sqlite`, `fetch`, `crypto`).
- Every `src/` package builds standalone: `tsc --noEmit` clean.
- Tests run on fixtures; no real Linear writes in tests.
- Secrets never in the repo, never echoed by the server (write-only, hub convention).
