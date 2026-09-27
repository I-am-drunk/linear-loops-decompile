# SDK pages — pointers (fetched 2026-09-27)

Sources: https://linear.app/developers/sdk ,
https://linear.app/developers/sdk-fetching-and-modifying-data ,
https://linear.app/developers/advanced-usage ,
https://linear.app/developers/sdk-webhooks ,
https://linear.app/developers/migrating-from-1-x-to-2-x

- Client usage patterns: `LinearClient({ apiKey | accessToken, headers })`;
  raw GraphQL via `linearClient.client.rawRequest(query, vars)`.
- We are zero-dep and do not consume the SDK; these pages matter only as
  behavior cross-checks (the vendored `../packages/`-README digests + SDK
  CHANGELOG cover history). Not digested further on purpose.
