// Stub for Features.CzCTqIRs.js in the table-env case — the fixture seam.
//
// Why this seam: `config.Uz-QjVze.js` reads `window.CLIENT_ENV`,
// `window.__RELEASE_INFO`, and `self.document.URL` at MODULE EVAL, so the
// fixture world must exist before its body runs. Its single static import is
// the Features chunk, and ESM executes imports before the importer's body —
// stubbing Features is the one seam that installs the world in time without
// touching the subject chunk. Cost: the real Features chunk does not execute;
// its one consumed export (`r`, the client enum — `d = {web, ios, android}`
// at pretty L1054, exported `d as r` L1115) is pinned VERBATIM from the raw
// source here, and `FLAG_CLIENT: e.web` therefore flows from pinned corpus
// data rather than live execution (declared, G12 precedent).
//
// The fixture CLIENT_ENV maps all 82 accessor keys EXCEPT:
//   - ASSET_URL, CLIENT_URL — omitted, so the golden pins the baked-fallback
//     mechanism per key (`e in window.CLIENT_ENV` miss ⇒ `VITE_`-prefixed
//     baked table) through two benign, already-published values
//     (`https://static.linear.app/client/`, `https://linear.app`) and the
//     `CLIENT_HOSTNAME = new URL(n(CLIENT_URL)).hostname` derivation.
//   - SANITY_CHANGELOG_API_KEY — mapped to `undefined` EXPLICITLY, so the
//     required accessor's degraded path (console.error + `''`) executes: the
//     `in` test passes, `t === void 0` fires. The driver captures the copy.
//   - SANITY_PROJECT_ID — mapped to `null`, pinning that null is a DEFINED
//     value to `n()` (the guard is strict-undefined) and passes through.
// __RELEASE_INFO is present (both branches of every `?.` chain in the
// release block take the defined side; DEPLOYED_AT constructs a real Date).

globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = { URL: `https://pr-4242.preview.example.test/settings` };

// Capture the required accessor's degraded-path copy: the table computes at
// the ENTRY's module eval (before any driver runs), so the recorder must be
// installed here — this stub executes first (ESM import order). Recorded
// calls are projected by the driver; console keeps working normally.
{
  const realError = console.error.bind(console);
  globalThis.__consoleErrors = [];
  console.error = (...args) => {
    globalThis.__consoleErrors.push(args.map(String).join(` `));
    realError(...args);
  };
}

const K = (key, value) => [key, value];
globalThis.window.CLIENT_ENV = Object.fromEntries([
  K(`ALGOLIA_SEARCH_KEY`, `env-algolia`),
  K(`API_SERVER_URL`, `https://api.example.test`),
  // ASSET_URL omitted -> baked fallback
  K(`CACHE_BUST`, `cb-123`),
  // CLIENT_URL omitted -> baked fallback (feeds CLIENT_HOSTNAME)
  K(`OAUTH_CLIENT_URL`, `https://oauth.example.test`),
  K(`ANALYTICS_URL`, `https://analytics.example.test`),
  K(`CLOUDFLARE_TURNSTILE_SITEKEY`, `env-turnstile`),
  K(`DEMO_ORGANIZATION_ID`, `env-demo-org`),
  K(`DEMO_USER_EMAIL`, `demo@example.test`),
  K(`DEMO_USER_ID`, `env-demo-user`),
  K(`DEMO_USER_ACCOUNT_ID`, `env-demo-account`),
  K(`DISCORD_OAUTH_CLIENT_ID`, `env-discord-id`),
  K(`DISCORD_OAUTH_REDIRECT_URL`, `https://cb.example.test/discord`),
  K(`EMAIL_INTAKE_HOSTNAME`, `intake.example.test`),
  K(`EMAIL_INTAKE_FROM_EMAIL`, `issues@example.test`),
  K(`FIGMA_OAUTH_CLIENT_ID`, `env-figma-id`),
  K(`FIGMA_OAUTH_REDIRECT_URL`, `https://cb.example.test/figma`),
  K(`GITHUB_APP_URL`, `https://github.example.test/app`),
  K(`GITHUB_IMPORTER_APP_URL`, `https://github.example.test/importer`),
  K(`GITHUB_CODE_ACCESS_APP_URL`, `https://github.example.test/code`),
  K(`GITHUB_APP_OAUTH_REDIRECT_URL`, `https://cb.example.test/gh`),
  K(`GITHUB_APP_OAUTH_CLIENT_ID`, `env-gh-id`),
  K(`GITHUB_CODE_ACCESS_APP_OAUTH_REDIRECT_URL`, `https://cb.example.test/ghca`),
  K(`GITHUB_CODE_ACCESS_APP_OAUTH_CLIENT_ID`, `env-ghca-id`),
  K(`GITHUB_IMPORTER_INSTALL_URL`, `https://github.example.test/install`),
  K(`GONG_OAUTH_CLIENT_ID`, `env-gong-id`),
  K(`GONG_OAUTH_REDIRECT_URL`, `https://cb.example.test/gong`),
  K(`GOOGLE_OAUTH_CLIENT_ID`, `env-google-id`),
  K(`GOOGLE_OAUTH_REDIRECT_URL`, `https://cb.example.test/google`),
  K(`GOOGLE_SHEETS_REDIRECT_URL`, `https://cb.example.test/sheets`),
  K(`GOOGLE_CALENDAR_REDIRECT_URL`, `https://cb.example.test/calendar`),
  K(`GRAPHQL_SERVER_HTTP`, `https://gql.example.test`),
  K(`INTERCOM_OAUTH_CLIENT_ID`, `env-intercom-id`),
  K(`JIRA_OAUTH_CLIENT_ID`, `env-jira-id`),
  K(`JIRA_OAUTH_REDIRECT_URL`, `https://cb.example.test/jira`),
  K(`LINEAR_DEMO_ORGANIZATION_ID`, `env-linear-demo-org`),
  K(`NOTION_INTERNAL_OAUTH_CLIENT_ID`, `env-notion-id`),
  K(`FIGMA_INTERNAL_OAUTH_CLIENT_ID`, `env-figma-internal-id`),
  K(`PAGERDUTY_OAUTH_CLIENT_ID`, `env-pd-id`),
  K(`PAGERDUTY_OAUTH_REDIRECT_URL`, `https://cb.example.test/pd`),
  K(`LAUNCHDARKLY_OAUTH_CLIENT_ID`, `env-ld-id`),
  K(`LAUNCHDARKLY_OAUTH_REDIRECT_URL`, `https://cb.example.test/ld`),
  K(`MCP_INTERNAL_OAUTH_CLIENT_ID`, `env-mcp-id`),
  K(`MICROSOFT_TEAMS_CLIENT_ID`, `env-teams-id`),
  K(`PUSH_MESSAGE_VAPID_PUBLIC_KEY`, `env-vapid`),
  K(`SANITY_PROJECT_ID`, null), // null is DEFINED to n(): passes through unflagged
  K(`SANITY_CHANGELOG_API_KEY`, undefined), // `in` hit + undefined: the n() error path
  K(`SECURE_IMAGE_PROXY_URL`, `https://imgproxy.example.test`),
  K(`SENTRY_DSN`, null), // the R-BOOT §4 telemetry self-disable shape: explicit null
  K(`SENTRY_DIST`, `env-sentry-dist`),
  K(`SENTRY_TUNNEL`, null),
  K(`SENTRY_INTEGRATION_APP_NAME`, `env-sentry-app`),
  K(`SLACK_CLIENT_ID`, `env-slack-id`),
  K(`SLACK_STAGING_CLIENT_ID`, `env-slack-staging-id`),
  K(`SLACK_INTAKE_APP_CLIENT_ID`, `env-slack-intake-id`),
  K(`SOCKET_SERVER_URL`, `wss://sync.example.test`),
  K(`STRIPE_PUBLIC_KEY`, `env-stripe-pk`),
  K(`ZENDESK_INTERNAL_OAUTH_CLIENT_ID`, `env-zd-internal-id`),
  K(`ZENDESK_OAUTH_CLIENT_ID`, `env-zd-id`),
  K(`ZENDESK_OAUTH_REDIRECT_URL`, `https://cb.example.test/zd`),
  K(`FRONT_INTERNAL_OAUTH_CLIENT_ID`, `env-front-internal-id`),
  K(`FRONT_OAUTH_CLIENT_ID`, `env-front-id`),
  K(`FRONT_OAUTH_REDIRECT_URL`, `https://cb.example.test/front`),
  K(`PREVIEW_BUILD_REVISION`, `env-preview-rev`),
  K(`PREVIEW_BUILD`, `true`),
  // empty string: FALSY, so the `||` (not `??`) falls through to the
  // document-URL host regex /pr-(\d+)/ — pinning both the operator choice
  // and the regex against the pr-4242 fixture host.
  K(`PREVIEW_PR_NUMBER`, ``),
  K(`PREVIEW_FEATURE_FLAGS`, `alpha,,beta`), // the .filter(Boolean) drops the empty
  K(`POSTHOG_WRITE_KEY`, `env-posthog`),
  K(`POSTHOG_SESSION_REPLAY_WRITE_KEY`, `env-posthog-replay`),
  K(`COUNTRY_CODE`, `DE`),
  K(`SALESFORCE_INTERNAL_OAUTH_CLIENT_ID`, `env-sf-internal-id`),
  K(`SALESFORCE_OAUTH_CLIENT_ID`, `env-sf-id`),
  K(`SALESFORCE_OAUTH_REDIRECT_URL`, `https://cb.example.test/sf`),
  K(`ASKS_WEB_FORMS_URL`, `https://asks.example.test`),
  K(`UPLOAD_BUCKET_DOMAIN`, `https://uploads.example.test`),
  // DEV_BRANCH omitted entirely: an `in` MISS on an optional key with NO
  // baked `VITE_DEV_BRANCH` entry — the both-miss ⇒ `undefined` path of r().
  // (The both-miss path of n() is unreachable on 1.32.4: all 64 required
  // keys carry baked fallbacks — header fact 2.)
  K(`LINCTL_CONTROL_PLANE_URL`, `https://linctl.example.test`),
  K(`ENABLE_CRASH_REPORTING`, ``), // falsy string: !! coerces false
  K(`IS_PRODUCTION_RUNTIME`, `true`),
  K(`DEBUG_LOG_NETWORK_DATA`, `false`), // 'false' !== 'true' -> false
  K(`DEBUG_LOG_EXPAND_BATCH_LOAD`, `TRUE`), // case-sensitive compare -> false
]);

globalThis.window.__RELEASE_INFO = {
  BUILD_REVISION: `rel-rev-9`,
  DEPLOYED_AT: `2026-09-29T12:00:00.000Z`,
  SHORT_SHA: `abc1234`,
  PR_NUMBER: `77`,
};

// Pinned verbatim from raw Features.CzCTqIRs.js (`d = {web:`web`, ios:`ios`,
// android:`android`}`, exported `d as r`).
export const r = { web: `web`, ios: `ios`, android: `android` };
