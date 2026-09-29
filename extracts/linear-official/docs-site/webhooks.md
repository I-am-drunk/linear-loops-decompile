# Webhooks — facts from linear.app/developers/webhooks (fetched 2026-09-27)

Source: https://linear.app/developers/webhooks
(Load-bearing for our loop event triggers: Linear-side webhooks are how our
engine hears entity events without polling.)

- Webhooks are Organization-scoped; configurable for all public teams or one
  team. Only workspace ADMINS (or OAuth apps with `admin` scope) can create or
  read webhooks. OAuth apps can auto-register a webhook per authorizing org.
- Data-change webhooks exist for: Issues, Issue attachments, Issue comments,
  Issue labels, Comment reactions, Projects, Project updates, Documents,
  Initiatives, Initiative updates, Cycles, Customers, Customer requests, Users.
  Convenience events: Issue SLA (`set|highRisk|breached`), OAuthApp revoked.
- Consumer contract: public HTTPS non-localhost URL; respond HTTP 200 within
  **5 seconds**. Failures retry 3 times with backoff at 1 min, 1 h, 6 h; a
  persistently failing webhook may be disabled and must be re-enabled manually.
- API management: `webhookCreate(input: { url, teamId | allPublicTeams: true,
  resourceTypes: [...] })`, `webhookDelete(id)`, `webhooks` query.

## Payload

Headers: `Linear-Delivery` (UUID per payload), `Linear-Event` (entity type),
`Linear-Signature` (hex HMAC-SHA256 of the RAW body with the signing secret),
`Linear-Timestamp` (unix ms), `User-Agent: Linear-Webhook`.

Data-change body fields: `action` (`create|update|remove`), `type`, `actor`
(User | OAuth client | Integration), `createdAt`, `data` (serialized entity),
`url`, `updatedFrom` (previous values of changed props on `update`; previously
unset props come as `null`), `webhookTimestamp` (unix ms), `webhookId`,
`organizationId`.

## Verification (both steps are documented as required practice)

1. HMAC-SHA256 the RAW request body (never a restringified parse) with the
   webhook signing secret; timing-safe compare to `Linear-Signature`.
2. Reject when `webhookTimestamp` is more than ~1 minute from now (replay guard).
Optional: source-IP allowlist — 35.231.147.226, 35.243.134.228, 34.140.253.14,
34.38.87.206, 34.134.222.122, 35.222.25.142 (list may grow).

Return 500 on handler failure so Linear retries; 200 only after processing.
