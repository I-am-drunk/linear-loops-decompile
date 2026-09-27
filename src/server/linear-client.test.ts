/**
 * LinearClient (R5.1) tests. Every test uses an injected fake fetch and a
 * fake clock: tests NEVER hit the network (PLAN.md R3.3/R5 discipline).
 * Header names + semantics verified against linear.app/developers
 * /rate-limiting (KNOWLEDGE §6); reset headers are UTC epoch milliseconds.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { LinearClient, LinearClientError, LINEAR_API_URL } from "./linear-client.ts";
import { probeLinear, probeLinearWithClient } from "./linear.ts";

const HEADERS = {
  "x-ratelimit-requests-limit": "2500",
  "x-ratelimit-requests-remaining": "2499",
  "x-ratelimit-requests-reset": "3600000",
  "x-ratelimit-complexity-limit": "3000000",
  "x-ratelimit-complexity-remaining": "2999990",
  "x-ratelimit-complexity-reset": "3600000",
  "x-complexity": "10",
};

function jsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), { status: init?.status ?? 200, headers: init?.headers ?? { ...HEADERS } });
}

test("success: posts the operation with the PAT and parses the full budget", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ data: { viewer: { id: "u1" } } });
  }) as typeof fetch;

  const client = new LinearClient({ getToken: () => "lin_api_abc", fetchImpl: fakeFetch });
  const data = await client.query<{ viewer: { id: string } }>("query { viewer { id } }", { after: "c1" });

  assert.equal(data.viewer.id, "u1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, LINEAR_API_URL);
  const headers = calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.authorization, "lin_api_abc");
  const sent = JSON.parse(String(calls[0].init?.body));
  assert.deepEqual(sent.variables, { after: "c1" });

  const b = client.budget();
  assert.equal(b.requestsLimit, 2500);
  assert.equal(b.requestsRemaining, 2499);
  assert.equal(b.requestsReset, 3600000);
  assert.equal(b.complexityRemaining, 2999990);
  assert.equal(b.lastComplexity, 10);
});

test("not_connected: no token, no fetch", async () => {
  let fired = 0;
  const client = new LinearClient({ getToken: () => undefined, fetchImpl: (async () => { fired += 1; return jsonResponse({}); }) as typeof fetch });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => e.kind === "not_connected");
  assert.equal(fired, 0);
});

test("graphql errors with null data throw a typed graphql error", async () => {
  const fakeFetch = (async () =>
    jsonResponse({ data: null, errors: [{ message: "Entity not found: Issue" }] })) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch });
  await assert.rejects(client.query("query { issue(id: \"x\") { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "graphql");
    assert.match(e.message, /Entity not found/);
    return true;
  });
});

test("RATELIMITED extension maps to rate_limited with retry hint from the reset header", async () => {
  let now = 3_000_000;
  const fakeFetch = (async () =>
    jsonResponse(
      { data: null, errors: [{ message: "Rate limit exceeded", extensions: { code: "RATELIMITED" } }] },
      { headers: { ...HEADERS, "x-ratelimit-requests-remaining": "0", "x-ratelimit-requests-reset": "3600000" } },
    )) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch, now: () => now });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.equal(e.retryAfterMs, 600_000);
    return true;
  });
});

test("http 429 honors Retry-After (seconds) and marks the window exhausted", async () => {
  const fakeFetch = (async () =>
    new Response("Too Many Requests", { status: 429, headers: { "retry-after": "30", ...HEADERS } })) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.equal(e.status, 429);
    assert.equal(e.retryAfterMs, 30_000);
    return true;
  });
  assert.equal(client.budget().requestsRemaining, 0);
});

test("gate: a known-exhausted window refuses to fire until the reset passes", async () => {
  let now = 1_000_000;
  let fired = 0;
  const fakeFetch = (async () => {
    fired += 1;
    return jsonResponse(
      { data: { ok: true } },
      { headers: { ...HEADERS, "x-ratelimit-requests-remaining": "0", "x-ratelimit-requests-reset": "2000000" } },
    );
  }) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch, now: () => now });

  await client.query("query { viewer { id } }"); // exhausts the window per headers
  assert.equal(fired, 1);

  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.equal(e.retryAfterMs, 1_000_000);
    return true;
  });
  assert.equal(fired, 1); // refused BEFORE firing — no 429 earned

  now = 2_000_001; // window reset passed
  await client.query("query { viewer { id } }");
  assert.equal(fired, 2);
});

test("http 401 surfaces as an http error with status", async () => {
  const fakeFetch = (async () => new Response("Unauthorized", { status: 401 })) as typeof fetch;
  const client = new LinearClient({ getToken: () => "bad", fetchImpl: fakeFetch });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "http");
    assert.equal(e.status, 401);
    return true;
  });
});

test("concurrency cap: at most N in flight, the rest run FIFO", async () => {
  let inFlight = 0;
  let maxSeen = 0;
  const order: number[] = [];
  const fakeFetch = (async (url: unknown, init?: RequestInit) => {
    inFlight += 1;
    maxSeen = Math.max(maxSeen, inFlight);
    const n = JSON.parse(String(init?.body)).variables.n as number;
    await new Promise((r) => setTimeout(r, 10));
    inFlight -= 1;
    order.push(n);
    return jsonResponse({ data: { n } });
  }) as typeof fetch;

  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch, maxConcurrency: 2 });
  const results = await Promise.all([0, 1, 2, 3, 4].map((n) =>
    client.query<{ n: number }>("query($n: Int!) { ok }", { n })));
  assert.equal(maxSeen, 2);
  assert.deepEqual(order, [0, 1, 2, 3, 4]);
  assert.deepEqual(results.map((r) => r.n), [0, 1, 2, 3, 4]);
});

test("probe rides the client: ok path, bad token, shared budget", async () => {
  const fakeFetch = (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
    if (init?.headers?.authorization === "bad-token") return new Response("Unauthorized", { status: 401 });
    return jsonResponse({
      data: {
        viewer: { id: "u1", name: "Ada", email: "ada@example.com" },
        organization: { id: "o1", name: "Acme", urlKey: "acme" },
      },
    });
  }) as typeof fetch;

  const good = await probeLinear("lin_api_real", fakeFetch);
  assert.equal(good.ok, true);
  assert.equal(good.viewer?.name, "Ada");
  assert.equal(good.organization?.urlKey, "acme");
  assert.equal(good.rateLimit?.requestsRemaining, 2499);

  const bad = await probeLinear("bad-token", fakeFetch);
  assert.equal(bad.ok, false);
  assert.match(bad.error ?? "", /unauthorized/);

  // The shared client accumulates the budget across calls (dataplane.probe path).
  const shared = new LinearClient({ getToken: () => "lin_api_real", fetchImpl: fakeFetch });
  await probeLinearWithClient(shared);
  const again = await probeLinearWithClient(shared);
  assert.equal(again.ok, true);
  assert.equal(shared.budget().requestsRemaining, 2499);
});
