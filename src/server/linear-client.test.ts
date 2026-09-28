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

test("HTTP 400 + RATELIMITED (the documented shape) maps to rate_limited with retry hint", async () => {
  // Official docs: "response http status code will be 400, but you can catch
  // these by inspecting the errors in the response body containing the
  // RATELIMITED error code" (docs-site/rate-limiting.md).
  let now = 3_000_000;
  const fakeFetch = (async () =>
    jsonResponse(
      { errors: [{ message: "Rate limit exceeded", extensions: { code: "RATELIMITED" } }] },
      { status: 400, headers: { ...HEADERS, "x-ratelimit-requests-remaining": "0", "x-ratelimit-requests-reset": "3600000" } },
    )) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch, now: () => now });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.equal(e.status, 400);
    assert.equal(e.retryAfterMs, 600_000);
    return true;
  });
  assert.equal(client.budget().requestsRemaining, 0);
});

test("RATELIMITED on a 200 body (defensive) still maps to rate_limited", async () => {
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

for (const window of ["complexity", "endpoint-requests"]) {
  for (const reset of [1_030_000, 1_000_000, undefined]) {
    test(`RATELIMITED uses the exhausted ${window} reset (${reset ?? "missing"})`, async () => {
      const headers: Record<string, string> = {
        ...HEADERS,
        [`x-ratelimit-${window}-remaining`]: "0",
      };
      const resetHeader = `x-ratelimit-${window}-reset`;
      if (reset === undefined) delete headers[resetHeader];
      else headers[resetHeader] = String(reset);
      const client = new LinearClient({
        getToken: () => "t",
        now: () => 1_000_000,
        fetchImpl: (async () => jsonResponse(
          { errors: [{ extensions: { code: "RATELIMITED" } }] },
          { status: 400, headers },
        )) as typeof fetch,
      });
      await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
        assert.equal(e.kind, "rate_limited");
        assert.equal(e.status, 400);
        assert.equal(e.retryAfterMs, reset !== undefined && reset > 1_000_000 ? 30_000 : undefined);
        assert.equal(e.rateLimit?.requestsRemaining, 2499);
        return true;
      });
    });
  }
}

test("RATELIMITED waits for all known exhausted windows", async () => {
  const client = new LinearClient({
    getToken: () => "t",
    now: () => 1_000_000,
    fetchImpl: (async () => jsonResponse(
      { errors: [{ extensions: { code: "RATELIMITED" } }] },
      { status: 400, headers: {
        ...HEADERS,
        "x-ratelimit-requests-remaining": "0",
        "x-ratelimit-requests-reset": "1010000",
        "x-ratelimit-complexity-remaining": "0",
        "x-ratelimit-complexity-reset": "1020000",
        "x-ratelimit-endpoint-requests-remaining": "0",
        "x-ratelimit-endpoint-requests-reset": "1030000",
      } },
    )) as typeof fetch,
  });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.equal(e.retryAfterMs, 30_000);
    return true;
  });
});

test("a plain 400 without RATELIMITED stays a generic http error", async () => {
  const fakeFetch = (async () =>
    jsonResponse({ errors: [{ message: "Argument Validation Error" }] }, { status: 400 })) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "http");
    assert.equal(e.status, 400);
    return true;
  });
});

test("http 429 honors Retry-After (seconds) and marks the window exhausted", async () => {
  // 429 without informative budget headers: ambiguous → conservative zero.
  const fakeFetch = (async () =>
    new Response("Too Many Requests", { status: 429, headers: { "retry-after": "30" } })) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.equal(e.status, 429);
    assert.equal(e.retryAfterMs, 30_000);
    return true;
  });
  assert.equal(client.budget().requestsRemaining, 0);
});

test("429 with only Retry-After backfills the reset so the gate actually closes", async () => {
  // Without budget headers, zeroing requestsRemaining alone leaves
  // requestsReset unset and the gate (remaining===0 AND reset>now) open.
  // markExhausted must backfill the reset from Retry-After (CodeRabbit #155).
  let calls = 0;
  let now = 1_000_000;
  const fakeFetch = (async () => {
    calls += 1;
    return new Response("Too Many Requests", { status: 429, headers: { "retry-after": "30" } });
  }) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch, now: () => now });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => e.kind === "rate_limited");
  assert.equal(calls, 1);
  // The next call must be refused by the gate — no network fire.
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.ok(e.retryAfterMs !== undefined && e.retryAfterMs > 0 && e.retryAfterMs <= 30_000);
    return true;
  });
  assert.equal(calls, 1);
  // After the window passes, the gate reopens.
  now += 31_000;
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => e.kind === "rate_limited");
  assert.equal(calls, 2);
});

test("429 keeps a still-positive global budget the headers report", async () => {
  // Endpoint/complexity-only 429: headers still show global requests left —
  // the global budget must survive (CodeRabbit #155).
  const fakeFetch = (async () =>
    new Response("Too Many Requests", {
      status: 429,
      headers: { ...HEADERS, "x-ratelimit-endpoint-requests-remaining": "0", "x-ratelimit-endpoint-requests-reset": "3600000", "x-ratelimit-endpoint-name": "IssueCreate" },
    })) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => e.kind === "rate_limited");
  const b = client.budget();
  assert.equal(b.requestsRemaining, 2499);
  assert.equal(b.endpointRequestsRemaining, 0);
});

test("429 backfills a missing endpoint reset from Retry-After and gates the next call", async () => {
  let calls = 0;
  const fakeFetch = (async () => {
    calls += 1;
    return new Response("Too Many Requests", {
      status: 429,
      headers: { ...HEADERS, "x-ratelimit-endpoint-requests-remaining": "0", "x-ratelimit-endpoint-name": "IssueCreate", "retry-after": "30" },
    });
  }) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch, now: () => 1_000_000 });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => e.kind === "rate_limited");
  assert.equal(client.budget().requestsRemaining, 2499);
  assert.equal(client.budget().endpointRequestsReset, 1_030_000);
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.match(e.message, /IssueCreate/);
    assert.equal(e.retryAfterMs, 30_000);
    return true;
  });
  assert.equal(calls, 1);
});

for (const reset of [undefined, 1_000_000, 1_060_000]) {
  test(`429 Retry-After gates exhausted complexity with reset ${reset ?? "missing"}`, async () => {
    let now = 1_000_000;
    let calls = 0;
    const headers: Record<string, string> = {
      ...HEADERS,
      "x-ratelimit-complexity-remaining": "0",
      "retry-after": "30",
    };
    if (reset === undefined) delete headers["x-ratelimit-complexity-reset"];
    else headers["x-ratelimit-complexity-reset"] = String(reset);
    const client = new LinearClient({
      getToken: () => "t",
      now: () => now,
      fetchImpl: (async () => {
        calls += 1;
        return calls === 1
          ? new Response("Too Many Requests", { status: 429, headers })
          : jsonResponse({ data: { ok: true } });
      }) as typeof fetch,
    });
    await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
      assert.equal(e.kind, "rate_limited");
      assert.equal(e.status, 429);
      assert.equal(e.retryAfterMs, 30_000);
      return true;
    });
    const expectedReset = reset !== undefined && reset > now ? reset : now + 30_000;
    now = expectedReset - 1;
    await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
      assert.equal(e.kind, "rate_limited");
      assert.equal(e.status, undefined); // refused before fetch
      assert.match(e.message, /complexity/);
      assert.equal(e.retryAfterMs, 1);
      return true;
    });
    assert.equal(calls, 1);
    assert.equal(client.budget().requestsRemaining, 2499);
    assert.equal(client.budget().requestsReset, 3_600_000);
    now = expectedReset;
    assert.deepEqual(await client.query("query { viewer { id } }"), { ok: true });
    assert.equal(calls, 2);
  });
}

test("RATELIMITED beats partial data and marks the header-exhausted window", async () => {
  const fakeFetch = (async () =>
    jsonResponse(
      { data: { viewer: { id: "u1" } }, errors: [{ message: "Complexity limit reached", extensions: { code: "RATELIMITED" } }] },
      { headers: { ...HEADERS, "x-ratelimit-complexity-remaining": "0", "x-ratelimit-complexity-reset": "3600000" } },
    )) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch });
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    return true;
  });
  assert.equal(client.budget().complexityRemaining, 0);
  assert.equal(client.budget().requestsRemaining, 2499); // untouched window kept
});

test("endpoint budget gates before firing (never earns the 429)", async () => {
  let now = 1_000_000;
  let fired = 0;
  const fakeFetch = (async () => {
    fired += 1;
    return jsonResponse({ data: { ok: true } }, {
      headers: { ...HEADERS, "x-ratelimit-endpoint-requests-remaining": "0", "x-ratelimit-endpoint-requests-reset": "2000000", "x-ratelimit-endpoint-name": "AgentSessionCreate" },
    });
  }) as typeof fetch;
  const client = new LinearClient({ getToken: () => "t", fetchImpl: fakeFetch, now: () => now });
  await client.query("query { viewer { id } }");
  assert.equal(fired, 1);
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.match(e.message, /AgentSessionCreate/);
    return true;
  });
  assert.equal(fired, 1);
  now = 2_000_001;
  await client.query("query { viewer { id } }");
  assert.equal(fired, 2);
});

test("credential swap invalidates the cached budget (budgets are per-user)", async () => {
  let token = "userA";
  let now = 0;
  const fakeFetch = (async () =>
    jsonResponse({ data: { ok: true } }, {
      headers: { ...HEADERS, "x-ratelimit-requests-remaining": "0", "x-ratelimit-requests-reset": "3600000" },
    })) as typeof fetch;
  const client = new LinearClient({ getToken: () => token, fetchImpl: fakeFetch, now: () => now });
  await client.query("query { viewer { id } }");
  await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => e.kind === "rate_limited");
  token = "userB"; // different user, different quota — the stale window must not block
  await client.query("query { viewer { id } }");
});

test("a stale in-flight response must not repopulate the new credential's budget", async () => {
  let token = "userA";
  const resolvers: Array<(r: Response) => void> = [];
  const fakeFetch = (async () => new Promise<Response>((r) => resolvers.push(r))) as typeof fetch;
  const client = new LinearClient({ getToken: () => token, fetchImpl: fakeFetch, maxConcurrency: 2 });
  const p1 = client.query("query { viewer { id } }");
  await new Promise((r) => setImmediate(r)); // dispatch userA before replacing it
  token = "userB";
  const p2 = client.query("query { viewer { id } }"); // fired as userB
  await new Promise((r) => setImmediate(r)); // let both fetchImpl calls land
  assert.equal(resolvers.length, 2);
  // userB's response arrives FIRST, healthy budget
  resolvers[1](jsonResponse({ data: { ok: true } }));
  await p2;
  assert.equal(client.budget().requestsRemaining, 2499);
  // now userA's stale response lands: exhausted window — must be discarded
  resolvers[0](jsonResponse({ data: { ok: true } }, {
    headers: { ...HEADERS, "x-ratelimit-requests-remaining": "0", "x-ratelimit-requests-reset": "3600000" },
  }));
  await p1;
  assert.equal(client.budget().requestsRemaining, 2499);
});

test("a stale 429 must not exhaust the new credential's budget", async () => {
  let token = "userA";
  let resolveOld!: (response: Response) => void;
  const fakeFetch = (async (_url: unknown, init?: RequestInit) => {
    if ((init?.headers as Record<string, string>).authorization === "userA") {
      return new Promise<Response>((resolve) => { resolveOld = resolve; });
    }
    return jsonResponse({ data: { ok: true } });
  }) as typeof fetch;
  const client = new LinearClient({ getToken: () => token, fetchImpl: fakeFetch, now: () => 1_000_000 });
  const oldRequest = client.query("query { viewer { id } }");
  await new Promise((resolve) => setImmediate(resolve));
  token = "userB";
  await client.query("query { viewer { id } }");
  resolveOld(new Response("Too Many Requests", { status: 429, headers: { "retry-after": "30" } }));
  await assert.rejects(oldRequest, (e: LinearClientError) => e.kind === "rate_limited");
  assert.equal(client.budget().requestsRemaining, 2499);
});

test("a stale RATELIMITED body must not exhaust the new credential's budget", async () => {
  let token = "userA";
  let resolveOldBody!: (body: unknown) => void;
  const oldResponse = jsonResponse({}, { status: 400, headers: {
    ...HEADERS,
    "x-ratelimit-endpoint-requests-remaining": "0",
    "x-ratelimit-endpoint-requests-reset": "1030000",
  } });
  oldResponse.json = () => new Promise((resolve) => { resolveOldBody = resolve; });
  const fakeFetch = (async (_url: unknown, init?: RequestInit) =>
    (init?.headers as Record<string, string>).authorization === "userA"
      ? oldResponse
      : jsonResponse({ data: { ok: true } })) as typeof fetch;
  const client = new LinearClient({ getToken: () => token, fetchImpl: fakeFetch, now: () => 1_000_000 });
  const oldRequest = client.query("query { viewer { id } }");
  await new Promise((resolve) => setImmediate(resolve));
  token = "userB";
  await client.query("query { viewer { id } }");
  resolveOldBody({ errors: [{ extensions: { code: "RATELIMITED" } }] });
  await assert.rejects(oldRequest, (e: LinearClientError) => {
    assert.equal(e.kind, "rate_limited");
    assert.equal(e.retryAfterMs, 30_000); // old response's endpoint, not userB's budget
    return true;
  });
  assert.equal(client.budget().requestsRemaining, 2499);
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

for (const replacement of ["userB", undefined]) {
  test(`queued requests honor credential ${replacement ? "replacement" : "removal"} before dispatch`, async () => {
    let token: string | undefined = "userA";
    const sentTokens: string[] = [];
    let finishFirst!: (response: Response) => void;
    const fakeFetch = (async (_url: unknown, init?: RequestInit) => {
      sentTokens.push((init?.headers as Record<string, string>).authorization);
      if (sentTokens.length === 1) {
        return new Promise<Response>((resolve) => { finishFirst = resolve; });
      }
      return jsonResponse({ data: { ok: true } });
    }) as typeof fetch;
    const client = new LinearClient({
      getToken: () => token, fetchImpl: fakeFetch, maxConcurrency: 1, now: () => 1_000_000,
    });
    const first = client.query("query { viewer { id } }");
    await new Promise((resolve) => setImmediate(resolve));
    const queued = client.query("query { viewer { id } }");
    const queuedResult = replacement === undefined
      ? assert.rejects(queued, (e: LinearClientError) => e.kind === "not_connected")
      : queued;
    assert.deepEqual(sentTokens, ["userA"]);

    token = replacement;
    finishFirst(jsonResponse({ data: { ok: true } }, {
      headers: { ...HEADERS, "x-ratelimit-requests-remaining": "0" },
    }));
    await first;
    await queuedResult;
    assert.deepEqual(sentTokens, replacement ? ["userA", replacement] : ["userA"]);

    // A rejected queued call must release its slot so reconnecting can proceed.
    token = "userB";
    await client.query("query { viewer { id } }");
    assert.equal(sentTokens.at(-1), "userB");
    assert.equal(client.budget().requestsRemaining, 2499);
  });
}

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

for (const window of ["complexity", "endpoint-requests"]) {
  for (const reset of [1_030_000, 1_000_000, undefined]) {
    test(`429 uses the exhausted ${window} reset (${reset ?? "missing"})`, async () => {
      const headers: Record<string, string> = {
        ...HEADERS,
        [`x-ratelimit-${window}-remaining`]: "0",
      };
      const resetHeader = `x-ratelimit-${window}-reset`;
      if (reset === undefined) delete headers[resetHeader];
      else headers[resetHeader] = String(reset);
      const client = new LinearClient({
        getToken: () => "t",
        now: () => 1_000_000,
        fetchImpl: (async () => new Response("Too Many Requests", { status: 429, headers })) as typeof fetch,
      });
      await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => {
        assert.equal(e.kind, "rate_limited");
        assert.equal(e.status, 429);
        assert.equal(e.retryAfterMs, reset !== undefined && reset > 1_000_000 ? 30_000 : undefined);
        return true;
      });
    });
  }
}

for (const status of [200, 400, 429]) {
  test(`all exhausted windows determine both response and preflight delays (${status})`, async () => {
    let now = 1_000_000;
    let calls = 0;
    const client = new LinearClient({
      getToken: () => "t",
      now: () => now,
      fetchImpl: (async () => {
        calls += 1;
        return jsonResponse(status === 200 ? { data: { ok: true } } : {
          errors: [{ extensions: { code: "RATELIMITED" } }],
        }, { status, headers: {
          ...HEADERS,
          "x-ratelimit-requests-remaining": "0",
          "x-ratelimit-requests-reset": "1010000",
          "x-ratelimit-complexity-remaining": "0",
          "x-ratelimit-complexity-reset": "1020000",
          "x-ratelimit-endpoint-requests-remaining": "0",
          "x-ratelimit-endpoint-requests-reset": "1030000",
        } });
      }) as typeof fetch,
    });
    const checkDelay = (delay: number) => (e: LinearClientError) => {
      assert.equal(e.kind, "rate_limited");
      assert.equal(e.retryAfterMs, delay);
      return true;
    };
    if (status === 200) await client.query("query { viewer { id } }");
    else await assert.rejects(client.query("query { viewer { id } }"), checkDelay(30_000));
    await assert.rejects(client.query("query { viewer { id } }"), checkDelay(30_000));
    now += 15_000;
    await assert.rejects(client.query("query { viewer { id } }"), checkDelay(15_000));
    assert.equal(calls, 1);
    now = 1_030_001;
    if (status === 200) await client.query("query { viewer { id } }");
    else await assert.rejects(client.query("query { viewer { id } }"), (e: LinearClientError) => e.kind === "rate_limited");
    assert.equal(calls, 2);
  });
}
