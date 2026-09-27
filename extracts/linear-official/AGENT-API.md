# AGENT-API — the official Agent Sessions surface (digest)

Sources: `schema.graphql` + `_generated_documents.graphql` (this dir, MIT) and
linear.app/developers ({agents, agent-interaction, agent-best-practices, agent-signals}
— Developer Preview; fetch the live pages for prose, this file is the fact sheet).
This is the presenter/write-back substrate for the golden goose (issue #14): Linear's
own documented way to show an agent run inside Linear. (The goose itself — the normal
AI chat route — remains decompile-only; see "What is still NOT public" below.)
Last verified 2026-09-27 (sess_01a0e2c4-a88f-730b-acee-8188d527c324) against
`linear/linear@689ccc1e` (**`master`, the default branch**, 2026-09-25). Correction: the
earlier "byte-identical, zero drift" check pinned the STALE upstream branch `main`
(885 KB schema); `master` carries a 1,335 KB schema. Op inventory below re-counted
against master: **22 agent-surface root ops** (was 12).

## AgentSession (lifecycle of one agent run)

`enum AgentSessionStatus { active, awaitingInput, complete, error, pending, stale }`
- Created automatically when an agent is **mentioned or delegated** an issue; or
  proactively via `agentSessionCreateOnIssue` / `agentSessionCreateOnComment`
  (schema also carries a bare `agentSessionCreate`).
- State is auto-derived from emitted activities (no manual state management).
- `externalUrls` point users at YOUR run view and keep the session from being marked
  unresponsive. Set them via `agentSessionUpdate` (`externalUrls` replaces the whole
  array; `addedExternalUrls` / `removedExternalUrls` for deltas) or the dedicated
  `agentSessionUpdateExternalUrl` mutation. The older `externalLink` field is
  **deprecated** (schema, confirmed live docs 2026-09-27).
- `promptContext` (webhook field): the formatted context string (issue + comments +
  guidance) — Linear's own prompt-assembly, usable verbatim as our brain's context.

## AgentActivity (the run stream)

`enum AgentActivityType { action, elicitation, error, prompt, response, thought }`
`union AgentActivityContent = Action | Elicitation | Error | Prompt | Response | Thought`
- `thought` = progress notes (emit within 10s of session start) · `action` = tool call
  (action/parameter/result) · `elicitation` = ask the user · `response` = final answer ·
  `error` = failure · `prompt` = INBOUND user message (the counterpart direction —
  per the live docs an agent CANNOT emit `prompt`; the schema's
  `agentActivityCreatePrompt` mutation is the app-side counterpart).
- **Ephemeral activities** (schema + live docs, added to this digest 2026-09-27):
  `thought`/`action` activities may be marked `ephemeral` — displayed temporarily,
  replaced when the next activity arrives. For transient progress states.
- Activities are frozen-in-time snapshots — read session history from activities, NOT
  comments (editable).
- `enum AgentActivitySignal` + `signalMetadata`: **`stop`** (user → agent: halt
  immediately, then emit final response/error), **`auth`** (agent → user: account-
  linking UI with a URL), **`select`** (elicitation with structured options).

## Agent Plans (technology preview; added to this digest 2026-09-27)

Session-level checklist the agent maintains: `agentSessionUpdate` input field `plan`
= full array of `{ content: string, status: pending | inProgress | completed | canceled }`.
Updates REPLACE the entire plan (no per-item patch). Rendered to users as the
session's task list.

## The 22 official agent-surface root ops (schema root fields, master @ 2026-09-25)

mutations: `agentActivityCreate` · `agentActivityCreatePrompt` ·
`agentActivityDeleteQueued` · `agentActivitySendQueued` · `agentSessionCreate` ·
`agentSessionCreateOnComment` · `agentSessionCreateOnIssue` ·
`agentSessionRestartWithDefaultModel` · `agentSessionUpdate` ·
`agentSessionUpdateExternalUrl` · `agentSkillCreate` · `agentSkillUpdate` ·
`agentSkillDelete`
queries: `agentActivity` · `agentActivities` · `agentSession` · `agentSessions` ·
`agentSessionSandbox` · `agentSessionSshAddress` · `agentSkill` · `agentSkills` ·
`issueRepositorySuggestions`

New since the (stale-branch) 2026-09-27 morning check, all load-bearing for us:

- **Queued activities are now officially controllable**: `agentActivitySendQueued`
  / `agentActivityDeleteQueued` pair with the decompile-derived `AgentActivity.queued`
  field — an external agent can hold activities in a queue and flush on its own tick.
- **Coding-harness surface went official**: `agentSessionSandbox`,
  `agentSessionSshAddress`, `agentSessionRestartWithDefaultModel` (the same ops the
  web client uses; KNOWLEDGE §5).
- **Agent skills are now public API**: `agentSkill(s)` + create/update/delete —
  org skills are manageable programmatically. Pairs with the workspace MCP allowlist
  finding (KNOWLEDGE §5) for putting OUR tools/prompts onto Linear's brain.
- **Usage metering watch**: new root queries `usageAlert` / `usageAlerts` — the
  public side of Linear's usage-alerting surface.

(The SDK's `_generated_documents.graphql` wraps the common ones as
`createAgentActivity` / `updateAgentSession` etc. `issueRepositorySuggestions` —
ranked repo matches for an issue, LLM-backed, candidates supplied by the agent —
is useful for our brain's repo-selection step.)

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
| runtime state `canceled` | `AgentSessionStatus.stale` | Add `stale` (unresponsive) to src/runtime; map user-cancel to the `stop` signal → terminal state. Task: **T-504** (claimed #97, agent-01@gen6) |
| activities: thought/action/response/elicitation/error | + `prompt` (inbound) | Convergent by design — prompt = inbound user turn |
| 0 agent-session ops in src/dataplane | 22 official ops | The presenter/write-back gap — implement as `src/dataplane/agent-sessions.ts` (R3+). Inventory grew 9 → 12 (2026-09-27 morning) → **22** (master re-check same day, branch fix) |

## What is still NOT public (re-verified on master @ 2026-09-25)

**Loops definitions.** `type WorkflowDefinition` IS in the official schema
(activities/conditions as `JSONObject`, `enabled`, context links) — but the schema
exposes **no query or mutation** for it (zero `workflowDefinition*` root ops;
`favorite_workflowDefinition` in the SDK documents is a Favorite field selection,
not a root op). Loops internals remain decompile-only knowledge; our engine over
our own loop configs remains the correct architecture. Watch this type on every
schema refresh — the day ops appear, the golden goose doubles (issue #14 note).

**The AI chat route (the golden goose itself).** The 2026-09-25 schema added the
FULL `AiConversation` type zoo — 174 `AiConversation*` types, including the unions
`AiConversationPart`, `AiConversationToolCall`, `AiConversationWidget`, and
`AiConversationElicitationResponseData`. So the turn/activity WIRE SHAPES the goose
trace needs (issue #14 Q3) are now officially specified, in MIT-licensed SDL. But
there are still **zero public root ops to drive chat**: no `aiConversation` query,
no send-message mutation. Driving the normal chat route remains client-api +
sync-socket territory — decompile-only (KNOWLEDGE §8), unchanged.
