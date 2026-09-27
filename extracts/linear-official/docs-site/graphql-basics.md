# GraphQL API basics — facts from linear.app/developers/graphql (fetched 2026-09-27)

Source: https://linear.app/developers/graphql

- Endpoint: `https://api.linear.app/graphql` (POST). Introspection is enabled.
  It is "the same API we use internally" per the docs — but note our client-api
  distinction in KNOWLEDGE §6: the web client talks to client-api.linear.app.
- Auth headers:
  - OAuth2 access token: `Authorization: Bearer <ACCESS_TOKEN>`
  - Personal API key: `Authorization: <API_KEY>` — **no `Bearer` prefix**.
    (Load-bearing for src/server/linear.ts: PATs and OAuth tokens take
    DIFFERENT header shapes.)
- Errors: standard GraphQL `errors[]` with `message`, `path`, `extensions`
  (codes/validation). Queries can PARTIALLY succeed with HTTP 200 — always
  check `errors[]` before assuming success. 5xx = server error.
- Issue creation default state: team's first Backlog state, or Triage when the
  team has Triage enabled.
- Property changes within the first 3 minutes of issue creation are folded into
  creation (no activity-log entries).
- `issueUpdate` accepts either the UUID or the shorthand id (`BLA-123`).
- Images/assets uploaded to Linear are auth-walled; regular API auth displays
  them; self-host if displaying outside Linear.
- Mentions in Markdown: paste the plain Linear URL of a user/issue/etc — the
  app renders it as a mention.
- Collapsible sections in Markdown: `+++ Title` … `+++`.
- Realtime: register webhooks; never poll per-issue. Poll recents only with
  `orderBy: updatedAt`.
- Archived resources are excluded from paginated results unless
  `includeArchived: true`.
