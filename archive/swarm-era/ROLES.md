# Roles (claim one per session; see COORDINATION.md §2)

Each role lists: mission → scope (owns) → deliverables → reads-first.
Shared conventions: TypeScript, ESM, zero heavy deps unless justified in `work/LOG.md`;
server = Node 22 + `node:sqlite` (house style from the hub project); UI = React 19 + Vite.
Everything lands under `src/` unless noted.

---

## R1 — Corpus steward
Mission: give everyone a trustworthy local decompile corpus + verified extracts.
Scope: `pipeline/`, `extracts/`, `RUNBOOK-decompile.md`.
Deliverables: run the runbook end-to-end; verify counts (≈1,550 chunks, ≈87 models,
≈258 GraphQL ops); regenerate + refresh `extracts/*`; document any drift vs 2026-09-26
(Linear ships often); a `pipeline/README.md` with gotchas you hit.
Reads first: `RUNBOOK-decompile.md`, `KNOWLEDGE.md` §1–2.

## R2 — Domain models
Mission: original TypeScript types for everything the loops server + UI need.
Scope: `src/model/`.
Deliverables: enums (trigger types, activation modes, statuses, conversation sources);
`WorkflowDefinition`, `WorkflowDefinitionDraft`, `WorkflowCronJobDefinition`,
`LoopExecution`, `AiConversation`, `AiConversationTurn`, `AgentSession`, `AgentActivity`
types with doc comments (behavior, not Linear's code); zod schemas for the loop config
the server persists; a `src/model/README.md` mapping concept → spec section.
Reads first: `extracts/models.md`, `SPECS/loops.md`, `SPECS/agent.md`.

## R3 — Linear data plane
Mission: talk to the REAL Linear via its public API using the user's connected account.
Scope: `src/dataplane/`.
Deliverables: GraphQL client (api.linear.app/graphql) with PAT + OAuth token support,
rate-limit budgeting (2,500 req/h/user) with backoff + batching; typed read ops needed by
loops (issues, projects, teams, comments, labels, cycles, workflow states); write ops for
loop output (comment create, issue update, state change); webhook registration helper +
poll fallback; fixture mode for offline tests.
Reads first: `KNOWLEDGE.md` §6 (API facts), `SPECS/target-architecture.md`.

## R4 — Loop engine
Mission: the scheduler + trigger evaluator that decides WHEN a loop runs.
Scope: `src/engine/`.
Deliverables: rrule/cron scheduler (mirroring `WorkflowCronJobDefinition.schedule`);
event triggers via dataplane webhooks/poll; trigger model faithful to spec (schedule,
chat, entity event with `activationMode: collectionChanged | watchedPropertyChanged`,
conditions, watched properties, comment matching); run queue with per-loop concurrency
limits + budgets; idempotency keys; unit tests with fixture events.
Reads first: `SPECS/loops.md`, `extracts/models.md` (WorkflowCronJobDefinition).

## R5 — Agent runtime
Mission: the conversation/turn state machine that executes a run with a pluggable brain.
Scope: `src/runtime/`.
Deliverables: run state machine (pending→active→awaitingInput→complete/error/canceled);
turns + activities (thought/action/response/elicitation) streamed to subscribers;
context assembler (loop prompt + entity context from dataplane); tool/MCP call plumbing;
continuation of previous runs (resume); `Brain` interface (sendMessage, stream, cancel)
that R6 implements.
Reads first: `SPECS/agent.md`, `SPECS/loops.md` §run-view.

## R6 — Inference harness
Mission: connect the user's own AI. Settings model + provider adapters.
Scope: `src/inference/`.
Deliverables: harness settings schema (provider, baseUrl, apiKeyRef, model, effort,
extra headers) with secret storage (write-only, never echoed — hub convention);
adapters: OpenRouter, OpenAI-compatible (covers LiteLLM/vLLM/Ollama), Anthropic;
model-list probe per adapter; streaming (SSE) normalized to runtime events; cost/usage
counters per run.
Reads first: `SPECS/target-architecture.md` §settings, `SPECS/agent.md` §harness-notes.

## R7 — Loops UI (feature pages)
Mission: faithful Loops pages in our own design language.
Scope: `src/ui/features/loops/`.
Deliverables: loops list (grouped, enabled toggle, last-run status), loop detail/editor
(trigger picker, schedule builder, conditions blocks, prompt editor, trusted sources,
code access toggles), runs page + run detail (activity stream: thoughts/actions/responses,
streaming state, cancel), template library, "New loop" flow. Copy + structure from
`SPECS/loops.md` §UI-inventory; behavior parity over pixel parity.
Reads first: `SPECS/loops.md`, local corpus (runbook) for reference screenshots.

## R8 — App shell + settings UI
Mission: the frame everything lives in, plus the two connect flows.
Scope: `src/ui/shell/`, `src/ui/features/settings/`, `src/ui/router`.
Deliverables: sidebar containing ONLY Loops (+Runs/Templates) and Settings; routing;
Settings pages: **Connect Linear** (PAT paste w/ verify + OAuth device flow placeholder)
and **Connect inference** (provider select, base URL, key, model probe, test call);
environment/T3 status page; dark theme.
Reads first: `SPECS/target-architecture.md`, `SPECS/t3-connect.md`.

## R9 — T3 connect transport
Mission: UI ↔ server link using the T3 Code Connect pattern (NOT Linear's sync protocol).
Scope: `src/connect/`.
Deliverables: environment descriptor endpoint (`/.well-known/t3/environment`);
pairing flow (QR/connection string + scoped session token, device-flow for headless);
WS RPC channel (JSON-RPC-ish, typed): subscribe run events, send steer/cancel, settings
RPCs; reconnect + resume; server + client sides; tests with two local peers.
Reads first: `SPECS/t3-connect.md`, `SPECS/sync-protocol.md` (for what we are NOT building).

## R10 — Lead (janitor + tie-breaker + break-glass)
Mission: keep the shared state truthful and the swarm unblocked. A duty set, not a
power — every session commits and merges (COORDINATION.md §5-6).
Scope: `work/`, repo-wide hygiene, `.github/**` (sole gatekeeper).
Deliverables: hub body + truth passes (STATUS/LOG/ROSTER/SWARM-STATE/EPOCHS after
each merge sweep); close merged/void task issues; sweep expired `[claim]` issues;
rule on claim/review/designation disputes; PR audit (the legal line); vault-token
rotation + repo settings via the break-glass browser procedure (LEAD.md — the ONLY
jobs that need it). Owns the CI workflow.
Reads first: `LEAD.md`, `COORDINATION.md` fully, then everything as needed.
