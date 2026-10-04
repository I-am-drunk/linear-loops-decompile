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
personal access token for a single-user deployment. Tokens are write-only and
stored hashed-at-rest. Public OAuth tokens expire in 24 hours, so refresh is
required, not optional.

**Entities.** Issues, projects, teams, cycles, documents, initiatives — read
through the public GraphQL API, which this repo already has a hardened client
for (`src/server/linear-client.ts`: header-driven rate budget, `RATELIMITED`
on HTTP 400, per-window reset handling). That client is the best thing the old
eras produced and it carries over unchanged.

**Events.** Linear's webhooks cover issues, labels, comments, projects,
initiatives, documents. HMAC-SHA256 over the raw body, a timestamp replay
guard, respond within 5 seconds, at-least-once delivery — so dedupe on the
delivery id is mandatory. What webhooks do not cover (cycle start/end, releases,
team membership) we poll or derive from our own clock.

**Actions.** Create and update issues, comment, set status — public API
mutations, through the same client, audited.

**What Linear does not give us.** No public API exposes automation
definitions, drafts, runs, or memories. Those are ours by necessity, which is
settled and reproduced independently three times. We are not a client for
Linear's automations; we are our own product that integrates with Linear.

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
