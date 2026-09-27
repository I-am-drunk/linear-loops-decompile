/**
 * T-901 layer tests: tokens, pairing, descriptor. Pure + one real HTTP
 * round-trip for the descriptor. Run: node --experimental-strip-types --test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { TokenStore, assertScopes, hashToken } from "./tokens.ts";
import type { Scope } from "./tokens.ts";
import { PairingManager } from "./pairing.ts";
import { createEnvironmentHandler, generateEnvironmentId } from "./descriptor.ts";

const ALL: Scope[] = ["env:read", "loops:read", "loops:write", "runs:read", "runs:write", "settings:read", "settings:write"];

test("tokens: mint + authorize; plaintext never stored", () => {
  const store = new TokenStore();
  const { token, record } = store.mint({ scopes: ["runs:read"] });
  assert.match(token, /^t3_[A-Za-z0-9_-]{32}$/);
  assert.equal(record.hash, hashToken(token));
  assert.notEqual(record.hash, token);
  assert.ok(!JSON.stringify(store.list()).includes(token));
  const ok = store.authorize(token, "runs:read");
  assert.equal(ok.ok, true);
});

test("tokens: typed failures — unknown, scope, revoke, expire, consume", () => {
  let now = 1_000;
  const store = new TokenStore({ now: () => now });
  const { token, record } = store.mint({ scopes: ["runs:read"], ttlMs: 100 });
  assert.deepEqual(store.authorize("t3_nope", "runs:read"), { ok: false, error: "unknown_token" });
  assert.deepEqual(store.authorize(token, "runs:write"), { ok: false, error: "insufficient_scope" });
  now = 1_101; // expiry boundary is <= now
  assert.deepEqual(store.authorize(token, "runs:read"), { ok: false, error: "token_expired" });

  const fresh = store.mint({ scopes: ALL });
  assert.equal(store.revoke(fresh.record.id), true);
  assert.deepEqual(store.authorize(fresh.token, "env:read"), { ok: false, error: "token_revoked" });

  const once = store.mint({ scopes: ALL, kind: "pairing" });
  assert.equal(store.consume(once.record.id), true);
  assert.deepEqual(store.authorize(once.token, "env:read"), { ok: false, error: "token_consumed" });
});

test("tokens: scope list is closed", () => {
  assert.throws(() => assertScopes([]), /at least one/);
  assert.throws(() => assertScopes(["admin:*"]), /unknown scope/);
  assert.equal(assertScopes(["runs:read"]).length, 1);
});

test("tokens: persistence seam round-trips records", () => {
  const saved: Map<string, import("./tokens.ts").TokenRecord> = new Map();
  const persistence = {
    put: (r: import("./tokens.ts").TokenRecord) => void saved.set(r.id, r),
    loadAll: () => [...saved.values()],
  };
  const a = new TokenStore({ persistence });
  const { token } = a.mint({ scopes: ["env:read"] });
  const b = new TokenStore({ persistence });
  assert.equal(b.authorize(token, "env:read").ok, true);
});

test("pairing: connection string shape + redeem", () => {
  const store = new TokenStore();
  const pairing = new PairingManager(store);
  const offer = pairing.createOffer({ url: "https://loops.example.com", scopes: ["runs:read", "runs:write"] });
  const parsed = new URL(offer.connectionString.replace("loops://", "https://placeholder/").replace("https://placeholder/", "loops://"));
  assert.ok(offer.connectionString.startsWith("loops://pair?url="));
  assert.ok(offer.connectionString.includes(encodeURIComponent("https://loops.example.com")));
  assert.ok(offer.connectionString.includes(`token=${encodeURIComponent(offer.token)}`));
  assert.equal(parsed.protocol, "loops:");
  const redeemed = pairing.redeem(offer.token);
  assert.equal(redeemed.ok, true);
  if (redeemed.ok) {
    assert.deepEqual(redeemed.record.scopes, ["runs:read", "runs:write"]);
    assert.equal(store.authorize(redeemed.token, "runs:write").ok, true);
  }
});

test("pairing: redeem narrows but never widens scopes", () => {
  const pairing = new PairingManager(new TokenStore());
  const offer = pairing.createOffer({ url: "http://x", scopes: ["runs:read", "runs:write"] });
  const narrowed = pairing.redeem(offer.token, ["runs:read", "settings:write"]);
  assert.equal(narrowed.ok, true);
  if (narrowed.ok) assert.deepEqual(narrowed.record.scopes, ["runs:read"]);
});

test("pairing: one-time and expiring", () => {
  let now = 0;
  const store = new TokenStore({ now: () => now });
  const pairing = new PairingManager(store, { now: () => now });
  const offer = pairing.createOffer({ url: "http://x", scopes: ALL, ttlMs: 50 });
  assert.equal(pairing.redeem(offer.token).ok, true);
  assert.deepEqual(pairing.redeem(offer.token), { ok: false, error: "pairing_consumed" });

  const stale = pairing.createOffer({ url: "http://x", scopes: ALL, ttlMs: 10 });
  now = 100;
  assert.deepEqual(pairing.redeem(stale.token), { ok: false, error: "pairing_expired" });
  assert.deepEqual(pairing.redeem("t3_bogus"), { ok: false, error: "invalid_pairing_token" });
});

test("pairing: device flow delivers the token exactly once", () => {
  const pairing = new PairingManager(new TokenStore());
  const auth = pairing.createDeviceAuthorization({ scopes: ["env:read"] });
  assert.match(auth.userCode, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.deepEqual(pairing.pollDeviceToken(auth.deviceCode), { status: "authorization_pending" });
  assert.equal(pairing.approveDevice("zzzz-zzzz"), false);
  assert.equal(pairing.approveDevice(auth.userCode.toLowerCase()), true);
  const delivered = pairing.pollDeviceToken(auth.deviceCode);
  assert.equal(delivered.status, "complete");
  assert.deepEqual(pairing.pollDeviceToken(auth.deviceCode), { status: "invalid" });
});

test("descriptor: real HTTP round-trip, shape, 405, publicUrl", async () => {
  const handler = createEnvironmentHandler({
    id: generateEnvironmentId(),
    version: "0.1.0",
    publicUrl: "https://tunnel.example.com",
    label: "home",
  });
  const server = createServer(handler);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/.well-known/t3/environment`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body["product"], "loops-server");
    assert.equal(body["protocol"], 1);
    assert.deepEqual(body["capabilities"], ["loops", "runs", "settings"]);
    assert.equal(body["publicUrl"], "https://tunnel.example.com");
    assert.equal(body["label"], "home");
    assert.equal(typeof body["id"], "string");

    const post = await fetch(`http://127.0.0.1:${port}/.well-known/t3/environment`, { method: "POST" });
    assert.equal(post.status, 405);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

