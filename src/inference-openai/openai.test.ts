/** IN2: the OpenAI-compatible adapter. Injected fetch, so no network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeOpenAiProvider, type FetchLike } from "./openai.ts";

/** A fetch that records its calls and replays a scripted response. */
type Scripted = { ok?: boolean; status?: number; body?: string };

function stub(res: Scripted | (() => never)) {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push(`${init?.method ?? `GET`} ${url}`);
    // Narrow explicitly: TS does not narrow a captured union through a
    // `never`-returning call, so `res.ok` below was a type error.
    if (typeof res === `function`) return res();
    const r: Scripted = res;
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      text: async () => r.body ?? `{}`,
    };
  };
  return { fetchImpl, calls };
}

const provider = (over: Partial<Parameters<typeof makeOpenAiProvider>[0]> & { fetchImpl: FetchLike }) =>
  makeOpenAiProvider({ baseUrl: `https://api.example.com/v1`, ...over });

test(`a trailing slash in baseUrl does not produce a double slash`, async () => {
  const s = stub({ body: `{"data":[]}` });
  await provider({ baseUrl: `https://api.example.com/v1///`, fetchImpl: s.fetchImpl }).models();
  // Some gateways 404 on `//models`.
  assert.deepEqual(s.calls, [`GET https://api.example.com/v1/models`]);
});

test(`models maps id, label and context length`, async () => {
  const s = stub({ body: `{"data":[{"id":"m","context_length":8192},{"id":"n"}]}` });
  const got = await provider({ fetchImpl: s.fetchImpl }).models();
  assert.equal(got.ok, true);
  if (got.ok) {
    assert.deepEqual(got.value[0], { id: `m`, label: `m`, contextTokens: 8192 });
    // No context_length declared -> the key is absent, not 0.
    assert.ok(!(`contextTokens` in (got.value[1] ?? {})));
  }
});

test(`the text-only model contract omits tool capabilities`, async () => {
  const s = stub({ body: `{"data":[{"id":"m"}]}` });
  const got = await provider({ fetchImpl: s.fetchImpl }).models();
  assert.ok(got.ok);
  if (got.ok) assert.deepEqual(got.value, [{ id: `m`, label: `m` }]);
});

test(`HTML from a proxy becomes a typed failure, not a thrown SyntaxError`, async () => {
  const s = stub({ ok: false, status: 502, body: `<html>Bad Gateway</html>` });
  const got = await provider({ fetchImpl: s.fetchImpl }).models();
  assert.equal(got.ok, false);
  if (!got.ok) {
    assert.equal(got.error.kind, `unavailable`);
    assert.match(got.error.kind === `unavailable` ? got.error.detail : ``, /HTTP 502/);
  }
});

test(`5xx is "unavailable" so the registry MAY try a fallback`, async () => {
  const s = stub({ ok: false, status: 503 });
  const got = await provider({ fetchImpl: s.fetchImpl }).models();
  assert.equal(got.ok === false && got.error.kind, `unavailable`);
});

test(`4xx is "rejected" so the registry must NOT shop it around`, async () => {
  const s = stub({ ok: false, status: 400, body: `{"error":{"message":"bad model"}}` });
  const got = await provider({ fetchImpl: s.fetchImpl }).models();
  assert.equal(got.ok === false && got.error.kind, `rejected`);
});

test(`429 is rateLimited and 401/403 is unconfigured`, async () => {
  const limited = await provider({ fetchImpl: stub({ ok: false, status: 429 }).fetchImpl }).models();
  assert.equal(limited.ok === false && limited.error.kind, `rateLimited`);
  const denied = await provider({ fetchImpl: stub({ ok: false, status: 401 }).fetchImpl }).models();
  assert.equal(denied.ok === false && denied.error.kind, `unconfigured`);
});

test(`a thrown fetch (DNS, refused, TLS) is "unavailable", never an unhandled rejection`, async () => {
  const s = stub(() => { throw new TypeError(`fetch failed: ECONNREFUSED`); });
  const got = await provider({ fetchImpl: s.fetchImpl }).reachable();
  assert.equal(got.ok, false);
  if (!got.ok) {
    assert.equal(got.error.kind, `unavailable`);
    assert.match(got.error.kind === `unavailable` ? got.error.detail : ``, /ECONNREFUSED/);
  }
});

const CHAT_OK = JSON.stringify({
  choices: [{ message: { content: `hello` }, finish_reason: `stop` }],
  usage: { prompt_tokens: 12, completion_tokens: 3 },
});

test(`chat POSTs the OpenAI body shape and maps the reply`, async () => {
  const s = stub({ body: CHAT_OK });
  const got = await provider({ fetchImpl: s.fetchImpl }).chat({
    model: `m`, messages: [{ role: `user`, content: `hi` }], maxTokens: 50, temperature: 0.2,
  });
  assert.deepEqual(s.calls, [`POST https://api.example.com/v1/chat/completions`]);
  assert.equal(got.ok, true);
  if (got.ok) {
    assert.deepEqual(got.value, {
      content: `hello`, usage: { inputTokens: 12, outputTokens: 3 }, stop: `end`,
    });
  }
});

test(`finish_reason "length" is surfaced — a truncated answer is not a complete one`, async () => {
  const body = JSON.stringify({ choices: [{ message: { content: `half a` }, finish_reason: `length` }] });
  const got = await provider({ fetchImpl: stub({ body }).fetchImpl })
    .chat({ model: `m`, messages: [] });
  assert.equal(got.ok && got.value.stop, `length`);
});

test(`a reply with no message content is "rejected", not a crash on undefined`, async () => {
  const body = JSON.stringify({ choices: [{ message: {}, finish_reason: `stop` }] });
  const got = await provider({ fetchImpl: stub({ body }).fetchImpl }).chat({ model: `m`, messages: [] });
  assert.equal(got.ok === false && got.error.kind, `rejected`);
});

const PRICED = { pricing: { m: { inputPerMTok: 3, outputPerMTok: 15 } } };

test(`cost() is integral cents from real usage; unknown models say so`, () => {
  const p = provider({ fetchImpl: stub({}).fetchImpl, ...PRICED });
  // 1M in @ $3 = 300c; 100k out @ $15 = 150c. Cents, never fractional dollars.
  assert.deepEqual(p.cost(`m`, { inputTokens: 1_000_000, outputTokens: 100_000 }), { cents: 450, known: true });
  assert.deepEqual(p.cost(`unpriced`, { inputTokens: 1_000_000, outputTokens: 0 }), { cents: 0, known: false });
});

test(`estimate() hits no network and uses maxTokens as the output bound`, () => {
  const s = stub({});
  const p = provider({ fetchImpl: s.fetchImpl, ...PRICED });
  const est = p.estimate({ model: `m`, messages: [{ role: `user`, content: `x`.repeat(4_000_000) }], maxTokens: 100_000 });
  assert.deepEqual(s.calls, [], `estimate must not call fetch`);
  // 4M chars / 4 = 1M input tokens -> 300c; 100k output -> 150c.
  assert.deepEqual(est, { cents: 450, known: true });
});

test(`credential() exposes presence and the last four, never the key`, () => {
  const p = provider({ fetchImpl: stub({}).fetchImpl, apiKey: `sk-live-ABCDEFGH9876` });
  const c = p.credential();
  assert.deepEqual(c, { configured: true, hint: `…9876` });
  assert.ok(!JSON.stringify(c).includes(`ABCDEFGH`), `the key body leaked`);
  assert.deepEqual(provider({ fetchImpl: stub({}).fetchImpl }).credential(), { configured: false });
});

test(`no apiKey means no Authorization header at all — some servers 401 on "Bearer "`, async () => {
  let seen: Record<string, string> | undefined;
  const fetchImpl: FetchLike = async (_u, init) => { seen = init?.headers; return { ok: true, status: 200, text: async () => `{"data":[]}` }; };
  await provider({ fetchImpl }).models();
  assert.ok(seen && !(`authorization` in seen), JSON.stringify(seen));
});

test(`tool finish reasons are rejected with or without text`, async () => {
  for (const finish_reason of [`tool_calls`, `function_call`]) {
    for (const content of [null, `I will call a tool.`]) {
      const body = JSON.stringify({ choices: [{ message: { content }, finish_reason }] });
      const got = await provider({ id: `test-provider`, fetchImpl: stub({ body }).fetchImpl })
        .chat({ model: `m`, messages: [] });
      assert.equal(got.ok, false);
      if (!got.ok) {
        assert.equal(got.error.kind, `rejected`);
        assert.equal(got.error.provider, `test-provider`);
      }
    }
  }
});

test(`tool payloads cannot hide behind text and a stop finish reason`, async () => {
  const call = { name: `lookup`, arguments: `{}` };
  for (const payload of [
    { tool_calls: [{ id: `call-1`, type: `function`, function: call }] },
    { function_call: call },
  ]) {
    const body = JSON.stringify({ choices: [{
      message: { content: `I will call a tool.`, ...payload }, finish_reason: `stop`,
    }] });
    const got = await provider({ fetchImpl: stub({ body }).fetchImpl }).chat({ model: `m`, messages: [] });
    assert.equal(got.ok === false && got.error.kind, `rejected`);
  }
});

test(`empty tool metadata preserves text replies and refusal mapping`, async () => {
  for (const [finish_reason, stop] of [[`stop`, `end`], [`content_filter`, `refusal`]]) {
    const body = JSON.stringify({ choices: [{
      message: { content: `hello`, tool_calls: [], function_call: null }, finish_reason,
    }] });
    const got = await provider({ fetchImpl: stub({ body }).fetchImpl }).chat({ model: `m`, messages: [] });
    assert.equal(got.ok && got.value.stop, stop);
  }
});
