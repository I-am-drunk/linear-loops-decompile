# Rate limiting — facts from linear.app/developers/rate-limiting (fetched 2026-09-27)

Source: https://linear.app/developers/rate-limiting

Algorithm: leaky bucket; tokens refill at `LIMIT_AMOUNT / LIMIT_PERIOD`.
Quotas are per USER (all API keys of one user share a quota) except
unauthenticated, which is per IP.

## Request limits (per hour)

| Auth | Requests/h | Scope |
|---|---|---|
| API key | 2,500 | User |
| OAuth app | 5,000 | User (or App User) |
| Unauthenticated | 600 | IP address |

Response headers on EVERY request:
- `X-RateLimit-Requests-Limit` — max requests per hour
- `X-RateLimit-Requests-Remaining` — remaining in the current window
- `X-RateLimit-Requests-Reset` — window reset time, UTC epoch **milliseconds**

## Endpoint-specific limits

Some queries/mutations carry lower individual limits. When hit, the response
adds:
- `X-RateLimit-Endpoint-Requests-Limit` / `-Remaining` / `-Reset`
- `X-RateLimit-Endpoint-Name` — which endpoint was limited

## Complexity limits (per hour)

| Auth | Points/h |
|---|---|
| API key | 3,000,000 |
| OAuth app | 2,000,000 |
| Unauthenticated | 100,000 |

Headers on every request: `X-Complexity` (this query's cost),
`X-RateLimit-Complexity-Limit` / `-Remaining` / `-Reset` (epoch ms).

- Max complexity of a SINGLE query: 10,000 points — always rejected above that.
- Scoring: each property 0.1 pt, each object 1 pt; a connection multiplies its
  children by the pagination argument (default 50); total rounded UP.
  Example from the docs: `user { name }` = 1 + 0.1 = 1.1 → complexity 2.
- Explicit `first: N` lowers the calculated cost vs the default 50.

## Exhaustion behavior (load-bearing for src/server dataplane)

- GraphQL requests over the limit return HTTP **400** (not 429) with an
  `errors[]` entry whose `extensions.code` is **`RATELIMITED`**.
- Endpoint-specific limits return "the same response" (RATELIMITED body) plus
  the endpoint headers above.

## Practices the docs mandate

- Never poll per-entity; use webhooks for updates.
- If polling recents is unavoidable, order by `updatedAt`.
- Filter server-side; specify pagination amounts (children multiply complexity).
- Dynamic limits: workspace-level OAuth apps using Actor Authorization get
  limits raised with paid-user count.
- Temporary higher limits: contact Linear support.
