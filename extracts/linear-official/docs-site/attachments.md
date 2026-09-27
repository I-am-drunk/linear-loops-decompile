# Attachments — facts from linear.app/developers/attachments (fetched 2026-09-27)

Source: https://linear.app/developers/attachments
(Load-bearing for R5.3 write-back: attachments are the sanctioned way to link a
loop run's external artifacts to an issue, with idempotency built in.)

- Attachments link external resources to issues, rendered like GitHub PRs.
- **URL is the idempotency key per issue**: re-creating an attachment with the
  same `url` on the same `issueId` UPDATES the original instead of duplicating.
  Stateless integrations need not store attachment ids.
- Query by URL: `attachmentsForURL(url: …)` returns the attachment(s) + issue —
  no id tracking needed in either direction.
- Create: `attachmentCreate(input: { issueId, title, subtitle?, url, iconUrl?,
  metadata? })`; update: `attachmentUpdate(id, input)`.
- Icon: OAuth-app icon by default under OAuth auth; `iconUrl` overrides (png or
  jpg only).
- `metadata`: arbitrary string/number key-values (API-only today), PLUS rich
  keys rendered as a modal in Linear: `title` (string), `messages`
  (`{subject?, body?, timestamp?}[]`, keep < 10k chars, populate `body`),
  `attributes` (`{name, value}[]`).
- Subtitle date formatting from metadata ISO-date variables:
  `{var__since}` → "2 days ago"; `{var__relativeTimestamp}` → "today at 9:30 AM"
  (±6 days) or "Oct 20, 9:30 AM" beyond.
- Webhooks cover attachment create/update (see webhooks.md entity list).
