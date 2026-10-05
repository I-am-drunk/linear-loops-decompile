/**
 * Linear sign-in (IG2, docs/plan/integrations.md).
 *
 * Built from Linear's public OAuth docs, digested at
 * extracts/linear-official/docs-site/oauth.md. Two ways in:
 *
 *   OAuth2 — authorize URL, code exchange, refresh. Public tokens expire in
 *            24h and come with a refresh_token, so refresh is REQUIRED, not
 *            optional; this module decides when.
 *   PAT    — a personal access token for a single-user deployment. No
 *            expiry we can see, no refresh.
 *
 * Tokens are write-only. The record carries presence, kind, expiry and a
 * masked hint — never the value. The value lives in the store the server
 * owns, behind `TokenStore`, injected. Fetch is injected too, so every path
 * is testable without a network.
 */

import type { IntegrationAuth, IntegrationStatus } from "../integrations/types.ts";

/** What the UI may see about a stored token. No field can carry the secret. */
export type TokenRecord = {
  kind: `oauth2` | `pat`;
  /** ISO-8601; absent for a PAT, which has no expiry we can see. */
  expiresAt?: string;
  /** Last four characters, for recognition only. */
  hint: string;
  scopes: readonly string[];
};

/** The server's secret store. The adapter never holds a token in a field. */
export type TokenStore = {
  get(): Promise<{ accessToken: string; refreshToken?: string; record: TokenRecord } | undefined>;
  set(accessToken: string, record: TokenRecord, refreshToken?: string): Promise<void>;
  clear(): Promise<void>;
};

export type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: readonly string[];
  /** `user` (default) or `app`. `app` CANNOT request `admin` (oauth.md). */
  actor?: `user` | `app`;
};

/** Public endpoints, from oauth.md. Overridable only for tests. */
export const LINEAR_OAUTH = {
  authorize: `https://linear.app/oauth/authorize`,
  token: `https://api.linear.app/oauth/token`,
  revoke: `https://api.linear.app/oauth/revoke`,
} as const;

/**
 * The URL to send the user to. `state` is recommended by oauth.md and
 * required here: a sign-in flow with no state is open to login CSRF, and
 * making it optional invites the omission. `prompt=consent` is always sent
 * so a re-authorization with different scopes actually re-prompts.
 */
export function authorizeUrl(cfg: OAuthConfig, state: string): string {
  if (state.trim() === ``) throw new Error(`linear-auth: state is required`);
  if (cfg.actor === `app` && cfg.scopes.includes(`admin`)) {
    throw new Error(`linear-auth: actor=app cannot request admin (oauth.md)`);
  }
  const u = new URL(LINEAR_OAUTH.authorize);
  u.searchParams.set(`client_id`, cfg.clientId);
  u.searchParams.set(`redirect_uri`, cfg.redirectUri);
  u.searchParams.set(`response_type`, `code`);
  u.searchParams.set(`scope`, cfg.scopes.join(`,`)); // comma-separated, per oauth.md
  u.searchParams.set(`state`, state);
  u.searchParams.set(`prompt`, `consent`);
  u.searchParams.set(`actor`, cfg.actor ?? `user`);
  return u.toString();
}

type TokenResponse = { accessToken: string; refreshToken?: string; expiresIn?: number; scopes: string[] };

/** Parse /oauth/token. Pre-Dec-2023 apps return `scope` as an array (oauth.md). */
function parseTokenResponse(text: string): TokenResponse | undefined {
  let j: unknown;
  try { j = JSON.parse(text); } catch { return undefined; }
  if (!j || typeof j !== `object`) return undefined;
  const r = j as Record<string, unknown>;
  if (typeof r[`access_token`] !== `string`) return undefined;
  const scope = r[`scope`];
  const scopes = Array.isArray(scope) ? scope.filter((s): s is string => typeof s === `string`)
    : typeof scope === `string` ? scope.split(/[\s,]+/).filter(Boolean) : [];
  return {
    accessToken: r[`access_token`] as string,
    ...(typeof r[`refresh_token`] === `string` ? { refreshToken: r[`refresh_token`] as string } : {}),
    ...(typeof r[`expires_in`] === `number` ? { expiresIn: r[`expires_in`] as number } : {}),
    scopes,
  };
}

/** Build the UI-visible record from a response. The value never enters it. */
function recordFor(kind: TokenRecord[`kind`], r: TokenResponse, now: () => number): TokenRecord {
  return {
    kind,
    hint: `…${r.accessToken.slice(-4)}`,
    scopes: r.scopes,
    ...(r.expiresIn === undefined ? {} : { expiresAt: new Date(now() + r.expiresIn * 1000).toISOString() }),
  };
}

/** Form-encoded POST to the token endpoint. Body is NOT JSON (oauth.md). */
async function postForm(fetchImpl: FetchLike, url: string, fields: Record<string, string>):
  Promise<{ ok: true; text: string } | { ok: false; status: number; text: string }> {
  const body = new URLSearchParams(fields).toString();
  const res = await fetchImpl(url, {
    method: `POST`,
    headers: { "content-type": `application/x-www-form-urlencoded` },
    body,
  });
  const text = await res.text();
  return res.ok ? { ok: true, text } : { ok: false, status: res.status, text };
}

export type AuthResult = { ok: true; record: TokenRecord } | { ok: false; detail: string };

export function makeLinearAuth(
  cfg: OAuthConfig,
  store: TokenStore,
  fetchImpl: FetchLike,
  now: () => number = () => Date.now(),
  endpoints: typeof LINEAR_OAUTH = LINEAR_OAUTH,
) {
  /** Exchange an authorization code. `grant_type=authorization_code`, form-encoded. */
  async function exchangeCode(code: string): Promise<AuthResult> {
    const res = await postForm(fetchImpl, endpoints.token, {
      code, redirect_uri: cfg.redirectUri, client_id: cfg.clientId,
      client_secret: cfg.clientSecret, grant_type: `authorization_code`,
    });
    if (!res.ok) return { ok: false, detail: `token exchange HTTP ${res.status}` };
    const t = parseTokenResponse(res.text);
    if (!t) return { ok: false, detail: `token exchange returned no access_token` };
    const record = recordFor(`oauth2`, t, now);
    await store.set(t.accessToken, record, t.refreshToken);
    return { ok: true, record };
  }

  /**
   * Refresh. Required, not optional: public tokens expire in 24h. Auth is
   * Basic base64(client_id:client_secret) per oauth.md. A 400/401 here means
   * the refresh token itself is dead, so the stored token is cleared rather
   * than left looking configured — the UI must show "reconnect".
   */
  async function refresh(): Promise<AuthResult> {
    const cur = await store.get();
    if (!cur?.refreshToken) return { ok: false, detail: `no refresh token stored` };
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString(`base64`);
    const body = new URLSearchParams({ grant_type: `refresh_token`, refresh_token: cur.refreshToken }).toString();
    const res = await fetchImpl(endpoints.token, {
      method: `POST`,
      headers: { "content-type": `application/x-www-form-urlencoded`, authorization: `Basic ${basic}` },
      body,
    });
    const text = await res.text();
    if (res.status === 400 || res.status === 401) {
      await store.clear();
      return { ok: false, detail: `refresh token rejected (HTTP ${res.status}); reconnect required` };
    }
    if (!res.ok) return { ok: false, detail: `refresh HTTP ${res.status}` };
    const t = parseTokenResponse(text);
    if (!t) return { ok: false, detail: `refresh returned no access_token` };
    const record = recordFor(`oauth2`, t, now);
    // A refresh response may omit refresh_token; keep the old one then.
    await store.set(t.accessToken, record, t.refreshToken ?? cur.refreshToken);
    return { ok: true, record };
  }

  /**
   * PAT: the single-user alternative. No expiry we can see, no refresh. The
   * only validation here is shape; whether it WORKS is `reachable()`'s job
   * on the GraphQL client, since a PAT that is well-formed but revoked is
   * indistinguishable until used.
   */
  async function setPat(token: string, scopes: readonly string[] = []): Promise<AuthResult> {
    const t = token.trim();
    if (t.length < 8) return { ok: false, detail: `token too short to be a PAT` };
    const record: TokenRecord = { kind: `pat`, hint: `…${t.slice(-4)}`, scopes: [...scopes] };
    await store.set(t, record);
    return { ok: true, record };
  }

  /** Refresh when under this margin. 30 min matches oauth.md's grace window. */
  const REFRESH_MARGIN_MS = 30 * 60 * 1000;

  function needsRefresh(record: TokenRecord): boolean {
    if (record.kind !== `oauth2` || !record.expiresAt) return false;
    return Date.parse(record.expiresAt) - now() <= REFRESH_MARGIN_MS;
  }

  /**
   * Status for the settings row. `checking` is the honest state before any
   * probe has run; only a MISSING token is `disconnected`. Whether a present
   * token works is the GraphQL client's finding, not this module's.
   */
  async function status(): Promise<IntegrationStatus> {
    const cur = await store.get();
    if (!cur) return { state: `disconnected` };
    if (needsRefresh(cur.record)) {
      const r = await refresh();
      if (!r.ok) return { state: `error`, detail: r.detail };
    }
    return { state: `checking` };
  }

  /** The UI-visible record, or undefined when nothing is stored. */
  const record = async (): Promise<TokenRecord | undefined> => (await store.get())?.record;

  const auth: IntegrationAuth = { kind: `oauth2`, scopes: cfg.scopes };

  return { authorizeUrl: (state: string) => authorizeUrl(cfg, state), exchangeCode, refresh, setPat,
    needsRefresh, status, record, auth, signOut: () => store.clear() };
}
