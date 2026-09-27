# Customers — facts from linear.app/developers/managing-customers (fetched 2026-09-27)

Source: https://linear.app/developers/managing-customers

- Models: `Customer` (id, name, `domains[]` — unique, no public email
  providers, `externalIds[]`, `tierId` via `customerTierCreate`, revenue,
  size) and `CustomerNeed` = a customer request attached to an issue
  (customerId?, issueId, attachmentId — URL-backed requests ride an
  Attachment, priority 0|1, body markdown, creatorId).
- `customerNeedCreate` accepts `customerExternalId` as an alternative to the
  Linear id (bring-your-own-key).
- Relevance: this is the substrate of the `customerRequestAdded` loop trigger
  event (KNOWLEDGE §3).
