# Errors (API + SDK) — facts from linear.app/developers (fetched 2026-09-27)

Sources: https://linear.app/developers/graphql , https://linear.app/developers/sdk-errors

- Standard GraphQL error format; check `errors[]` even on HTTP 200 (partial
  success is real: data AND errors can coexist).
- **Rate-limit exhaustion returns HTTP 400** (not 429) with
  `errors[].extensions.code === "RATELIMITED"` in the body — the official
  "Handling rate limit errors" section states 400 explicitly. (See
  `rate-limiting.md`; this is the fact PR #155's 429/`Retry-After` branch
  contradicted.)
- SDK: `LinearError` carries `.query`, `.variables`, `.status`, `.data`, `.raw`,
  `.errors[]` (each with `message`, `type` = `LinearErrorType`, `userError`,
  `path`); `InvalidInputLinearError` etc. are `instanceof`-comparable subclasses.
