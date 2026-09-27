# Customers — facts from linear.app/developers/managing-customers (fetched 2026-09-27)

Source: https://linear.app/developers/managing-customers

- Two models: `Customer` (an external company) and `CustomerNeed` (a customer
  request attached to an issue).
- `Customer`: id, name, `domains[]` (unique values; public email providers
  rejected), `externalIds[]` (bring-your-own-key), tier via
  `customerTierCreate`/`tierId`, revenue, size.
- `CustomerNeed`: customerId?, issueId, body (markdown), priority (0|1),
  creatorId; passing a `url` in the input creates an Attachment and ties the
  request to it (attachmentId).
- `customerNeedCreate` accepts `customerExternalId` instead of the Linear
  Customer id.
- (For us: substrate of the `customerRequestAdded` loop trigger event —
  KNOWLEDGE §3.)
