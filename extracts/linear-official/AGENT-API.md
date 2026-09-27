# AGENT-API — the official Agent Sessions surface (digest)

Sources: `schema.graphql` + `_generated_documents.graphql` (this dir, MIT) and
linear.app/developers ({agents, agent-interaction, agent-best-practices, agent-signals}
— Developer Preview; fetch the live pages for prose, this file is the fact sheet).
This is the golden-goose substrate (issue #14): Linear's own documented way to be a brain.

## AgentSession (lifecycle of one agent run)

`enum AgentSessionStatus { active, awaitingInput, complete, error, pending, stale }`
- Created automatically when an agent is **mentioned or delegated** an issue; or
  proactively via `agentSessionCreateOnIssue` / `agentSessionCreateOnComment`.
- State is auto-derived from emitted activities (no manual state management).
- `externalUrls` (via `agentSessionUpdateExternalUrl`) point users at YOUR run view
  and keep the session from being marked unresponsive.
- `promptContext` (webhook field): the formatted context string (issue + comments +
  guidance) — Linear's own prompt-assembly, usable verbatim as our brain's context.

## AgentActivity (the run stream)

`enum AgentActivityType { action, elicitation, error, prompt, response, thought }`
`union AgentActivityContent = Action | Elicitation | Error | Prompt | Response | Thought`
- `thought` = progress notes (emit within 10s of session start) · `action` = tool call
  (action/parameter/result) · `elicitation` = ask the user · `response` = final answer ·
  `error` = failure · `prompt` = INBOUND user message (the counterpart direction).
- Activities are frozen-in-time snapshots — read session history from activities, NOT
  comments (editable).
- `enum AgentActivitySignal` + `signalMetadata`: **`stop`** (user → agent: halt
  immediately, then emit final response/error), **`auth`** (agent → user: account-
  linking UI with a URL), **`select`** (elicitation with structured options).

## The 9 official agent ops (_generated_documents.graphql)

mutations: `agentSessionCreateOnIssue` · `agentSessionCreateOnComment` ·
`createAgentActivity` · `updateAgentSession` · `agentSessionUpdateExternalUrl`
queries: `agentSession` · `agentSessions` · `agentActivity` · `agentActivities`

## Webhooks + auth

- `AgentSessionEvent` webhook category (enable on the OAuth app): actions `created`
  (start a loop — payload carries `agentSession` incl. issue/comment/guidance +
  `promptContext`) and `prompted` (new user message in `agentActivity.body`).
- ACK within 5 seconds; first `thought` within 10 seconds.
- Auth: standard OAuth2 + **`actor=app`** (workspace-admin install; agent appears as
  its own workspace member). Legacy `actor=application` = dual-purpose tokens.

## Divergences: our reimplementation vs official (the cross-check at work)

| Ours (decompile-derived) | Official (this dir) | Resolution |
|---|---|---|
| runtime state `canceled` | `AgentSessionStatus.stale` | Add `stale` (unresponsive) to src/runtime; map user-cancel to the `stop` signal → terminal state. Task: R5 follow-up |
| activities: thought/action/response/elicitation/error | + `prompt` (inbound) | Convergent by design — prompt = inbound user turn |
| 0 agent-session ops in src/dataplane | 9 official ops | The golden-goose gap — implement as `src/dataplane/agent-sessions.ts` (R3) riding the existing client |

## Loops definitions: STILL not public

`type WorkflowDefinition` IS in the official schema (activities/conditions as
`JSONObject`, `enabled`, context links) — but the schema exposes **no query or
mutation** for it (verified 2026-09-27: zero `workflowDefinition*` ops). Loops
internals remain decompile-only knowledge; our engine over our own loop configs
remains the correct architecture. Watch this type on every schema refresh — the day
ops appear, the golden goose doubles (issue #14 note).
