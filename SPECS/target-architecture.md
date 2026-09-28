# SPEC — Target architecture (the product)

A self-hosted **Linear Loops-only** product: an original Loops UI and loops server,
with the user's connected Linear account as the data plane and Linear's normal chat
route as the primary brain. T3 connect is the transport between our UI and server.

Scope is intentional: we reproduce Loops and only its necessary views. We do not
reproduce Linear's general tracker, its navigation, or its Settings. Our sidebar has
Loops, Loops-required views (Runs/Templates as they are built), and our Settings. See
`SPECS/product-contract.md` for the binding scope test and credential boundary.

## Components

```
┌────────────────────────────┐        WSS JSON-RPC (T3 connect)        ┌──────────────────────────┐
│ webui (React 19 + Vite)     │ ◀────────────────────────────────────▶ │ loops-server (Node 22+TS) │
│  sidebar: Loops, Runs,      │                                          │  node:sqlite (state)      │
│  Templates, our Settings    │                                          │  serves webui static too  │
└───────────────────────────┘                                          └──────┬───────────────┘
                                                                                │
            ┌────────────────────────────┬───────────────────────────────┤
            ▼                               ▼                                   ▼
   src/dataplane (R5)                src/engine (R4)                    src/runtime (R6)
   documented Linear API             cron (rrule) + webhook/poll        run state machine
   api.linear.app/graphql            trigger+condition eval             turns/parts streaming
   PAT or OAuth, rate budget         run queue, budgets,                context assembler
   reads + audited write-back         idempotency                        Brain interface
                                                                                     │
                                                   src/linear-chat (R7, primary) ◀─┘
                                                   user-session bridge to
                                                   client-api + minimal sync reader
                                                                                     │
                                                   src/inference (fallback only)
                                                   OpenRouter | OpenAI-compatible
                                                   LiteLLM/vLLM/Ollama | Anthropic
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

1. **Connect Linear account (public API)** — PAT (paste → verify via `viewer` query →
   store write-only) or OAuth (device-flow placeholder). This connection derives orgs,
   teams, projects, labels, and workflow states; it reads data and performs audited
   write-back with public-API rate-budget visibility. It cannot call Linear chat.
2. **Connect Linear chat session (primary brain)** — user-guided interactive sign-in
   establishes a separately stored, write-only session bridge for the client API and
   sync socket. It drives normal Linear AI chat for loop runs. Refresh/lifetime is an
   E1-verified adapter concern, never silently conflated with public OAuth/PAT.
3. **Fallback inference (optional)** — provider ∈ {openrouter, openai-compatible,
   anthropic}; base URL, write-only key, default model, effort, extra headers. A test
   button probes it. It exists only when the chat bridge is unavailable or deliberately
   disabled; it is not presented as equivalent to the primary brain.

## Data ownership

- OUR SQLite: loops (config+versions), runs/turns/parts, settings, secrets (hashed refs),
  audit events (append-only), idempotency keys, usage counters.
- LINEAR (read via public-API dataplane): issues, projects, teams, comments, labels,
  cycles, states.
- LINEAR CHAT (via the distinct user-session bridge): normal-chat conversation/turn
  activity used as the primary loop brain; session material is stored write-only.
- Loop OUTPUT to Linear: comments / status changes / issue updates (configurable per loop;
  every write is an audited, idempotent public-API command).

## Safety rails (house rules from hub project)

- Approval gate for consequential Linear writes (per-loop: auto | require-approval).
- Budgets: max runs/hour per loop, max tokens/cost per run, global daily cap.
- Idempotency: run key = hash(loopId, triggerEventId); duplicate events never double-run.
- Audit: append-only event log for every trigger, decision, brain call, write.
- Failure surface: failed runs are first-class (visible, retryable, with error part).

## Explicit non-goals (v1)

Reusing or serving Linear's client code; reproducing Linear's tracker, general sidebar,
or Linear Settings; replacing Linear as the tracker; multi-tenant SaaS; real OAuth
apps (placeholders fine); mobile. A minimal original sync reader limited to the chat
adapter is in scope; reimplementing the general LSE sync engine is not.
