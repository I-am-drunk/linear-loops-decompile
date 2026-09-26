# SPEC — Target architecture (the product)

A self-hosted "Linear Loops with your own brain": web UI + loops server, Linear as the
data plane, user's own inference as the brain, T3 connect as transport.

## Components

```
┌────────────────────────────┐        WSS JSON-RPC (T3 connect)        ┌──────────────────────────┐
│ webui (React 19 + Vite)     │ ◀────────────────────────────────────▶ │ loops-server (Node 22+TS) │
│  sidebar: Loops, Runs,      │                                          │  node:sqlite (state)      │
│  Templates, Settings        │                                          │  serves webui static too  │
└───────────────────────────┘                                          └──────┬───────────────┘
                                                                                │
            ┌────────────────────────────┬───────────────────────────────┤
            ▼                               ▼                                   ▼
   src/dataplane (R3)                src/engine (R4)                    src/runtime (R5)
   Linear public GraphQL             cron (rrule) + webhook/poll        run state machine
   api.linear.app/graphql            trigger+condition eval             turns/parts streaming
   PAT or OAuth, 2.5k req/h          run queue, budgets,                context assembler
   budget + fixtures                 idempotency                        Brain iface ──▶ src/inference (R6)
                                                                                     OpenRouter | OpenAI-compat
                                                                                     (LiteLLM/vLLM/Ollama) | Anthropic
```

## Repo layout (created by the swarm)

```
src/
  model/       (R2)  domain types + zod schemas
  dataplane/   (R3)  Linear API client
  engine/      (R4)  scheduler + triggers + queue
  runtime/     (R5)  runs + turns + activities
  inference/   (R6)  harness settings + adapters
  connect/     (R9)  T3 transport (server+client)
  server/          http+ws server, static serving, settings store, audit log
  ui/          (R7/R8) React app: shell + loops features + settings
```

## Settings model (the two connects the user asked for)

1. **Connect Linear** — PAT (paste → verify via `viewer` query → store hashed/write-only)
   or OAuth (device flow v1 placeholder). Server derives: orgs, teams, projects, labels,
   workflow states; shows rate budget.
2. **Connect inference** — provider ∈ {openrouter, openai-compatible, anthropic};
   baseUrl; apiKey (write-only); default model (probe `/models` where available); effort;
   extra headers. "Test" button runs a 1-token call and reports latency + model list.
   Multiple named harnesses allowed; loops pick one or use default.

## Data ownership

- OUR SQLite: loops (config+versions), runs/turns/parts, settings, secrets (hashed refs),
  audit events (append-only), idempotency keys, usage counters.
- LINEAR (read via dataplane): issues, projects, teams, comments, labels, cycles, states.
- Loop OUTPUT to Linear: comments / status changes / issue updates (configurable per loop;
  every write is an audited, idempotent command).

## Safety rails (house rules from hub project)

- Approval gate for consequential Linear writes (per-loop: auto | require-approval).
- Budgets: max runs/hour per loop, max tokens/cost per run, global daily cap.
- Idempotency: run key = hash(loopId, triggerEventId); duplicate events never double-run.
- Audit: append-only event log for every trigger, decision, brain call, write.
- Failure surface: failed runs are first-class (visible, retryable, with error part).

## Explicit non-goals (v1)

Reusing Linear's client code; reimplementing LSE sync; replacing Linear as the tracker;
multi-tenant SaaS; real OAuth apps (placeholders fine); mobile.
