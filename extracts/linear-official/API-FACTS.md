# API-FACTS — Linear's official developer docs, digested (the pages the repo never actually read)

**Why this file exists.** The upstream `linear/linear` repo's `docs/*.md` files —
vendored here as `docs/API.md`, `docs/OAuth2.md`, `docs/Webhooks.md`,
`docs/Attachments.md` — are one-line REDIRECT STUBS ("Visit developers.linear.app…").
The real documentation lives only on `linear.app/developers/*` (26 pages, server-
rendered HTML, fetchable with plain curl — no JS needed). Until 2026-09-27 this repo
believed it had "the full docs drop" while carrying none of the API prose. This file
is the curated fact sheet from ALL 26 live pages: facts, field lists, exact limits,
and short quotes with source links — never wholesale page copies (legal line,
`README.md` in this directory).

Verified 2026-09-27 against the live pages (sess_01a0e452-8c3e-71d6-90f5-006c0aea8aee).
Refresh recipe at the bottom. Agent-surface pages ({agents, agent-interaction,
agent-best-practices, agent-signals, aig}) are digested in `AGENT-API.md`; this file
covers everything else and cross-checks it.

## 1. Endpoint + authentication
Source: [linear.app/developers/graphql](https://linear.app/developers/graphql)

- Public endpoint: `https://api.linear.app/graphql` (introspection enabled;
  explorable in Apollo Studio without login).
- **Personal API key**: header `Authorization: <API_KEY>` — **NO `Bearer` prefix**.
- **OAuth2 access token**: header `Authorization: Bearer <ACCESS_TOKEN>`.
  (Consequence for our settings vertical: a token probe must send the right shape
  for the credential kind, or accept both; `src/server/linear.ts` currently sends
  the raw form, correct for PATs only.)
- GraphQL requests can PARTIALLY succeed: HTTP 200 with both `data` and `errors`.
  Always check `errors[]` (each has `message`, `path`, `extensions` with codes).
- Issue creation detail: without `stateId` the issue lands in the team's first
  Backlog state (or Triage when enabled). Property changes within the **first 3
  minutes** of issue creation are folded into creation (no activity-log entries).
- Images/assets uploaded to Linear require authentication to fetch (see §8).

## 2. Rate limiting — the exact budgets (replaces "≈2,500 req/h" folklore)
Source: [linear.app/developers/rate-limiting](https://linear.app/developers/rate-limiting)

Algorithm: **leaky bucket**, refill rate = `LIMIT_AMOUNT / LIMIT_PERIOD`. Higher
limits by request via Linear support. Changes are announced in their Slack
community API channel. Polling is explicitly discouraged — use webhooks.

Request limits (per hour):

| Auth | Limit | Scoped to |
|---|---|---|
| API key | 2,500 | User (all keys of one user SHARE the quota) |
| OAuth app | 5,000 | User (or App User) |
| Unauthenticated | 600 | IP address |

Complexity limits (per hour): each property = 0.1 point, each object = 1 point,
connections MULTIPLY their children by the pagination amount (default 50!).

| Auth | Points | Scoped to |
|---|---|---|
| API key | 3,000,000 | User |
| OAuth app | 2,000,000 | User (or App User) |
| Unauthenticated | 100,000 | IP address |

- **Single-query maximum: 10,000 points** — rejected outright above that.
- Response headers, EVERY response: `X-RateLimit-Requests-Limit/-Remaining/-Reset`,
  `X-Complexity`, `X-RateLimit-Complexity-Limit/-Remaining/-Reset`. Resets are
  **UTC epoch milliseconds**.
- Some ops have OWN tighter windows, signaled by
  `X-RateLimit-Endpoint-Requests-Limit/-Remaining/-Reset` + `X-RateLimit-Endpoint-Name`.
- (Cross-check: PR #155's header-driven budget parses exactly this set — the
  header names and epoch-ms semantics match the official page. Verified.)

## 3. Pagination
Source: [linear.app/developers/pagination](https://linear.app/developers/pagination)

- Relay-style cursors: `first`/`after`, `last`/`before`; `pageInfo { hasNextPage
  endCursor }`; simpler `nodes` syntax also supported.
- **Default page size 50** when no argument given (this is what multiplies
  complexity, §2).
- Default order `createdAt`; pass `orderBy: updatedAt` for most-recently-updated
  first (their recommended pattern for sync-style reads).

## 4. Filtering
Source: [linear.app/developers/filtering](https://linear.app/developers/filtering)

- Comparators, all field kinds: `eq neq in nin`; numeric/date add `lt lte gt gte`;
  strings add `eqIgnoreCase neqIgnoreCase startsWith notStartsWith endsWith
  notEndsWith contains notContains containsIgnoreCase notContainsIgnoreCase`;
  optional fields add `null: true|false`.
- Logic: implicit AND across fields; `or: [ … ]` for disjunction; `every` on
  many-to-many relations (default is "at least one matches").
- Relationship filters nest (e.g. `assignee: { email: { eq: … } } }`).
- **Relative time on all date fields**: ISO 8601 durations, e.g. `dueDate: { lt:
  "P2W" }` (next 2 weeks), `completedAt: { gt: "-P2W" }` (past 2 weeks).

## 5. Errors (API + SDK)
Sources: [graphql](https://linear.app/developers/graphql), [sdk-errors](https://linear.app/developers/sdk-errors)

- Standard GraphQL error format; check `errors[]` even on HTTP 200.
- **Rate-limit exhaustion returns HTTP 400** (not 429) with
  `errors[].extensions.code === "RATELIMITED"` in the body — the official page's
  "Handling rate limit errors" section states 400 explicitly. (Consequence:
  PR #155's HTTP-429/`Retry-After` branch is NOT documented behavior; its
  RATELIMITED-code branch is the documented one. Flagged on that PR.)
- SDK: `LinearError` carries `.query`, `.variables`, `.status`, `.data`, `.raw`,
  `.errors[]` (each with `message`, `type` = `LinearErrorType`, `userError`, `path`);
  `InvalidInputLinearError` etc. are `instanceof`-comparable subclasses.

## 6. Webhooks — the full contract
Source: [linear.app/developers/webhooks](https://linear.app/developers/webhooks)

- Data-change webhooks exist for: Issues, Issue attachments, Issue comments,
  Issue labels, Comment reactions, Projects, Project updates, Documents,
  Initiatives, Initiative updates, Cycles, Customers, Customer requests, Users.
  Convenience events: Issue SLA (`set|highRisk|breached`), OAuthApp revoked.
- Scope: webhooks belong to an **Organization**; per-team or `allPublicTeams: true`.
  Only workspace **admins** (or OAuth apps with `admin` scope) create/read them.
  OAuth apps can carry webhook config; each new org install auto-creates a webhook.
- Consumer contract: public HTTPS non-localhost URL; **respond HTTP 200 within 5
  seconds** or delivery counts as failed; retries after **1 min, 1 h, 6 h** (3
  retries max); persistent failure ⇒ Linear may DISABLE the webhook (manual
  re-enable).
- Request headers: `Linear-Delivery` (UUID v4 per payload), `Linear-Event`
  (entity type), `Linear-Signature`, `Linear-Timestamp` (Unix ms).
- **Signature: hex HMAC-SHA256 of the RAW body** with the webhook's signing
  secret; verify with a timing-safe compare; verify the body's `webhookTimestamp`
  is within ~1 minute (replay guard). Never re-stringify parsed JSON to verify.
- Payload fields (data-change events): `action: create|update|remove`, `type`,
  `actor` (User | OAuth client | Integration; nullable), `createdAt`,
  `data` (full serialized entity), `url`, `updatedFrom` (previous values of all
  changed properties on `update`; previously-unset ⇒ `null`), `webhookTimestamp`,
  `webhookId`, `organizationId`.
- API management: `webhookCreate(input: { url, teamId | allPublicTeams,
  resourceTypes: [Issue, Comment, IssueLabel, Project, Cycle, Reaction, …] })`,
  `webhooks`/`team.webhooks` queries, `webhookDelete(id)`.
- (For our engine: this is the trigger transport for entity-event loops — the
  5-second ACK + retry ladder + HMAC + replay-guard are requirements on
  `src/server`'s future webhook receiver, R6.)

## 7. OAuth 2.0 — including the 2026 refresh-token regime
Sources: [oauth-2-0-authentication](https://linear.app/developers/oauth-2-0-authentication), [oauth-actor-authorization](https://linear.app/developers/oauth-actor-authorization)

- Authorize: `GET https://linear.app/oauth/authorize` with `client_id`,
  `redirect_uri`, `response_type=code`, `scope` (comma-separated), optional
  `state` (recommended), `prompt=consent`, `actor=user|app`. PKCE supported
  (`code_challenge`, `code_challenge_method: plain|S256`).
- Scopes: `read` (always present), `write`, `issues:create`, `comments:create`,
  `timeSchedule:write`, `admin` (never ask unless needed), plus agent scopes
  `app:assignable`, `app:mentionable`, `customer:read/write`,
  `initiative:read/write` (see AGENT-API.md). `actor=app` **cannot** combine
  with `admin` scope.
- Token: `POST https://api.linear.app/oauth/token`, body
  `application/x-www-form-urlencoded` (NOT JSON): `code`, `redirect_uri`,
  `client_id`, `client_secret`, `grant_type=authorization_code` (PKCE:
  `code_verifier`, secret optional).
- **All OAuth2 apps migrated to refresh tokens on April 1, 2026. Access tokens
  are valid for 24 hours** and must be refreshed: `grant_type=refresh_token` +
  `refresh_token`, auth via Basic (`base64(client_id:client_secret)`) or params.
  Consuming a refresh token has a **30-minute replay grace period** (replay the
  request to recover the new token after network errors). CI/scheduled automation:
  "Client credentials token" flow (`oauth.grant_types=client_credentials` exists
  in app manifests, §9).
- Pre-Dec-2023 apps get `scope` as a string ARRAY in token responses; newer apps
  get a space-joined string.
- `actor=app`: token acts AS the app (agents/service accounts; workspace-admin
  install). Optional per-mutation attribution: `createAsUser` + `displayIconUrl`
  on `issueCreate`/`commentCreate` ("User (via Application)" rendering).
  `actor=application` is the deprecated ancestor.
- (Goose relevance, issue #14: the 24 h expiry + refresh cycle is the documented
  lifetime model for OAuth tokens — a live E1 data point to compare against
  whatever session token the first-party client rides.)

## 8. File storage
Source: [file-storage-authentication](https://linear.app/developers/file-storage-authentication)

- Uploaded files live at `https://uploads.linear.app/...`, auth REQUIRED: same
  `Authorization` header as GraphQL.
- Alternative: request header `public-file-urls-expire-in: <seconds>` on GraphQL
  calls makes all returned file URLs pre-signed for that lifetime.

## 9. OAuth app manifests
Source: [oauth-app-manifests](https://linear.app/developers/oauth-app-manifests)

- Two equivalent formats: URL parameters against
  `https://linear.app/settings/api/applications/new`, or a JSON manifest.
- Notable params: `distribution=private|public`; `oauth.client_name` (2-80 chars,
  must NOT contain "Linear" or a URL); `oauth.redirect_uris` (1-32, unique);
  `oauth.grant_types` = `authorization_code` (required) and/or
  `client_credentials`; `webhook.url` (HTTPS, no loopback/private/linear.app
  hosts); `webhook.resourceTypes` (22 values: AgentSessionEvent,
  AppUserNotification, Attachment, Comment, Customer, CustomerNeed, Cycle,
  Document, Initiative, InitiativeUpdate, Issue, IssueLabel, IssueSLA,
  OAuthAuthorization, PermissionChange, Project, ProjectLabel, ProjectUpdate,
  Reaction, Release, ReleaseNote, User).
- (For us: a manifest/pre-filled URL is the reproducible way to have operators
  create the OAuth app our server needs — worth shipping in Settings docs, R4+.)

## 10. Attachments
Source: [attachments](https://linear.app/developers/attachments)

- Attachment **URL is an idempotency key per issue**: re-creating with the same
  URL on the same issue UPDATES the existing attachment (stateless integrations).
- Query by URL: `attachmentsForURL(url:)`. OAuth-created attachments default to
  the app's icon; `iconUrl` (png/jpg) overrides.
- `metadata`: free key-value (string|number) + rich-modal keys `title`,
  `messages[] { subject? body? timestamp? }` (keep < 10k chars), `attributes[]
  { name value }`.
- Subtitle date formatting: `{var__since}` ("2 days ago") and
  `{var__relativeTimestamp}` ("today at 9:30 AM"), fed by ISO dates in metadata.
- (For us: run write-back should attach our run URL to the target issue — the
  idempotent-URL semantics mean re-runs update one attachment, no dedup store.)

## 11. Customers
Source: [managing-customers](https://linear.app/developers/managing-customers)

- Models: `Customer` (id, name, `domains[]` unique/no public email providers,
  `externalIds[]`, `tierId` via `customerTierCreate`, revenue, size) and
  `CustomerNeed` = a customer request on an issue (customerId?, issueId,
  attachmentId — URL-backed requests ride an Attachment, priority 0|1, body md,
  creatorId).
- `customerNeedCreate` accepts `customerExternalId` as an alternative to the
  Linear id (bring-your-own-key). Relevant to the `customerRequestAdded` loop
  trigger event (KNOWLEDGE §3).

## 12. Deprecations policy
Source: [deprecations](https://linear.app/developers/deprecations)

- No API versioning. Breaking changes: proactive outreach; removed functionality
  can leave **non-functioning stubs** in the schema (a resolving op is not proof
  it still works!). `@deprecated` directives in the schema; `[API]`-prefixed
  entries in the Linear changelog are the drift feed.

## 13. SDK pages (pointers)
Sources: [sdk](https://linear.app/developers/sdk), [sdk-fetching-and-modifying-data](https://linear.app/developers/sdk-fetching-and-modifying-data), [advanced-usage](https://linear.app/developers/advanced-usage), [sdk-webhooks](https://linear.app/developers/sdk-webhooks), [migrating-from-1-x-to-2-x](https://linear.app/developers/migrating-from-1-x-to-2-x)

Client usage patterns; `LinearClient({ apiKey | accessToken, headers })`;
raw GraphQL via `linearClient.client.rawRequest(query, vars)`. We are zero-dep
and do not consume the SDK; these pages matter only as behavior cross-checks
(the vendored `packages/sdk/*` READMEs + CHANGELOG cover history).

## Refresh recipe (add to the ~30-day drift check)

The pages are server-rendered — plain curl works, no headless browser:

```bash
# page list: grep 'developers/[a-z0-9-]*' from https://linear.app/sitemap.xml
curl -s https://linear.app/developers/<page>   # full HTML, strip tags locally
```

Diff the extracted facts against this file; note deltas in KNOWLEDGE.md §drift.
Do NOT commit page copies — facts, field lists, short quotes, links only.
