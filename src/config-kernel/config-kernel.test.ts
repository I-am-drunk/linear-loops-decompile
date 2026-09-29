/**
 * Golden tests (G0 acceptance bar): the clean module's observable behavior,
 * projected through the SAME tagged-v2 grammar the corpus executions were
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver), must byte-match the committed corpus-executed goldens. Each test
 * replays its golden driver's fixtures line-for-line against OUR module.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  ACCESSOR_KEYS,
  buildConfigTable,
  createInjectableConfig,
  optionalEnv,
  requiredEnv,
  toStaticUrl,
  UNINJECTED_MESSAGE,
  type ConfigSources,
} from "./config.ts";

const golden = (name: string): { provenance: { serializer: string }; output: unknown } =>
  JSON.parse(readFileSync(join(import.meta.dirname, `golden`, name), `utf8`)) as {
    provenance: { serializer: string };
    output: unknown;
  };

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

const contractGolden = golden(`config-contract.case.expected.json`);
const tableGolden = golden(`config-table.case.expected.json`);
const bustGolden = golden(`boot-static-url.bust.case.expected.json`);

test(`golden serializer versions match the one this test projects with`, () => {
  for (const g of [contractGolden, tableGolden, bustGolden]) {
    assert.equal(g.provenance.serializer, SERIALIZER_VERSION);
  }
});

test(`injectable-config contract byte-matches the corpus-executed golden`, () => {
  const { config, injectConfig } = createInjectableConfig<Record<string, unknown>>();

  let uninjectedThrow: string | null = null;
  try {
    void (config as Record<string, unknown>)[`CLIENT_URL`];
  } catch (error) {
    uninjectedThrow = error instanceof Error ? error.message : String(error);
  }
  assert.equal(uninjectedThrow, UNINJECTED_MESSAGE);

  injectConfig({ CLIENT_URL: `https://first.example.test`, COUNT: 3 });
  const injectedRead = config[`CLIENT_URL`];
  const injectedNumber = config[`COUNT`];
  const missingKeyRead = config[`NOT_A_KEY`];

  injectConfig({ CLIENT_URL: `https://second.example.test` });
  const reinjectedRead = config[`CLIENT_URL`];
  const replacedKeyRead = config[`COUNT`];

  const ours = serialize({
    uninjectedThrow,
    injectedRead,
    injectedNumber,
    missingKeyRead,
    reinjectedRead,
    replacedKeyRead,
  });
  assert.equal(bytes(ours), bytes(contractGolden.output));
});

/** The golden fixture world, mirrored from golden/world-env-stub.mjs
 * line-for-line (same keys, same values, same omissions). */
function goldenSources(): { sources: ConfigSources; errors: string[] } {
  const K = (key: string, value: unknown): [string, unknown] => [key, value];
  const clientEnv = Object.fromEntries([
    K(`ALGOLIA_SEARCH_KEY`, `env-algolia`),
    K(`API_SERVER_URL`, `https://api.example.test`),
    K(`CACHE_BUST`, `cb-123`),
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
    K(`SANITY_PROJECT_ID`, null),
    K(`SANITY_CHANGELOG_API_KEY`, undefined),
    K(`SECURE_IMAGE_PROXY_URL`, `https://imgproxy.example.test`),
    K(`SENTRY_DSN`, null),
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
    K(`PREVIEW_PR_NUMBER`, ``),
    K(`PREVIEW_FEATURE_FLAGS`, `alpha,,beta`),
    K(`POSTHOG_WRITE_KEY`, `env-posthog`),
    K(`POSTHOG_SESSION_REPLAY_WRITE_KEY`, `env-posthog-replay`),
    K(`COUNTRY_CODE`, `DE`),
    K(`SALESFORCE_INTERNAL_OAUTH_CLIENT_ID`, `env-sf-internal-id`),
    K(`SALESFORCE_OAUTH_CLIENT_ID`, `env-sf-id`),
    K(`SALESFORCE_OAUTH_REDIRECT_URL`, `https://cb.example.test/sf`),
    K(`ASKS_WEB_FORMS_URL`, `https://asks.example.test`),
    K(`UPLOAD_BUCKET_DOMAIN`, `https://uploads.example.test`),
    K(`LINCTL_CONTROL_PLANE_URL`, `https://linctl.example.test`),
    K(`ENABLE_CRASH_REPORTING`, ``),
    K(`IS_PRODUCTION_RUNTIME`, `true`),
    K(`DEBUG_LOG_NETWORK_DATA`, `false`),
    K(`DEBUG_LOG_EXPAND_BATCH_LOAD`, `TRUE`),
  ]);
  // The two baked fallbacks the golden fixture exercises: the corpus's own
  // published production values for the two omitted keys (already public in
  // the golden; the full baked table is first-party deployment data our
  // module takes as a parameter and does not ship).
  const fallback = {
    VITE_ASSET_URL: `https://static.linear.app/client/`,
    VITE_CLIENT_URL: `https://linear.app`,
  };
  const errors: string[] = [];
  const realError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(` `));
  };
  try {
    return {
      sources: {
        clientEnv,
        releaseInfo: {
          BUILD_REVISION: `rel-rev-9`,
          DEPLOYED_AT: `2026-09-29T12:00:00.000Z`,
          SHORT_SHA: `abc1234`,
          PR_NUMBER: `77`,
        },
        documentUrl: `https://pr-4242.preview.example.test/settings`,
        fallback,
        flagClient: `web`,
      },
      errors,
    };
  } finally {
    console.error = realError;
  }
}

test(`CONFIG table byte-matches the corpus-executed golden (ownKeys + values + degraded copy)`, () => {
  const { sources } = goldenSources();
  const errors: string[] = [];
  const realError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(` `));
  };
  let table: Record<string, unknown>;
  try {
    table = buildConfigTable(sources);
  } finally {
    console.error = realError;
  }
  const ours = serialize({ ownKeys: Object.keys(table), table, consoleErrors: errors });
  assert.equal(bytes(ours), bytes(tableGolden.output));
});

test(`toStaticUrl matches both golden branches (the B4 pair)`, () => {
  // bust world (golden: boot-static-url.bust)
  assert.equal(
    toStaticUrl(`https://assets.example.test/client/`, `bust-7`, `assets/entry.X.js`),
    `https://assets.example.test/client/assets/entry.X.js?bust-7`,
  );
  assert.equal(
    toStaticUrl(`https://assets.example.test/client/`, `bust-7`, ``),
    `https://assets.example.test/client/?bust-7`,
  );
  // nobust world (golden: boot-static-url.nobust) — undefined CACHE_BUST
  assert.equal(
    toStaticUrl(`https://assets.example.test/client/`, undefined, `assets/entry.X.js`),
    `https://assets.example.test/client/assets/entry.X.js`,
  );
});

test(`accessor semantics: per-key 'in' wins, strict-undefined guard, null passthrough`, () => {
  const sources: ConfigSources = {
    clientEnv: { A: `env-a`, B: undefined, C: null },
    documentUrl: `https://x.example.test/`,
    fallback: { VITE_A: `baked-a`, VITE_B: `baked-b`, VITE_D: `baked-d` },
  };
  // 'in' hit wins even over a baked value
  assert.equal(optionalEnv(sources, `A`), `env-a`);
  // 'in' hit with undefined does NOT fall back (the corpus `in` test)
  assert.equal(optionalEnv(sources, `B`), undefined);
  // null is a defined value: passes required unflagged
  assert.equal(requiredEnv(sources, `C`), null);
  // 'in' miss -> VITE_ fallback
  assert.equal(optionalEnv(sources, `D`), `baked-d`);
  // both-miss: optional undefined; required logs the exact copy then ''
  assert.equal(optionalEnv(sources, `E`), undefined);
  const errors: string[] = [];
  const realError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(` `));
  };
  try {
    assert.equal(requiredEnv(sources, `E`), ``);
  } finally {
    console.error = realError;
  }
  assert.deepEqual(errors, [`Environment variable E is not defined`]);
});

test(`ACCESSOR_KEYS census: 82 keys, 64 required / 18 optional, no duplicates`, () => {
  assert.equal(ACCESSOR_KEYS.length, 82);
  assert.equal(ACCESSOR_KEYS.filter(([, kind]) => kind === `n`).length, 64);
  assert.equal(ACCESSOR_KEYS.filter(([, kind]) => kind === `r`).length, 18);
  assert.equal(new Set(ACCESSOR_KEYS.map(([key]) => key)).size, 82);
  // every accessor key appears in the built table (own keys), in order
  const { sources } = goldenSources();
  const errors: string[] = [];
  const realError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(` `));
  };
  let table: Record<string, unknown>;
  try {
    table = buildConfigTable(sources);
  } finally {
    console.error = realError;
  }
  const own = Object.keys(table);
  // PREVIEW_BUILD_REVISION is the one accessed key that is NOT an own table
  // key: it only feeds the BUILD_REVISION derivation (corpus pretty L79).
  const ownAccessorKeys = ACCESSOR_KEYS.filter(([key]) => key !== `PREVIEW_BUILD_REVISION`);
  const positions = ownAccessorKeys.map(([key]) => own.indexOf(key));
  assert.ok(positions.every((p) => p >= 0), `every accessor key except PREVIEW_BUILD_REVISION is an own key`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `accessor keys keep corpus order`);
  assert.equal(own.indexOf(`PREVIEW_BUILD_REVISION`), -1);
  assert.equal(
    own.length,
    90,
    `81 own accessor keys + FLAG_CLIENT + CLIENT_HOSTNAME + the 4 release members + 3 IS_* constants`,
  );
});
