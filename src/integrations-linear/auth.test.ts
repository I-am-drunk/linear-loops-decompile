/** IG2: Linear sign-in — authorize URL, exchange, refresh, PAT. No network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeUrl, LINEAR_OAUTH, makeLinearAuth, type FetchLike, type OAuthConfig, type TokenRecord, type TokenStore } from "./auth.ts";

const CFG: OAuthConfig = { clientId: `cid`, clientSecret: `shh`, redirectUri: `https://app.example/cb`, scopes: [`read`, `write`] };

/** In-memory store that records every write, so tests can see the secret path. */
function memStore() {
  let cur: { accessToken: string; refreshToken?: string; record: TokenRecord } | undefined;
  const writes: string[] = [];
  const store: TokenStore = {
    async get() { return cur; },
    async set(accessToken, record, refreshToken) { writes.push(accessToken); cur = { accessToken, record, ...(refreshToken ? { refreshToken } : {}) }; },
    async clear() { cur = undefined; },
  };
  return { store, writes, current: () => cur };
}

/** A fetch that records (url, headers, body) and replays one scripted response. */
function stub(res: { ok?: boolean; status?: number; body?: string }) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, headers: init?.headers ?? {}, body: init?.body ?? `` });
    return { ok: res.ok ?? true, status: res.status ?? 200, text: async () => res.body ?? `{}` };
  };
  return { fetchImpl, calls };
}

const FIXED_NOW = Date.parse(`2026-10-05T12:00:00Z`);

test(`authorizeUrl carries every oauth.md parameter, scopes comma-separated`, () => {
  const u = new URL(authorizeUrl(CFG, `st4t3`));
  assert.equal(`${u.origin}${u.pathname}`, LINEAR_OAUTH.authorize);
  assert.equal(u.searchParams.get(`client_id`), `cid`);
  assert.equal(u.searchParams.get(`redirect_uri`), `https://app.example/cb`);
  assert.equal(u.searchParams.get(`response_type`), `code`);
  assert.equal(u.searchParams.get(`scope`), `read,write`, `comma-separated, per oauth.md`);
  assert.equal(u.searchParams.get(`state`), `st4t3`);
  assert.equal(u.searchParams.get(`prompt`), `consent`);
  assert.equal(u.searchParams.get(`actor`), `user`);
});

test(`state is REQUIRED — a sign-in flow without it is open to login CSRF`, () => {
  assert.throws(() => authorizeUrl(CFG, ``), /state is required/);
  assert.throws(() => authorizeUrl(CFG, `   `), /state is required/);
});

test(`actor=app cannot request admin (oauth.md)`, () => {
  assert.throws(() => authorizeUrl({ ...CFG, actor: `app`, scopes: [`read`, `admin`] }, `s`), /cannot request admin/);
  assert.doesNotThrow(() => authorizeUrl({ ...CFG, actor: `app`, scopes: [`read`] }, `s`));
});

const TOKEN_OK = JSON.stringify({ access_token: `lin_access_ABCD1234`, refresh_token: `lin_refresh_x`, expires_in: 86399, scope: `read,write` });

test(`exchangeCode POSTs form-encoded (NOT JSON) with grant_type=authorization_code`, async () => {
  const s = stub({ body: TOKEN_OK });
  const m = memStore();
  const r = await makeLinearAuth(CFG, m.store, s.fetchImpl, () => FIXED_NOW).exchangeCode(`c0de`);
  assert.ok(r.ok);
  const call = s.calls[0];
  assert.equal(call?.url, LINEAR_OAUTH.token);
  assert.equal(call?.headers[`content-type`], `application/x-www-form-urlencoded`);
  const body = new URLSearchParams(call?.body ?? ``);
  assert.equal(body.get(`grant_type`), `authorization_code`);
  assert.equal(body.get(`code`), `c0de`);
  assert.equal(body.get(`client_secret`), `shh`);
  assert.equal(body.get(`redirect_uri`), CFG.redirectUri);
});

test(`the record is write-only: hint and expiry, never the token; the secret goes ONLY to the store`, async () => {
  const m = memStore();
  const r = await makeLinearAuth(CFG, m.store, stub({ body: TOKEN_OK }).fetchImpl, () => FIXED_NOW).exchangeCode(`c`);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.record.kind, `oauth2`);
    assert.equal(r.record.hint, `…1234`);
    assert.deepEqual(r.record.scopes, [`read`, `write`]);
    // 86399s after FIXED_NOW, to the second.
    assert.equal(r.record.expiresAt, new Date(FIXED_NOW + 86399_000).toISOString());
    assert.ok(!JSON.stringify(r.record).includes(`lin_access`), `the token leaked into the record`);
  }
  assert.deepEqual(m.writes, [`lin_access_ABCD1234`], `exactly one write, of the real token, to the store`);
  assert.equal(m.current()?.refreshToken, `lin_refresh_x`);
});

/**
 * Sign in at FIXED_NOW, then hand back an auth whose clock is `now`. The two
 * clocks are deliberately separate: signing in with a late clock would stamp
 * a late expiresAt and the token would never look due.
 */
async function signedIn(fetchImpl: FetchLike, now = () => FIXED_NOW) {
  const m = memStore();
  const a = makeLinearAuth(CFG, m.store, stub({ body: TOKEN_OK }).fetchImpl, () => FIXED_NOW);
  await a.exchangeCode(`c`);
  // Swap in the fetch under test AFTER sign-in so the exchange is not it.
  return { auth: makeLinearAuth(CFG, m.store, fetchImpl, now), m };
}

test(`refresh uses Basic base64(client_id:client_secret) and grant_type=refresh_token`, async () => {
  const s = stub({ body: JSON.stringify({ access_token: `lin_access_NEW99999`, expires_in: 86399, scope: `read` }) });
  const { auth, m } = await signedIn(s.fetchImpl);
  const r = await auth.refresh();
  assert.ok(r.ok);
  const call = s.calls[0];
  assert.equal(call?.headers[`authorization`], `Basic ${Buffer.from(`cid:shh`).toString(`base64`)}`);
  const body = new URLSearchParams(call?.body ?? ``);
  assert.equal(body.get(`grant_type`), `refresh_token`);
  assert.equal(body.get(`refresh_token`), `lin_refresh_x`);
  // The response omitted refresh_token, so the OLD one must be kept.
  assert.equal(m.current()?.refreshToken, `lin_refresh_x`);
  assert.equal(m.current()?.accessToken, `lin_access_NEW99999`);
});

test(`a 400/401 on refresh CLEARS the stored token — the UI must show reconnect, not configured`, async () => {
  const { auth, m } = await signedIn(stub({ ok: false, status: 401, body: `{"error":"invalid_grant"}` }).fetchImpl);
  const r = await auth.refresh();
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.detail, /reconnect required/);
  assert.equal(m.current(), undefined, `a dead refresh token must not leave the token looking configured`);
});

test(`a 5xx on refresh is reported but does NOT clear the token — it may be transient`, async () => {
  const { auth, m } = await signedIn(stub({ ok: false, status: 503 }).fetchImpl);
  const r = await auth.refresh();
  assert.equal(r.ok, false);
  assert.ok(m.current(), `a transient failure must not sign the user out`);
});

test(`needsRefresh fires inside the 30-minute margin, never for a PAT`, async () => {
  const { auth } = await signedIn(stub({}).fetchImpl);
  const rec = (await auth.record())!;
  // Fresh: 86399s left, well outside the margin.
  assert.equal(auth.needsRefresh(rec), false);
  // 29 minutes before expiry: inside the margin.
  const late = makeLinearAuth(CFG, memStore().store, stub({}).fetchImpl, () => FIXED_NOW + (86399 - 29 * 60) * 1000);
  assert.equal(late.needsRefresh(rec), true);
  // A PAT has no expiry we can see, so it never asks to refresh.
  assert.equal(auth.needsRefresh({ kind: `pat`, hint: `…1234`, scopes: [] }), false);
});

test(`setPat stores write-only and refuses a token too short to be one`, async () => {
  const m = memStore();
  const a = makeLinearAuth(CFG, m.store, stub({}).fetchImpl);
  assert.equal((await a.setPat(`short`)).ok, false);
  const r = await a.setPat(`lin_api_PERSONAL_TOKEN_5678`, [`read`]);
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.record, { kind: `pat`, hint: `…5678`, scopes: [`read`] });
    assert.ok(!(`expiresAt` in r.record), `a PAT has no expiry we can see`);
  }
  assert.deepEqual(m.writes, [`lin_api_PERSONAL_TOKEN_5678`]);
});

test(`status(): disconnected when nothing stored; checking when present; refreshes first if due`, async () => {
  const none = makeLinearAuth(CFG, memStore().store, stub({}).fetchImpl);
  assert.deepEqual(await none.status(), { state: `disconnected` });

  const { auth } = await signedIn(stub({}).fetchImpl);
  assert.deepEqual(await auth.status(), { state: `checking` }, `present but unprobed is checking, not connected`);

  // Due for refresh and the refresh is rejected: status says error, not checking.
  const dead = stub({ ok: false, status: 401 });
  const { auth: due } = await signedIn(dead.fetchImpl, () => FIXED_NOW + (86399 - 60) * 1000);
  const s = await due.status();
  assert.equal(s.state, `error`);
  assert.equal(dead.calls.length, 1, `status must have attempted the refresh`);
});
