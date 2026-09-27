# OAuth app manifests — facts from linear.app/developers/oauth-app-manifests (fetched 2026-09-27)

Source: https://linear.app/developers/oauth-app-manifests

- Two equivalent app-creation formats: pre-filled URL parameters against
  `https://linear.app/settings/api/applications/new`, or a JSON manifest.
- Notable params: `distribution=private|public`; `oauth.client_name` (2-80
  chars, must NOT contain "Linear" or a URL); `oauth.redirect_uris` (1-32,
  unique); `oauth.grant_types` = `authorization_code` (required) and/or
  `client_credentials`; `webhook.url` (HTTPS; no loopback, private-range, or
  linear.app hosts); `webhook.enabled`.
- `webhook.resourceTypes` — 22 values: AgentSessionEvent, AppUserNotification,
  Attachment, Comment, Customer, CustomerNeed, Cycle, Document, Initiative,
  InitiativeUpdate, Issue, IssueLabel, IssueSLA, OAuthAuthorization,
  PermissionChange, Project, ProjectLabel, ProjectUpdate, Reaction, Release,
  ReleaseNote, User.
- For us: a manifest / pre-filled URL is the reproducible operator-setup path
  for the OAuth app our server needs (Settings docs, R4+).
