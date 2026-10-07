/**
 * IN1 registry behavior. No network, no adapter — a fake provider whose
 * reachability and failures are set per test.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeRegistry } from "./registry.ts";
import { fail, ok, type Outcome, type Provider, type ProviderFailure } from "./types.ts";

function fake(id: string, live: Outcome<true> = ok(true as const)): Provider {
  return {
    id,
    label: id,
    auth: `apiKey`,
    models: async () => ok([{ id: `m`, label: `M` }]),
    chat: async () => ok({ content: ``, usage: { inputTokens: 0, outputTokens: 0 }, stop: `end` as const }),
    estimate: () => ({ cents: 0, known: false }),
    cost: () => ({ cents: 0, known: false }),
    reachable: async () => live,
    credential: () => ({ configured: true }),
  };
}

const down = (id: string): ProviderFailure => ({ kind: `unavailable`, provider: id, detail: `socket` });

test(`list() is insertion-ordered so the settings UI is stable`, () => {
  const r = makeRegistry();
  r.register(fake(`b`));
  r.register(fake(`a`));
  r.register(fake(`c`));
  assert.deepEqual(r.list().map((p) => p.id), [`b`, `a`, `c`]);
});

test(`double registration throws rather than replacing silently`, () => {
  const r = makeRegistry();
  r.register(fake(`x`));
  assert.throws(() => r.register(fake(`x`)), /already registered: x/);
});

test(`get() on an unknown id is unconfigured, not a throw`, () => {
  const r = makeRegistry();
  const got = r.get(`nope`);
  assert.equal(got.ok, false);
  if (!got.ok) assert.deepEqual(got.error, { kind: `unconfigured`, provider: `nope` });
});

test(`resolve() returns the first reachable provider in order`, async () => {
  const r = makeRegistry();
  r.register(fake(`down`, fail(down(`down`))));
  r.register(fake(`up`));
  const got = await r.resolve([`down`, `up`]);
  assert.equal(got.ok, true);
  if (got.ok) assert.equal(got.value.id, `up`);
});

test(`resolve() with no ids is unconfigured`, async () => {
  const got = await makeRegistry().resolve([]);
  assert.equal(got.ok, false);
});

test(`a REJECTION is not retried elsewhere — fallback would launder it`, async () => {
  const r = makeRegistry();
  r.register(fake(`strict`, fail({ kind: `rejected`, provider: `strict`, detail: `content policy` })));
  r.register(fake(`lax`));

  const got = await r.resolve([`strict`, `lax`]);

  // `lax` is up, so a naive loop would return it. Rejection is about the
  // REQUEST, not the provider's health; shopping it around turns one
  // provider's refusal into a silent retry against another.
  assert.equal(got.ok, false);
  if (!got.ok) {
    assert.equal(got.error.kind, `rejected`);
    assert.equal(got.error.provider, `strict`);
  }
});

test(`when all are down, the reported provider is the one ASKED FOR`, async () => {
  const r = makeRegistry();
  r.register(fake(`primary`, fail(down(`primary`))));
  r.register(fake(`backup`, fail(down(`backup`))));

  const got = await r.resolve([`primary`, `backup`]);

  // The run record has to name what the automation configured. Reporting
  // `backup` would blame our own substitution for the outage.
  assert.equal(got.ok, false);
  if (!got.ok) assert.equal(got.error.provider, `primary`);
});

test(`rate limiting falls through — it is availability, not a verdict`, async () => {
  const r = makeRegistry();
  r.register(fake(`busy`, fail({ kind: `rateLimited`, provider: `busy`, retryAfterMs: 5000 })));
  r.register(fake(`free`));
  const got = await r.resolve([`busy`, `free`]);
  assert.equal(got.ok, true);
  if (got.ok) assert.equal(got.value.id, `free`);
});
