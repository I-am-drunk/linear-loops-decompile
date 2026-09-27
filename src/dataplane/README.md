# src/dataplane — Linear data plane (R3, T-301)

Transport to Linear's **public** API with auth, rate budgeting, retries,
fixture mode, and the typed read ops loops consume. Original code; behavior
derived from KNOWLEDGE.md §6 and SPECS/target-architecture.md. Zero runtime
dependencies (Node 22+, ESM).

v2 notes (review fixes, credit: sess_01a0dfbb-1d9c): idempotency default is
derived from the document (`mutation` ⇒ no retry unless opted in); HTTP 400
with `errors[].extensions.code: "RATELIMITED"` is treated as a rate limit
(retry + backoff) per Linear's docs; `x-ratelimit-*-reset` epoch-ms headers
provide the wait floor via `rateLimitWaitMs`; per-attempt `timeoutMs`
(default 30s).

## Boundary (read before importing)

- **This package owns:** HTTP transport to `https://api.linear.app/graphql`,
  credential handling + redaction, the local rate budget, retry policy,
  pagination helpers, fixture mode.
- **Not here:** domain entity types (WorkflowDefinition, AiConversation…) →
  `src/model` (R2). Write ops + webhooks → T-303.

## Facts baked in (KNOWLEDGE.md §6)

- Endpoint: `POST https://api.linear.app/graphql`.
- PAT (Linear Settings → API) goes in the `Authorization` header **raw** (no
  scheme); OAuth access tokens use `Bearer <token>`. PATs act as the owning
  user — `client.verifyAuth()` (`viewer` query) identifies who that is; the
  Settings "Connect Linear" flow uses exactly this to validate a pasted key.
- Rate limit ≈ **2,500 requests/hour per user** — the default local budget.
  Server headers (`X-RateLimit-*-Remaining`, `X-Complexity`, `Retry-After`)
  always win over local math when they disagree.
- The client's `client-api.linear.app` is the sync frontend — **never** used here.

## Usage

