# Integrations

Linear is **one integration**, not the foundation. This is the biggest
architectural change in the rearchitecture.

## Before and after

The project was built as "a Linear feature, self-hosted": Linear's data model
was our data model, Linear's API was our data plane, and every surface asked
what Linear does. That is why scope kept expanding — the product had no spine
of its own.

Now: we are an automation product with a workspace UI. An integration
contributes three things, and nothing else:

1. **Entities** we can read (issues, projects, channels, repos).
2. **Events** that can trigger an automation.
3. **Actions** an automation can take (comment, update, send).

## The interface

```
Integration       id · name · logo · auth · status
IntegrationAuth   kind: oauth2 | token | pairing
IntegrationEntity kind · fields · list/get
IntegrationEvent  kind · delivery: webhook | poll · payload
IntegrationAction kind · inputs · invoke
```

An integration registers its events into the trigger catalog and its actions
into the action catalog. The automations page does not know what Linear is; it
knows there are integrations that offer triggers and actions.

## Linear, concretely

**Sign-in.** The owner connects their Linear account from Settings. OAuth, or a
personal access token for a single-user deployment. Tokens are **write-only in
the UI and encrypted at rest** — not hashed: the client has to send the actual
value in the `authorization` header, and OAuth refresh needs the refresh token
back, so a one-way hash would make both impossible. Public OAuth tokens expire
in 24 hours, so refresh is required rather than optional
(`extracts/linear-official/docs-site/oauth.md`).

**Entities.** Issues, projects, teams, cycles, documents, initiatives — read
through the public GraphQL API, which this repo already has a hardened client
for (`src/server/linear-client.ts`: header-driven rate budget, `RATELIMITED`
on HTTP 400, per-window reset handling). That client is the best thing the old
eras produced and it carries over unchanged.

**Events.** Linear's webhooks cover issues, labels, comments, projects,
initiatives, documents and releases, and Linear recommends webhooks over
polling for change notification
(`extracts/linear-official/docs-site/webhooks.md`). HMAC-SHA256 over the raw
body, a timestamp replay guard, respond within 5 seconds, at-least-once
delivery — so dedupe on the delivery id is mandatory, not an optimization.

An earlier draft of this plan listed releases as poll-only; that was wrong,
`Release` is a webhook resource type. What webhooks genuinely do not deliver is
cycle start/end (no webhook action fires at the boundary) and team membership,
so those we derive from our own clock or poll. Re-verify the resource list
against the docs digest when IG4 starts rather than trusting this paragraph.

**Actions.** Create and update issues, comment, set status — public API
mutations, through the same client, audited.

**What Linear does not give us.** No public API exposes automation
definitions, drafts, runs, or memories. Those are ours by necessity, which is
settled and reproduced independently three times. We are not a client for
Linear's automations; we are our own product that integrates with Linear.

## Linear's agent surface: a second, free UI for our runs

Issue #14 asked whether Linear's chat could be free inference. It cannot —
every Linear entry point draws the same AI-credits wallet. But the research
found something more useful, and it has been sitting in a closed research
thread instead of this plan.

The **Agent Sessions API** (Developer Preview) gives us Linear's whole native
agent UX — sessions, activities, plans, elicitations, inbox wiring — at no
cost, because *we* bring the brain. An OAuth app with `app:mentionable` +
`app:assignable` makes our server an agent member of the workspace. Mention or
delegate to it and a session opens; we stream `thought` / `action` /
`response` activities into it and the run renders inside Linear.

Facts in `extracts/linear-official/AGENT-API.md`, verified against the MIT
schema at `linear/linear@689ccc1e` (`master`) plus the live preview docs:

| Fact | Consequence for us |
|---|---|
| Session status is auto-derived from emitted activities | we never manage state, we just emit |
| `promptContext` on the webhook is Linear's own assembled prompt | usable verbatim as our brain's context |
| Activities are frozen snapshots; comments are editable | read history from activities, never comments |
| `externalUrls` point at our run view | keeps the session from being marked unresponsive |
| `thought` must land within 10s of session start | our runner emits an ack before doing work |
| `signal: stop` arrives on a `prompt` | halt immediately, then confirm with `response`/`error` |
| `plan` updates REPLACE the whole array | no per-item patch; send the full checklist |

This is additive, not a dependency. Our own automations page stays the primary
surface; this is a second front end for the same runs, for the case where the
owner is already in Linear. It is **`IG7`, after `IG5`** — it needs actions and
auth working first. Re-verify the op list before starting; it is a preview
surface and moved once already (12 ops → 22 between two checks a day apart).

## Others

The interface exists so the second integration is cheap. GitHub, Slack, and a
generic webhook are the obvious next three. None are in the first milestone.

## Slices

| Slice | Scope |
|---|---|
| IG1 | integration interface + registry + status model |
| IG2 | Linear: OAuth/PAT sign-in, token storage, refresh |
| IG3 | Linear: entity reads over the existing client |
| IG4 | Linear: webhook receiver — HMAC, replay guard, dedupe |
| IG5 | Linear: actions (comment, update) with audit |
| IG6 | trigger/action catalog registration from integrations |
| IG7 | Linear agent sessions: our runs rendered inside Linear (after IG5) |
