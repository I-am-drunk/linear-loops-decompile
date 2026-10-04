/**
 * Config-seam kernel — clean reimplementation of the two config chunks plus
 * boot's static-URL kernel (CONFIG-KERNEL claim, #225 2026-09-29; the merged
 * R-BOOT shard `docs/remap/sections/boot-config.md` §3 + B4 rows).
 *
 * Corpus evidence at vault `c44f2cf` (Linear v1.32.4):
 *   - `config.aM1_XCHx.js` (549 B raw): the injectable-config contract — a
 *     Proxy that throws until `injectConfig` is called (exports `t` = proxy,
 *     `n` = injectConfig). 50 importer chunks.
 *   - `config.Uz-QjVze.js` (pretty L104–190): the CONFIG table — 82 accessor
 *     keys (64 required `n()` / 18 optional `r()`) over `window.CLIENT_ENV`
 *     with a baked `VITE_*`-keyed production fallback table, plus derived
 *     members (`__RELEASE_INFO` block, `CLIENT_HOSTNAME`, `PREVIEW_*`,
 *     boolean coercions). 85 importer chunks.
 *   - `html.CjyPLfH8.js` (pretty L168–171): `window.__toStaticUrl = e =>
 *     ASSET_URL + e (+ '?' + CACHE_BUST when set)` — B4 in the boot spine.
 *
 * Load-bearing facts this module pins (verified in the goldens):
 *   1. CLIENT_ENV wins PER KEY via an `in` test (`window.CLIENT_ENV && e in
 *      window.CLIENT_ENV`), not by object presence: a key OMITTED from a
 *      deployment's CLIENT_ENV silently falls back to the baked value. Since
 *      all 64 required keys and 7 of the 18 optional keys carry baked
 *      first-party production values, a self-hosted deployment that wants a
 *      key EMPTY (e.g. `SENTRY_DSN` for the R-BOOT §4 telemetry self-disable)
 *      must ship the key EXPLICITLY (value `null`), not omit it.
 *   2. The required accessor's error path (`console.error("Environment
 *      variable ${key} is not defined")` then `''`) is DEAD CODE on 1.32.4
 *      with no CLIENT_ENV: every `n()` key has a baked fallback. It is
 *      reachable only through a CLIENT_ENV that explicitly maps a required
 *      key to `undefined` — and `null` passes THROUGH `n()` unflagged (the
 *      guard is `t === void 0`, so `null` is a defined value).
 *   3. The 11 optional keys with NO baked fallback (undefined in a bare
 *      browser): CACHE_BUST, COUNTRY_CODE, DEBUG_LOG_EXPAND_BATCH_LOAD,
 *      DEV_BRANCH, ENABLE_CRASH_REPORTING, LINCTL_CONTROL_PLANE_URL,
 *      OAUTH_CLIENT_URL, PREVIEW_BUILD, PREVIEW_BUILD_REVISION,
 *      PREVIEW_FEATURE_FLAGS, PREVIEW_PR_NUMBER.
 *
 * Original code. The baked FALLBACK VALUES themselves (Linear's production
 * endpoints and third-party OAuth client ids) are first-party deployment
 * data, deliberately NOT shipped here: our server supplies its own fallback
 * table (the R-SRV "CLIENT_ENV injection endpoint" row). The mechanism takes
 * the table as a parameter.
 */

/** Exact uninjected-read throw copy (`config.aM1_XCHx.js`). */
export const UNINJECTED_MESSAGE = `Config has not been injected. Call injectConfig() during client initialization.`;

/**
 * The injectable-config contract (`config.aM1_XCHx.js` verbatim behavior):
 * `config` is a proxy that throws `UNINJECTED_MESSAGE` on any property read
 * until `injectConfig(value)` is called, then forwards every read to the
 * injected object (missing keys read as `undefined`, exactly like the
 * corpus's `n[t]`).
 */
export function createInjectableConfig<T extends object>(): {
  config: T;
  injectConfig: (value: T) => void;
} {
  let injected: T | undefined;
  const config = new Proxy({} as T, {
    get(_target, key) {
      if (!injected) throw new Error(UNINJECTED_MESSAGE);
      return (injected as Record<PropertyKey, unknown>)[key];
    },
  });
  return { config, injectConfig: (value: T) => (injected = value) };
}

/** The environment sources the table reads (first-party: `window.CLIENT_ENV`,
 * `window.__RELEASE_INFO`, `self.document.URL`; ours: injected by the server's
 * CLIENT_ENV endpoint). `fallback` is keyed `VITE_<KEY>` exactly like the
 * corpus's baked table. */
export interface ConfigSources {
  clientEnv?: Record<string, unknown> | undefined;
  releaseInfo?:
    | { BUILD_REVISION?: unknown; DEPLOYED_AT?: unknown; SHORT_SHA?: unknown; PR_NUMBER?: unknown }
    | undefined;
  /** `self.document.URL` — only its host's `/pr-(\d+)/` match is consulted. */
  documentUrl: string;
  fallback?: Record<string, unknown> | undefined;
  /** `FLAG_CLIENT` (corpus: the Features chunk's client enum, `web` on this
   * build). */
  flagClient?: string;
}

/** Optional accessor `r(key)` (pretty L109): CLIENT_ENV wins per key via an
 * `in` test; otherwise the `VITE_`-prefixed fallback (missing ⇒ `undefined`). */
export function optionalEnv(sources: ConfigSources, key: string): unknown {
  const env = sources.clientEnv;
  if (env && key in env) return env[key];
  return (sources.fallback ?? {})[`VITE_` + key];
}

/** Required accessor `n(key)` (pretty L104): `optionalEnv`, but a strictly-
 * `undefined` result logs the exact corpus copy and yields `''`. `null`
 * passes through unflagged (the corpus guard is `t === void 0`). */
export function requiredEnv(sources: ConfigSources, key: string): unknown {
  const value = optionalEnv(sources, key);
  if (value === undefined) {
    console.error(`Environment variable ${key} is not defined`);
    return ``;
  }
  return value;
}

/** B4 (`html.CjyPLfH8.js`): `__toStaticUrl` — asset-path resolution every
 * `__vite__mapDeps` table in all 1,550 chunks routes through. `CACHE_BUST`
 * appends as a bare query string only when truthy. */
export function toStaticUrl(assetUrl: unknown, cacheBust: unknown, path: string): string {
  const base = `${assetUrl}${path}`;
  return cacheBust ? `${base}?${cacheBust}` : base;
}

/** The 82 accessor keys in corpus own-key order, with each key's accessor
 * kind — the transcription-rule DATA surface of the table (`config.Uz-QjVze.js`
 * pretty L12–102). Derived/computed members are built in `buildConfigTable`
 * in the same own-key positions. */
export const ACCESSOR_KEYS: ReadonlyArray<readonly [key: string, kind: `n` | `r`]> = [
  [`ALGOLIA_SEARCH_KEY`, `n`],
  [`API_SERVER_URL`, `n`],
  [`ASSET_URL`, `r`],
  [`CACHE_BUST`, `r`],
  [`CLIENT_URL`, `n`],
  [`OAUTH_CLIENT_URL`, `r`],
  [`ANALYTICS_URL`, `n`],
  [`CLOUDFLARE_TURNSTILE_SITEKEY`, `n`],
  [`DEMO_ORGANIZATION_ID`, `n`],
  [`DEMO_USER_EMAIL`, `n`],
  [`DEMO_USER_ID`, `n`],
  [`DEMO_USER_ACCOUNT_ID`, `n`],
  [`DISCORD_OAUTH_CLIENT_ID`, `n`],
  [`DISCORD_OAUTH_REDIRECT_URL`, `n`],
  [`EMAIL_INTAKE_HOSTNAME`, `n`],
  [`EMAIL_INTAKE_FROM_EMAIL`, `n`],
  [`FIGMA_OAUTH_CLIENT_ID`, `n`],
  [`FIGMA_OAUTH_REDIRECT_URL`, `n`],
  [`GITHUB_APP_URL`, `n`],
  [`GITHUB_IMPORTER_APP_URL`, `n`],
  [`GITHUB_CODE_ACCESS_APP_URL`, `n`],
  [`GITHUB_APP_OAUTH_REDIRECT_URL`, `n`],
  [`GITHUB_APP_OAUTH_CLIENT_ID`, `n`],
  [`GITHUB_CODE_ACCESS_APP_OAUTH_REDIRECT_URL`, `n`],
  [`GITHUB_CODE_ACCESS_APP_OAUTH_CLIENT_ID`, `n`],
  [`GITHUB_IMPORTER_INSTALL_URL`, `n`],
  [`GONG_OAUTH_CLIENT_ID`, `n`],
  [`GONG_OAUTH_REDIRECT_URL`, `n`],
  [`GOOGLE_OAUTH_CLIENT_ID`, `n`],
  [`GOOGLE_OAUTH_REDIRECT_URL`, `n`],
  [`GOOGLE_SHEETS_REDIRECT_URL`, `n`],
  [`GOOGLE_CALENDAR_REDIRECT_URL`, `n`],
  [`GRAPHQL_SERVER_HTTP`, `n`],
  [`INTERCOM_OAUTH_CLIENT_ID`, `n`],
  [`JIRA_OAUTH_CLIENT_ID`, `n`],
  [`JIRA_OAUTH_REDIRECT_URL`, `n`],
  [`LINEAR_DEMO_ORGANIZATION_ID`, `n`],
  [`NOTION_INTERNAL_OAUTH_CLIENT_ID`, `n`],
  [`FIGMA_INTERNAL_OAUTH_CLIENT_ID`, `n`],
  [`PAGERDUTY_OAUTH_CLIENT_ID`, `n`],
  [`PAGERDUTY_OAUTH_REDIRECT_URL`, `n`],
  [`LAUNCHDARKLY_OAUTH_CLIENT_ID`, `n`],
  [`LAUNCHDARKLY_OAUTH_REDIRECT_URL`, `n`],
  [`MCP_INTERNAL_OAUTH_CLIENT_ID`, `n`],
  [`MICROSOFT_TEAMS_CLIENT_ID`, `n`],
  [`PUSH_MESSAGE_VAPID_PUBLIC_KEY`, `n`],
  [`SANITY_PROJECT_ID`, `n`],
  [`SANITY_CHANGELOG_API_KEY`, `n`],
  [`SECURE_IMAGE_PROXY_URL`, `n`],
  [`SENTRY_DSN`, `r`],
  [`SENTRY_DIST`, `r`],
  [`SENTRY_TUNNEL`, `r`],
  [`SENTRY_INTEGRATION_APP_NAME`, `n`],
  [`SLACK_CLIENT_ID`, `n`],
  [`SLACK_STAGING_CLIENT_ID`, `n`],
  [`SLACK_INTAKE_APP_CLIENT_ID`, `n`],
  [`SOCKET_SERVER_URL`, `n`],
  [`STRIPE_PUBLIC_KEY`, `n`],
  [`ZENDESK_INTERNAL_OAUTH_CLIENT_ID`, `n`],
  [`ZENDESK_OAUTH_CLIENT_ID`, `n`],
  [`ZENDESK_OAUTH_REDIRECT_URL`, `n`],
  [`FRONT_INTERNAL_OAUTH_CLIENT_ID`, `n`],
  [`FRONT_OAUTH_CLIENT_ID`, `n`],
  [`FRONT_OAUTH_REDIRECT_URL`, `n`],
  [`PREVIEW_BUILD_REVISION`, `r`],
  [`PREVIEW_BUILD`, `r`],
  [`PREVIEW_PR_NUMBER`, `r`],
  [`PREVIEW_FEATURE_FLAGS`, `r`],
  [`POSTHOG_WRITE_KEY`, `n`],
  [`POSTHOG_SESSION_REPLAY_WRITE_KEY`, `r`],
  [`COUNTRY_CODE`, `r`],
  [`SALESFORCE_INTERNAL_OAUTH_CLIENT_ID`, `n`],
  [`SALESFORCE_OAUTH_CLIENT_ID`, `n`],
  [`SALESFORCE_OAUTH_REDIRECT_URL`, `n`],
  [`ASKS_WEB_FORMS_URL`, `n`],
  [`UPLOAD_BUCKET_DOMAIN`, `n`],
  [`DEV_BRANCH`, `r`],
  [`LINCTL_CONTROL_PLANE_URL`, `r`],
  [`ENABLE_CRASH_REPORTING`, `r`],
  [`IS_PRODUCTION_RUNTIME`, `r`],
  [`DEBUG_LOG_NETWORK_DATA`, `r`],
  [`DEBUG_LOG_EXPAND_BATCH_LOAD`, `r`],
] as const;

/**
 * Build the CONFIG table — a field-for-field reimplementation of
 * `config.Uz-QjVze.js`'s module-scope literal (pretty L12–102), including
 * own-key ORDER (the goldens compare `ownKeys` byte-for-byte). Every
 * derivation is verbatim behavior: `?? `/`||` distinctions, `=== 'true'`
 * boolean coercions, the `!!` coercion, the `/pr-(\d+)/` host fallback, and
 * the `__RELEASE_INFO` block (DEPLOYED_AT constructed as a Date only when
 * truthy).
 */
export function buildConfigTable(sources: ConfigSources): Record<string, unknown> {
  const n = (key: string): unknown => requiredEnv(sources, key);
  const r = (key: string): unknown => optionalEnv(sources, key);
  const releaseInfo = sources.releaseInfo;
  return {
    FLAG_CLIENT: sources.flagClient ?? `web`,
    ALGOLIA_SEARCH_KEY: n(`ALGOLIA_SEARCH_KEY`),
    API_SERVER_URL: n(`API_SERVER_URL`),
    ASSET_URL: r(`ASSET_URL`) ?? ``,
    CACHE_BUST: r(`CACHE_BUST`),
    CLIENT_URL: n(`CLIENT_URL`),
    OAUTH_CLIENT_URL: r(`OAUTH_CLIENT_URL`) ?? n(`CLIENT_URL`),
    CLIENT_HOSTNAME: new URL(n(`CLIENT_URL`) as string).hostname,
    ANALYTICS_URL: n(`ANALYTICS_URL`),
    CLOUDFLARE_TURNSTILE_SITEKEY: n(`CLOUDFLARE_TURNSTILE_SITEKEY`),
    DEMO_ORGANIZATION_ID: n(`DEMO_ORGANIZATION_ID`),
    DEMO_USER_EMAIL: n(`DEMO_USER_EMAIL`),
    DEMO_USER_ID: n(`DEMO_USER_ID`),
    DEMO_USER_ACCOUNT_ID: n(`DEMO_USER_ACCOUNT_ID`),
    DISCORD_OAUTH_CLIENT_ID: n(`DISCORD_OAUTH_CLIENT_ID`),
    DISCORD_OAUTH_REDIRECT_URL: n(`DISCORD_OAUTH_REDIRECT_URL`),
    EMAIL_INTAKE_HOSTNAME: n(`EMAIL_INTAKE_HOSTNAME`),
    EMAIL_INTAKE_FROM_EMAIL: n(`EMAIL_INTAKE_FROM_EMAIL`),
    FIGMA_OAUTH_CLIENT_ID: n(`FIGMA_OAUTH_CLIENT_ID`),
    FIGMA_OAUTH_REDIRECT_URL: n(`FIGMA_OAUTH_REDIRECT_URL`),
    GITHUB_APP_URL: n(`GITHUB_APP_URL`),
    GITHUB_IMPORTER_APP_URL: n(`GITHUB_IMPORTER_APP_URL`),
    GITHUB_CODE_ACCESS_APP_URL: n(`GITHUB_CODE_ACCESS_APP_URL`),
    GITHUB_APP_OAUTH_REDIRECT_URL: n(`GITHUB_APP_OAUTH_REDIRECT_URL`),
    GITHUB_APP_OAUTH_CLIENT_ID: n(`GITHUB_APP_OAUTH_CLIENT_ID`),
    GITHUB_CODE_ACCESS_APP_OAUTH_REDIRECT_URL: n(`GITHUB_CODE_ACCESS_APP_OAUTH_REDIRECT_URL`),
    GITHUB_CODE_ACCESS_APP_OAUTH_CLIENT_ID: n(`GITHUB_CODE_ACCESS_APP_OAUTH_CLIENT_ID`),
    GITHUB_IMPORTER_INSTALL_URL: n(`GITHUB_IMPORTER_INSTALL_URL`),
    GONG_OAUTH_CLIENT_ID: n(`GONG_OAUTH_CLIENT_ID`),
    GONG_OAUTH_REDIRECT_URL: n(`GONG_OAUTH_REDIRECT_URL`),
    GOOGLE_OAUTH_CLIENT_ID: n(`GOOGLE_OAUTH_CLIENT_ID`),
    GOOGLE_OAUTH_REDIRECT_URL: n(`GOOGLE_OAUTH_REDIRECT_URL`),
    GOOGLE_SHEETS_REDIRECT_URL: n(`GOOGLE_SHEETS_REDIRECT_URL`),
    GOOGLE_CALENDAR_REDIRECT_URL: n(`GOOGLE_CALENDAR_REDIRECT_URL`),
    GRAPHQL_SERVER_HTTP: n(`GRAPHQL_SERVER_HTTP`),
    INTERCOM_OAUTH_CLIENT_ID: n(`INTERCOM_OAUTH_CLIENT_ID`),
    JIRA_OAUTH_CLIENT_ID: n(`JIRA_OAUTH_CLIENT_ID`),
    JIRA_OAUTH_REDIRECT_URL: n(`JIRA_OAUTH_REDIRECT_URL`),
    LINEAR_DEMO_ORGANIZATION_ID: n(`LINEAR_DEMO_ORGANIZATION_ID`),
    NOTION_INTERNAL_OAUTH_CLIENT_ID: n(`NOTION_INTERNAL_OAUTH_CLIENT_ID`),
    FIGMA_INTERNAL_OAUTH_CLIENT_ID: n(`FIGMA_INTERNAL_OAUTH_CLIENT_ID`),
    PAGERDUTY_OAUTH_CLIENT_ID: n(`PAGERDUTY_OAUTH_CLIENT_ID`),
    PAGERDUTY_OAUTH_REDIRECT_URL: n(`PAGERDUTY_OAUTH_REDIRECT_URL`),
    LAUNCHDARKLY_OAUTH_CLIENT_ID: n(`LAUNCHDARKLY_OAUTH_CLIENT_ID`),
    LAUNCHDARKLY_OAUTH_REDIRECT_URL: n(`LAUNCHDARKLY_OAUTH_REDIRECT_URL`),
    MCP_INTERNAL_OAUTH_CLIENT_ID: n(`MCP_INTERNAL_OAUTH_CLIENT_ID`),
    MICROSOFT_TEAMS_CLIENT_ID: n(`MICROSOFT_TEAMS_CLIENT_ID`),
    PUSH_MESSAGE_VAPID_PUBLIC_KEY: n(`PUSH_MESSAGE_VAPID_PUBLIC_KEY`),
    SANITY_PROJECT_ID: n(`SANITY_PROJECT_ID`),
    SANITY_CHANGELOG_API_KEY: n(`SANITY_CHANGELOG_API_KEY`),
    SECURE_IMAGE_PROXY_URL: n(`SECURE_IMAGE_PROXY_URL`),
    SENTRY_DSN: r(`SENTRY_DSN`),
    SENTRY_DIST: r(`SENTRY_DIST`),
    SENTRY_TUNNEL: r(`SENTRY_TUNNEL`),
    SENTRY_INTEGRATION_APP_NAME: n(`SENTRY_INTEGRATION_APP_NAME`),
    SLACK_CLIENT_ID: n(`SLACK_CLIENT_ID`),
    SLACK_STAGING_CLIENT_ID: n(`SLACK_STAGING_CLIENT_ID`),
    SLACK_INTAKE_APP_CLIENT_ID: n(`SLACK_INTAKE_APP_CLIENT_ID`),
    SOCKET_SERVER_URL: n(`SOCKET_SERVER_URL`),
    STRIPE_PUBLIC_KEY: n(`STRIPE_PUBLIC_KEY`),
    ZENDESK_INTERNAL_OAUTH_CLIENT_ID: n(`ZENDESK_INTERNAL_OAUTH_CLIENT_ID`),
    ZENDESK_OAUTH_CLIENT_ID: n(`ZENDESK_OAUTH_CLIENT_ID`),
    ZENDESK_OAUTH_REDIRECT_URL: n(`ZENDESK_OAUTH_REDIRECT_URL`),
    FRONT_INTERNAL_OAUTH_CLIENT_ID: n(`FRONT_INTERNAL_OAUTH_CLIENT_ID`),
    FRONT_OAUTH_CLIENT_ID: n(`FRONT_OAUTH_CLIENT_ID`),
    FRONT_OAUTH_REDIRECT_URL: n(`FRONT_OAUTH_REDIRECT_URL`),
    BUILD_REVISION: releaseInfo?.BUILD_REVISION ?? r(`PREVIEW_BUILD_REVISION`),
    DEPLOYED_AT: releaseInfo?.DEPLOYED_AT ? new Date(releaseInfo.DEPLOYED_AT as string) : void 0,
    SHORT_SHA: releaseInfo?.SHORT_SHA,
    PR_NUMBER: releaseInfo?.PR_NUMBER,
    PREVIEW_BUILD: r(`PREVIEW_BUILD`) === `true`,
    PREVIEW_PR_NUMBER:
      (r(`PREVIEW_PR_NUMBER`) as string | undefined) ||
      new URL(sources.documentUrl).host.match(/pr-(\d+)/)?.[1],
    PREVIEW_FEATURE_FLAGS:
      (r(`PREVIEW_FEATURE_FLAGS`) as string | undefined)?.split(`,`).filter(Boolean) ?? [],
    POSTHOG_WRITE_KEY: n(`POSTHOG_WRITE_KEY`),
    POSTHOG_SESSION_REPLAY_WRITE_KEY: r(`POSTHOG_SESSION_REPLAY_WRITE_KEY`),
    COUNTRY_CODE: r(`COUNTRY_CODE`),
    SALESFORCE_INTERNAL_OAUTH_CLIENT_ID: n(`SALESFORCE_INTERNAL_OAUTH_CLIENT_ID`),
    SALESFORCE_OAUTH_CLIENT_ID: n(`SALESFORCE_OAUTH_CLIENT_ID`),
    SALESFORCE_OAUTH_REDIRECT_URL: n(`SALESFORCE_OAUTH_REDIRECT_URL`),
    ASKS_WEB_FORMS_URL: n(`ASKS_WEB_FORMS_URL`),
    UPLOAD_BUCKET_DOMAIN: n(`UPLOAD_BUCKET_DOMAIN`),
    DEV_BRANCH: r(`DEV_BRANCH`),
    LINCTL_CONTROL_PLANE_URL: r(`LINCTL_CONTROL_PLANE_URL`) ?? n(`API_SERVER_URL`),
    ENABLE_CRASH_REPORTING: !!r(`ENABLE_CRASH_REPORTING`),
    IS_PRODUCTION_BUILD: true,
    IS_DEVELOPMENT_BUILD: false,
    IS_TEST_ENV: false,
    IS_PRODUCTION_RUNTIME: r(`IS_PRODUCTION_RUNTIME`) === `true`,
    DEBUG_LOG_NETWORK_DATA: r(`DEBUG_LOG_NETWORK_DATA`) === `true`,
    DEBUG_LOG_EXPAND_BATCH_LOAD: r(`DEBUG_LOG_EXPAND_BATCH_LOAD`) === `true`,
  };
}
