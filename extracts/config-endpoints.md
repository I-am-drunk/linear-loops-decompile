# Client Configuration & Endpoints (extracted)

Source: `config.Uz-QjVze.js` in the production bundle — the SINGLE flat config module.
Re-hosting the client = rewriting this one file. Regenerate via runbook.

## Endpoints & build-time env

| Key | Value |
|---|---|
| ANALYTICS_URL | https://e.linear.app |
| API_SERVER_URL | https://client-api.linear.app |
| ASKS_WEB_FORMS_URL | https://asks.linear.app |
| ASSET_URL | https://static.linear.app/client/ |
| CLIENT_URL | https://linear.app |
| DEBUG_LOG_NETWORK_DATA | false |
| DEMO_ORGANIZATION_ID | 3c2f7bee-10f9-4248-838b-c94f7e2242f1 |
| DEMO_USER_ACCOUNT_ID | ba7a19e2-cb18-4f3b-8089-23895c7bc4e6 |
| DEMO_USER_EMAIL | user@linear-demo.com |
| DEMO_USER_ID | 193aab40-d27d-464c-97b3-1859abfcd721 |
| DISCORD_OAUTH_REDIRECT_URL | https://linear.app/connect/discord/callback |
| EMAIL_INTAKE_FROM_EMAIL | issues@linear.app |
| EMAIL_INTAKE_HOSTNAME | intake.linear.app |
| FIGMA_OAUTH_REDIRECT_URL | https://linear.app/connect/figma/callback |
| FRONT_OAUTH_REDIRECT_URL | https://linear.app/connect/front/callback |
| GITHUB_APP_OAUTH_REDIRECT_URL | https://linear.app/connect/github-account/callback |
| GITHUB_APP_URL | https://github.com/apps/linear |
| GITHUB_CODE_ACCESS_APP_OAUTH_REDIRECT_URL | https://linear.app/connect/github-account-code-access/callback |
| GITHUB_CODE_ACCESS_APP_URL | https://github.com/apps/linear-code |
| GITHUB_IMPORTER_APP_URL | https://github.com/apps/linear-data-importer |
| GITHUB_IMPORTER_INSTALL_URL | https://github.com/apps/linear-data-importer/installations/new |
| GONG_OAUTH_REDIRECT_URL | https://linear.app/connect/gong/callback |
| GOOGLE_CALENDAR_REDIRECT_URL | https://linear.app/connect/google/callback |
| GOOGLE_OAUTH_REDIRECT_URL | https://linear.app/auth/google/callback |
| GOOGLE_SHEETS_REDIRECT_URL | https://linear.app/connect/google/callback |
| GRAPHQL_SERVER_HTTP | https://client-api.linear.app/graphql |
| HOST | local.linear.dev |
| IS_PRODUCTION_RUNTIME | true |
| JIRA_OAUTH_REDIRECT_URL | https://linear.app/connect/jira/callback |
| LAUNCHDARKLY_OAUTH_REDIRECT_URL | https://linear.app/connect/launchdarkly/callback |
| LINEAR_DEMO_ORGANIZATION_ID | d763f07e-f5da-4a9f-b9da-12c4563607a7 |
| PAGERDUTY_OAUTH_REDIRECT_URL | https://linear.app/connect/pagerduty/callback |
| SALESFORCE_OAUTH_REDIRECT_URL | https://linear.app/connect/salesforce/callback |
| SANITY_CHANGELOG_API_KEY | (empty) |
| SANITY_PROJECT_ID | ornj730p |
| SECURE_IMAGE_PROXY_URL | https://secure-img-proxy.linear.app |
| SENTRY_DIST | client |
| SENTRY_INTEGRATION_APP_NAME | linear |
| SENTRY_TUNNEL | https://s.linear.app/tunnel |
| SOCKET_SERVER_URL | wss://sync.linear.app |
| START_SERVICE_WORKER | true |
| UPLOAD_BUCKET_DOMAIN | https://uploads.linear.app |
| USER_NODE_ENV | production |
| ZENDESK_OAUTH_REDIRECT_URL | https://linear.app/connect/zendesk/callback |

## Routes declared in the client (119 unique)

- `/`
- `/${e}`
- `/1/dictionaries/*/settings`
- `/:org/:team/:id/active`
- `/:org/:team/:id/all`
- `/:org/:team/:id/backlog`
- `/:org/:team/:id/board`
- `/:org/document`
- `/:org/initiative/:slug`
- `/:org/initiative/:slug/overview`
- `/:org/issue`
- `/:org/project`
- `/:org/project/:projectId/requests`
- `/:org/project/:slug`
- `/:org/project/:slug/overview`
- `/:org/projects`
- `/:org/settings/initiative-labels`
- `/:org/settings/issue-labels`
- `/:org/settings/project-labels`
- `/:org/settings/teams/:teamKey/issue-labels`
- `/:org/settings/teams/:teamKey/project-labels`
- `/:org/team/:teamId`
- `/:org/team/:teamId/cycle`
- `/:org/team/:teamId/cycles`
- `/:org/update/:postId`
- `/:orgKey/agent-session/:agentSessionId`
- `/:orgKey/agent/:agentId`
- `/:orgKey/api`
- `/:orgKey/dashboard/:dashboardId`
- `/:orgKey/dashboards/new`
- `/:orgKey/developers`
- `/:orgKey/drafts/:draftId`
- `/:orgKey/explore`
- `/:orgKey/explore/issue/save?`
- `/:orgKey/explore/project/save?`
- `/:orgKey/inbox`
- `/:orgKey/inbox/:inboxTab?`
- `/:orgKey/initiative/:initiativeId/update/:initiativeUpdateId`
- `/:orgKey/issue/:issueId`
- `/:orgKey/join/:inviteHash`
- `/:orgKey/loop/:loopId`
- `/:orgKey/loop/:loopId/runs`
- `/:orgKey/my-issues`
- `/:orgKey/project`
- `/:orgKey/project/:projectId/update/:projectUpdateId`
- `/:orgKey/review/:reviewId`
- `/:orgKey/roadmap`
- `/:orgKey/roadmap/*`
- `/:orgKey/roadmaps`
- `/:orgKey/settings/customers`
- `/:orgKey/settings/customers/list`
- `/:orgKey/settings/workspace`
- `/:orgKey/team/:teamKey`
- `/:orgKey/team/:teamKey/:view`
- `/:orgKey/team/:teamKey/board`
- `/:orgKey/team/:teamKey/dashboards/new`
- `/:orgKey/team/:teamKey/update/:postId`
- `/:orgKey/welcome`
- `/add-account`
- `/auth/desktop`
- `/auth/desktop-email/:email/:token`
- `/auth/desktop-email/:email/:token/:clientAuthCode`
- `/auth/desktop-redirect`
- `/auth/desktop-saml/:email/:token`
- `/auth/email/:email/:token`
- `/auth/email/:email/:token/:clientAuthCode`
- `/auth/error`
- `/auth/google/callback`
- `/auth/redirect`
- `/auth/saml/:email/:token`
- `/auth/saml/:email/:token/:clientAuthCode`
- `/auth/web-email/:email/:token`
- `/auth/web-saml/:email/:token`
- `/connect/:service/callback`
- `/connect/discord/callback`
- `/connect/figma/callback`
- `/connect/figma/desktop-redirect`
- `/connect/front/callback`
- `/connect/github-account-code-access/callback`
- `/connect/github-account/callback`
- `/connect/github-code-access/`
- `/connect/github-code-access/:connectAction`
- `/connect/github-importer/callback`
- `/connect/github-init`
- `/connect/github/`
- `/connect/github/:connectAction`
- `/connect/gong/callback`
- `/connect/google/callback`
- `/connect/intercom/callback`
- `/connect/jira/callback`
- `/connect/launchdarkly/callback`
- `/connect/mcp/callback`
- `/connect/microsoft-teams/callback`
- `/connect/pagerduty/callback`
- `/connect/salesforce/callback`
- `/connect/sentry`
- `/connect/sentry/callback`
- `/connect/slack`
- `/connect/slack/customer/:customerId`
- `/connect/slack/post/:teamId`
- `/connect/zendesk/callback`
- `/developers`
- `/invite/:inviteId/accept`
- `/join`
- `/list`
- `/login`
- `/logout`
- `/mobile-auth`
- `/new`
- `/oauth/authorize`
- `/oauth/error`
- `/refresh`
- `/reset`
- `/signup`
- `/verify-email/:encodedEmail/code/:code`
- `FLOWCHART_HTML_LABELS_DEPRECATED`
- `LAZY_LOAD_DEPRECATED`
- `issue`
- `weekday`
