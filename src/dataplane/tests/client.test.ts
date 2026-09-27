/**
 * Tests for FixtureTransport + LinearClient + HttpTransport retry/auth behavior.
 * Run: see README: compile then run node --test on emitted tests/client.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LinearClient } from "../client.js";
import { HttpTransport, parseRateHeaders, rateLimitWaitMs } from "../transport.js";
import {
  FixtureTransport,
  UnmatchedFixtureError,
  createDemoWorkspace,
} from "../fixtures.js";
import { AuthenticationError, RateLimitError } from "../errors.js";

test("fixture client verifies auth via viewer query", async () => {
  const client = new LinearClient({ transport: createDemoWorkspace() });
  const viewer = await client.verifyAuth();
  assert.equal(viewer.id, "user-demo-01");
});

test("fixture transport records calls and matches variables predicate", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        queryIncludes: "issue",
        when: (v) => v.id === "iss-0001",
        respond: { data: { issue: { id: "iss-0001", title: "Set up CI pipeline" } } },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const out = await client.request<{ issue: { title: string } }>(
    "query OneIssue($id: String!) { issue(id: $id) { id title } }",
    { id: "iss-0001" },
  );
  assert.equal(out.issue.title, "Set up CI pipeline");
  assert.equal(t.calls.length, 1);
  assert.deepEqual(t.calls[0]!.variables, { id: "iss-0001" });
});

test("unmatched fixture throws by default", async () => {
  const t = new FixtureTransport({ fixtures: [] });
  const client = new LinearClient({ transport: t });
  await assert.rejects(
    () => client.request("query Nope { nope }"),
    (e) => e instanceof UnmatchedFixtureError,
  );
});

/** Build a Response-like object for the fake fetch. */
function fakeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("HttpTransport sends PAT as raw Authorization header and returns data", async () => {
  const seen: { authorization: string | null } = { authorization: null };
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    seen.authorization = new Headers(init?.headers).get("authorization");
    return fakeResponse(200, { data: { viewer: { id: "u1" } } });
  }) as typeof fetch;
  const transport = new HttpTransport({
    credential: { kind: "pat", token: "lin_api_test_123" },
    fetchImpl,
  });
  const client = new LinearClient({ transport });
  const data = await client.request<{ viewer: { id: string } }>("query V { viewer { id } }");
  assert.equal(data.viewer.id, "u1");
  assert.equal(seen.authorization, "lin_api_test_123"); // PAT: no Bearer prefix
});

test("OAuth credential uses Bearer scheme", async () => {
  const seen: { authorization: string | null } = { authorization: null };
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    seen.authorization = new Headers(init?.headers).get("authorization");
    return fakeResponse(200, { data: {} });
  }) as typeof fetch;
  const client = new LinearClient({
    transport: new HttpTransport({
      credential: { kind: "oauth", accessToken: "tok-abc" },
      fetchImpl,
    }),
  });
  await client.request("query Q { viewer { id } }");
  assert.equal(seen.authorization, "Bearer tok-abc");
});

test("401 throws AuthenticationError; bad PAT is not retried", async () => {
  let attempts = 0;
  const fetchImpl = (async () => {
    attempts++;
    return fakeResponse(401, { error: "unauthorized" });
  }) as typeof fetch;
  const client = new LinearClient({
    transport: new HttpTransport({
      credential: { kind: "pat", token: "lin_api_bad" },
      fetchImpl,
    }),
  });
  await assert.rejects(
    () => client.request("query V { viewer { id } }"),
    (e) => e instanceof AuthenticationError,
  );
  assert.equal(attempts, 1);
});

test("429 honors Retry-After, updates budget, then succeeds", async () => {
  let attempts = 0;
  const fetchImpl = (async () => {
    attempts++;
    if (attempts === 1) {
      return fakeResponse(429, { error: "rate limited" }, { "retry-after": "0" });
    }
    return fakeResponse(200, { data: { ok: true } }, {
      "x-ratelimit-requests-remaining": "2499",
      "x-complexity": "1",
    });
  }) as typeof fetch;
  const client = new LinearClient({
    transport: new HttpTransport({
      credential: { kind: "pat", token: "lin_api_x" },
      fetchImpl,
    }),
  });
  const data = await client.request<{ ok: boolean }>("query Q { viewer { id } }");
  assert.equal(data.ok, true);
  assert.equal(attempts, 2);
  const snap = client.rateBudget();
  assert.ok(snap && snap.requestsUsed >= 1);
});

test("mutations are not retried without idempotent opt-in", async () => {
  let attempts = 0;
  const fetchImpl = (async () => {
    attempts++;
    return fakeResponse(500, { error: "boom" });
  }) as typeof fetch;
  const client = new LinearClient({
    transport: new HttpTransport({
      credential: { kind: "pat", token: "lin_api_x" },
      fetchImpl,
    }),
  });
  await assert.rejects(() =>
    client.request("mutation M { commentCreate(input: {}) { success } }", {}, { idempotent: false }),
  );
  assert.equal(attempts, 1);
});

test("GraphQL errors array surfaces typed codes; RATELIMITED maps to RateLimitError", async () => {
  const fetchImpl = (async () =>
    fakeResponse(200, {
      errors: [{ message: "You have exceeded the rate limit.", extensions: { code: "RATELIMITED" } }],
    })) as typeof fetch;
  const client = new LinearClient({
    transport: new HttpTransport({
      credential: { kind: "pat", token: "lin_api_x" },
      fetchImpl,
    }),
  });
  // retries are enabled for reads; RATELIMITED with retryable path will retry
  // then eventually throw RateLimitError — cap attempts at 2 to keep it fast.
  await assert.rejects(
    () => client.request("query Q { viewer { id } }", {}, { maxAttempts: 2 }),
    (e) => e instanceof RateLimitError,
  );
});

test("error messages never contain the credential", async () => {
  const token = "lin_api_SUPERSECRET";
  const fetchImpl = (async () => {
    throw new Error(`socket hangup while authorizing ${token}`);
  }) as unknown as typeof fetch;
  const client = new LinearClient({
    transport: new HttpTransport({
      credential: { kind: "pat", token },
      fetchImpl,
    }),
  });
  const err = await client
    .request("query Q { viewer { id } }", {}, { maxAttempts: 1 })
    .then(() => null, (e: Error) => e);
  assert.ok(err);
  assert.ok(!err.message.includes(token));
});

test("parseRateHeaders reads Linear headers", () => {
  const h = new Headers({
    "x-ratelimit-requests-remaining": "2400",
    "x-ratelimit-complexity-remaining": "199000",
    "x-complexity": "3",
    "retry-after": "2",
  });
  const parsed = parseRateHeaders(h);
  assert.equal(parsed.requestsRemaining, 2400);
  assert.equal(parsed.complexityRemaining, 199000);
  assert.equal(parsed.complexity, 3);
  assert.equal(parsed.retryAfterMs, 2000);
});

test("regression(1): mutation WITHOUT the flag is not retried (doc-derived default)", async () => {
  let attempts = 0;
  const fetchImpl = (async () => {
    attempts++;
    return fakeResponse(500, { error: "boom" });
  }) as typeof fetch;
  const client = new LinearClient({
    transport: new HttpTransport({
      credential: { kind: "pat", token: "lin_api_x" },
      fetchImpl,
    }),
  });
  await assert.rejects(() =>
    client.request("mutation C { commentCreate(input: {}) { success } }"),
  );
  assert.equal(attempts, 1); // doc-derived: mutation => not idempotent => 1 attempt
});

test("regression(2): HTTP 400 + RATELIMITED graphql code is retried, then succeeds", async () => {
  let attempts = 0;
  const fetchImpl = (async () => {
    attempts++;
    if (attempts === 1) {
      return fakeResponse(400, {
        errors: [{ message: "Rate limit exceeded", extensions: { code: "RATELIMITED" } }],
      });
    }
    return fakeResponse(200, { data: { ok: true } });
  }) as typeof fetch;
  const client = new LinearClient({
    transport: new HttpTransport({
      credential: { kind: "pat", token: "lin_api_x" },
      fetchImpl,
    }),
  });
  const data = await client.request<{ ok: boolean }>("query Q { viewer { id } }");
  assert.equal(data.ok, true);
  assert.equal(attempts, 2);
});

test("regression(3): x-ratelimit-requests-reset (epoch ms) becomes a wait floor", () => {
  const resetAt = Date.now() + 60_000;
  const h = new Headers({ "x-ratelimit-requests-reset": String(resetAt) });
  const parsed = parseRateHeaders(h);
  assert.equal(parsed.requestsResetAt, resetAt);
  const wait = rateLimitWaitMs(parsed);
  assert.ok(wait !== undefined && wait > 55_000 && wait <= 60_000);
  // Retry-After wins over the reset window when both exist
  const both = parseRateHeaders(new Headers({
    "x-ratelimit-requests-reset": String(resetAt),
    "retry-after": "5",
  }));
  assert.equal(rateLimitWaitMs(both), 5000);
});

