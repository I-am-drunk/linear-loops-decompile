# OAuth app manifests — facts from linear.app/developers/oauth-app-manifests (fetched 2026-09-27)

Source: https://linear.app/developers/oauth-app-manifests

- Two equivalent formats to pre-fill app creation: URL parameters against
  `https://linear.app/settings/api/applications/new`, or a JSON manifest.
- Notable params: `distribution=private|public`; `oauth.client_name` (2-80
  chars, must NOT contain "Linear" or a URL); `oauth.client_uri`;
  `oauth.redirect_uris` (repeatable, 1-32, unique); `oauth.grant_types` =
  `authorization_code` (required) and/or `client_credentials`;
  `webhook.enabled`; `webhook.url` (HTTPS; no loopback/private/linear.app
  hosts); `webhook.resourceTypes` (repeatable, unique, min 1 when webhook.url
  set).
- The 22 supported `webhook.resourceTypes` values: AgentSessionEvent,
  AppUserNotification, Attachment, Comment, Customer, CustomerNeed, Cycle,
  Document, Initiative, InitiativeUpdate, Issue, IssueLabel, IssueSLA,
  OAuthAuthorization, PermissionChange, Project, ProjectLabel, ProjectUpdate,
  Reaction, Release, ReleaseNote, User.
- (For us: a pre-filled manifest URL is the reproducible operator-setup path
  for the OAuth app our server needs — ship it in Settings docs, R4+.)
