# DEV-DOCS.md — facts digest of developers.linear.app (the official docs LEG, in-repo)

Why this file exists (issue #183): the upstream `linear/linear` repo's `docs/*.md`
are one-line redirect stubs ("Visit developers.linear.app…", verified byte-identical
upstream 2026-09-27), so the vendored "docs drop" carried ~519 bytes of actual API
documentation. The two-source cross-check rule says OFFICIAL wins for everything
the public API covers — this digest makes that leg real and citable in-repo.

Legal line (unchanged): `linear.app/developers` text is not openly licensed.
This file carries FACTS, field/header tables, short quotes, and links — never
wholesale page copies. Every section names its source page and retrieval date.
Refresh cadence: with the ~30-day corpus drift check — re-fetch each digested
page, diff the facts, log material deltas in `KNOWLEDGE.md`.

---

## 1. GraphQL endpoint & auth

Source: <https://linear.app/developers/graphql> (retrieved 2026-09-27)

- Endpoint: `POST https://api.linear.app/graphql`. Introspection is enabled.
  It is "the same API we use internally" (their words) — but note the send/stream
  chat ops are NOT in the public schema (KNOWLEDGE §8a; re-verified on the
  2026-09-25 SDL).
- Auth, two modes — the header format DIFFERS:
  - Personal API key (Settings → Security & access): `Authorization: <key>` — RAW,
    no `Bearer` prefix.
  - OAuth2 access token: `Authorization: Bearer <token>`.
- Errors: standard GraphQL `errors` array (`message`, `path`, `extensions` with
  codes). **A 200 can carry partial `data` plus `errors`** — always check `errors`
  before assuming success.
- Issue creation default state: team's first Backlog state, or Triage when the
  team has Triage enabled. Property changes in the first 3 minutes after creation
  are folded into creation (no activity-log entries).
- Entity UUIDs are copyable in-app: Cmd/Ctrl+K → "Copy model UUID".
- Mentions in markdown: paste the plain Linear URL of a user/issue/etc. and it
  renders as a mention. Collapsible sections: `+++ Title` … `+++`.
- Update guidance (their "Do"): webhooks over polling; when polling is
  unavoidable, `orderBy: updatedAt` + filters; never poll per-entity.
- Images uploaded to Linear are behind auth; API auth (key/OAuth) is accepted to
  fetch them; self-host if displaying outside Linear.

## 2. Rate limiting — THE LOAD-BEARING PAGE

Source: <https://linear.app/developers/rate-limiting> (retrieved 2026-09-27)

- Algorithm: **leaky bucket** — tokens refill continuously at
  `LIMIT_AMOUNT / LIMIT_PERIOD`, not a fixed-window reset. (The reset headers
  still report a window end in epoch ms.)
- Request limits (per hour): API key **2,500/user** (all keys of one user share
  the quota); OAuth app **5,000/user (or app user)**; unauthenticated **600/IP**.
- Complexity limits (per hour): API key **3,000,000/user**; OAuth app
  **2,000,000**; unauthenticated **100,000**. Single-query hard cap: **10,000**
  points (always rejected above).
- Complexity math: property 0.1 pt, object 1 pt, a connection multiplies its
  children by the pagination argument (default 50), total rounded UP. Passing
  explicit `first:` lowers the computed cost.
- Headers on every response (resets are UTC **epoch milliseconds**):
  `X-RateLimit-Requests-{Limit,Remaining,Reset}`,
  `X-Complexity`, `X-RateLimit-Complexity-{Limit,Remaining,Reset}`,
  and on endpoint-limited ops additionally
  `X-RateLimit-Endpoint-Requests-{Limit,Remaining,Reset}` +
  `X-RateLimit-Endpoint-Name`.
- Some individual queries/mutations carry their own lower limits with their own
  windows ("described in the response body").
- **Exceeding a limit: "response http status code will be 400"** with
  `errors[].extensions.code === "RATELIMITED"` in the body (verbatim-critical
  fact; a client that only special-cases 429/200 misroutes the documented
  shape — see PR #155 review). Handle rate-limit detection by BODY code, with
  status as secondary signal.
- Dynamic limits exist for workspace-level OAuth apps using Actor Authorization
  (scales with paid seats); temporary raises via support.

## 3. Pagination

Source: <https://linear.app/developers/pagination> (retrieved 2026-09-27)

- Relay-style cursors on all list queries: `first`/`after`, `last`/`before`;
  `edges{node,cursor}` + `pageInfo{hasNextPage,endCursor}`; `nodes` shorthand.
- Default page size 50 (this default also drives complexity estimates, §2).
- Default order `createdAt`; `orderBy: updatedAt` available (recommended for
  fetch-recent-changes flows).
- Archived entities are excluded by default; `includeArchived: true` opts in.

## 4. Filtering

Source: <https://linear.app/developers/filtering> (retrieved 2026-09-27)

- Filterable list queries take `filter:` with per-field comparator objects.
- Comparators, all field types: `eq neq in nin`. Numeric/date add:
  `lt lte gt gte`. String adds: `eqIgnoreCase neqIgnoreCase startsWith
  notStartsWith endsWith notEndsWith contains notContains containsIgnoreCase
  notContainsIgnoreCase`. Optional fields add `null: true|false`.
- Logic: fields are AND by default; `or: [ … ]` for disjunction.
- Relationship filters nest (`assignee: { email: { eq: … } } }`); many-to-many
  matches "at least one" by default, `every:` forces all-match.
- Date fields accept relative ISO 8601 durations (`"P2W"`, `"-P2W"`) against now.
- Unprioritized issues have priority 0 — `priority: { lte: 2 }` includes them
  unless `neq: 0` is added (their own worked example).

## 5. Webhooks

Source: <https://linear.app/developers/webhooks> (retrieved 2026-09-27)

- Org-scoped; per-team or `allPublicTeams: true`. Only workspace admins (or
  OAuth apps with `admin` scope) create/read webhooks. OAuth apps can auto-create
  a webhook per authorizing org.
- Data-change webhooks cover: Issues, Issue attachments, Issue comments, Issue
  labels, Comment reactions, Projects, Project updates, Documents, Initiatives,
  Initiative updates, Cycles, Customers, Customer requests, Users. Convenience
  events: Issue SLA (`set|highRisk|breached`), OAuthApp revoked.
- Delivery: HTTP POST; consumer must be public HTTPS (non-localhost) and answer
  200 within **5 s**. Failures retry ×3 with backoff **1 min → 1 h → 6 h**;
  a persistently failing webhook may be disabled by Linear (manual re-enable).
- Headers: `Linear-Delivery` (payload UUID — the idempotency handle),
  `Linear-Event` (entity type), `Linear-Signature` (hex HMAC-SHA256 of the RAW
  body with the webhook's signing secret), `Linear-Timestamp` (unix ms),
  `User-Agent: Linear-Webhook`.
- Body (data-change): `action: create|update|remove`, `type`, `actor`
  (user/OAuth client/integration), `createdAt`, `data` (serialized entity),
  `url`, `updatedFrom` (previous values on update; previously-unset → `null`),
  `webhookTimestamp` (unix ms), `webhookId`, `organizationId`.
- Verification guidance: HMAC over the raw body (never restringified JSON),
  timing-safe compare, and reject `webhookTimestamp` more than ~60 s off.
- API management: `webhookCreate(input:{url, teamId|allPublicTeams,
  resourceTypes:[…], …})`, `webhookDelete(id)`, query `webhooks` /
  `teams.nodes.webhooks`.
- Source IPs (may grow): 35.231.147.226, 35.243.134.228, 34.140.253.14,
  34.38.87.206, 34.134.222.122, 35.222.25.142.

## 6. OAuth2

Source: <https://linear.app/developers/oauth-2-0-authentication> (retrieved 2026-09-27)

- Authorize: `GET https://linear.app/oauth/authorize` with `client_id`,
  `redirect_uri`, `response_type=code`, `scope` (comma-separated), optional
  `state` (recommended), `prompt=consent`, `actor=user|app` (`app` for
  agents/service accounts — resources created as the application).
- Scopes: `read` (always), `write`, `issues:create`, `comments:create`,
  `timeSchedule:write`, `admin`; agent scopes (`app:assignable`,
  `app:mentionable`) documented under App authentication.
- PKCE supported (`code_challenge`, `code_challenge_method: plain|S256`).
- Token exchange: `POST https://api.linear.app/oauth/token`
  (`application/x-www-form-urlencoded`), `grant_type=authorization_code`.
  **Access token TTL 24 h** (`expires_in: 86399`) + refresh token. All OAuth2
  apps were migrated to refresh tokens on 2026-04-01.
- Refresh: same token endpoint, `grant_type=refresh_token`; auth via Basic
  (`client_id:client_secret`) or params; PKCE-minted tokens refresh with
  `client_id` only. **30-minute replay grace**: a consumed refresh request can
  be replayed within 30 min if the response was lost.
- Revoke: `POST https://api.linear.app/oauth/revoke` with `token` (+ optional
  `token_type_hint`); 200 revoked / 400 already-revoked / 401 bad auth.
- Client credentials (`grant_type=client_credentials`, opt-in per app): mints an
  **app-actor token, 30-day TTL**, all public teams; no refresh token — re-mint
  on 401. Up to 1,000 parallel tokens IF all share the same scopes; requesting
  different scopes revokes and replaces all existing app tokens; rotating the
  client secret invalidates them. Their CI guidance: mint per run, never persist
  an access token as a long-lived key.

## 7. Attachments (external-link attachments, not file storage)

Source: <https://linear.app/developers/attachments> (retrieved 2026-09-27)

- Attachments link external resources onto issues (GitHub-PR-style).
  **URL is the idempotency key per issue**: `attachmentCreate` with the same
  (issueId, url) updates the existing attachment; `attachmentsForURL(url:)`
  queries by URL — stateless integrations need no stored attachment id.
- Mutations: `attachmentCreate(input:{issueId, title, subtitle?, url, iconUrl?,
  metadata?})`, `attachmentUpdate(id, input)`. Icon: OAuth app icon by default;
  `iconUrl` (png/jpg) overrides.
- `metadata`: arbitrary string/number KV, plus rich keys rendered as a modal:
  `title` (string), `messages` (`{subject?, body?, timestamp?}[]`, keep <10k
  chars), `attributes` (`{name, value}[]`).
- Subtitle date formatting from metadata ISO strings:
  `{var__since}` → "2 days ago"; `{var__relativeTimestamp}` → "today at 9:30 AM"
  within ±6 days, else "Oct 20, 9:30 AM".
- Attachment create/update events are available via webhooks.

## 8. File upload (Linear cloud storage)

Source: <https://linear.app/developers/how-to-upload-a-file-to-linear> (retrieved 2026-09-27)

- Easiest path: reference an external image/video URL (or base64 data URI) in any
  markdown field (`description`, comment body, document) — Linear ingests it into
  its private storage automatically.
- Direct path: `fileUpload(contentType, filename, size)` mutation → returns
  `uploadFile.{uploadUrl, assetUrl, headers[]}`; then `PUT` the bytes to
  `uploadUrl` WITH the returned headers copied onto the request (403 otherwise)
  plus `Content-Type` and `Cache-Control: public, max-age=31536000`; use
  `assetUrl` in subsequent mutations.
- The PUT must run **server-side** — Linear's CSP blocks client-side uploads
  (CORS failure = you tried from the browser).
- Stored files are auth-gated; regular API auth suffices to fetch them.

---

## Coverage table (what is digested vs still website-only)

| developers.linear.app page | Status |
|---|---|
| GraphQL / getting started | §1 |
| Rate limiting | §2 |
| Pagination | §3 |
| Filtering | §4 |
| Webhooks | §5 |
| OAuth 2.0 authentication | §6 |
| Attachments | §7 |
| Upload a file | §8 |
| Agents / agent sessions / app authentication | `AGENT-API.md` (existing digest) |
| API reference (schema) | `schema.graphql` + `_generated_documents.graphql` (vendored SDL, MIT) |
| TypeScript SDK usage | `packages/sdk` README + CHANGELOG (vendored, MIT) |
| Authentication overview page | NOT digested (JS-only render; §1+§6 carry the substance) |
| Create issues via URL | NOT digested (low relevance) |
| CLI importer | `packages/import` README (vendored) |
| Changelog / deprecations | NOT digested — check live during drift review |
| Brand guidelines, Agent interaction guidelines | NOT digested (non-API) |

When a NOT-digested page becomes load-bearing for a slice, digest it here in the
same PR and update this table.
