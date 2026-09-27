# OAuth 2.0 — facts from linear.app/developers/oauth-2-0-authentication (fetched 2026-09-27)

Source: https://linear.app/developers/oauth-2-0-authentication

- Authorize: `GET https://linear.app/oauth/authorize` with `client_id`,
  `redirect_uri`, `response_type=code`, `scope` (comma-separated), optional
  `state` (recommended), `prompt=consent`, `actor=user|app`.
  PKCE supported (`code_challenge`, `code_challenge_method=plain|S256`).
- Scopes: `read` (always present), `write`, `issues:create`, `comments:create`,
  `timeSchedule:write`, `admin`; agent scopes `app:assignable`,
  `app:mentionable` (+ `customer:read/write`, `initiative:read/write`) live in
  the agents docs. `actor=app` apps CANNOT request `admin`.
- Token exchange: `POST https://api.linear.app/oauth/token`, body is
  `application/x-www-form-urlencoded` (NOT JSON): `code`, `redirect_uri`,
  `client_id`, `client_secret`, `grant_type=authorization_code`.
- **All OAuth2 apps migrated to refresh tokens on 2026-04-01.** Access token is
  valid **24 h** (`expires_in` 86399) and comes with a `refresh_token`.
- Refresh: `grant_type=refresh_token` + `refresh_token`; auth via Basic
  `base64(client_id:client_secret)` or body params. **30-minute grace window**:
  the original refresh request can be replayed if the response was lost.
- Revoke: `POST https://api.linear.app/oauth/revoke` with `token` (+optional
  `token_type_hint`). 200 revoked / 400 already revoked / 401 bad auth.
- Client credentials (`grant_type=client_credentials`, must be toggled on per
  app): returns an `app` actor token, valid **30 days**, no refresh token —
  re-fetch on 401. Docs mandate for CI/automation: request a fresh token per
  run, never persist one as a long-lived key. Up to 1000 parallel tokens IF all
  share the same scopes; a different-scope request revokes all existing ones.
  Rotating the client secret invalidates them all.
- Old note: pre-Dec-2023 apps return `scope` as an array in token responses.
