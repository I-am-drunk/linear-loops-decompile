/** IN3: the Anthropic adapter. Injected fetch, so no network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { ANTHROPIC_VERSION, makeAnthropicProvider } from "./anthropic.ts";
import type { FetchLike } from "../inference-openai/openai.ts";

type Scripted = { ok?: boolean; status?: number; body?: string };

/** A fetch that records calls (url, method, headers, body) and replays one response. */
function stub(res: Scripted | (() => never)) {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method ?? `GET`, headers: init?.headers ?? {}, ...(init?.body === undefined ? {} : { body: init.body }) });
    if (typeof res === `function`) return res();
    const r: Scripted = res;
    return { ok: r.ok ?? true, status: r.status ?? 200, text: async () => r.body ?? `{}` };
  };
  return { fetchImpl, calls };
}

const provider = (over: Partial<Parameters<typeof makeAnthropicProvider>[0]> & { fetchImpl: FetchLike }) =>
  makeAnthropicProvider({ apiKey: `sk-ant-test-1234`, ...over });

test(`auth is x-api-key plus anthropic-version — never a bearer`, async () => {
  const s = stub({ body: `{"data":[]}` });
  await provider({ fetchImpl: s.fetchImpl }).models();
  const h = s.calls[0]?.headers ?? {};
  assert.equal(h[`x-api-key`], `sk-ant-test-1234`);
  assert.equal(h[`anthropic-version`], ANTHROPIC_VERSION);
  assert.ok(!(`authorization` in h), `must not send a bearer`);
});

test(`no apiKey means no x-api-key header at all`, async () => {
  const s = stub({ body: `{"data":[]}` });
  await makeAnthropicProvider({ fetchImpl: s.fetchImpl }).models();
  assert.ok(!(`x-api-key` in (s.calls[0]?.headers ?? {})));
});

test(`default base is the public API root; a custom one is honoured without a double slash`, async () => {
  const a = stub({ body: `{"data":[]}` });
  await provider({ fetchImpl: a.fetchImpl }).models();
  assert.equal(a.calls[0]?.url, `https://api.anthropic.com/v1/models`);
  const b = stub({ body: `{"data":[]}` });
  await provider({ fetchImpl: b.fetchImpl, baseUrl: `https://proxy.example/anthropic///` }).models();
  assert.equal(b.calls[0]?.url, `https://proxy.example/anthropic/v1/models`);
});

test(`models uses display_name as the label when present, falls back to id`, async () => {
  const s = stub({ body: `{"data":[{"id":"claude-x","display_name":"Claude X"},{"id":"claude-y"}]}` });
  const got = await provider({ fetchImpl: s.fetchImpl }).models();
  assert.ok(got.ok);
  if (got.ok) {
    assert.deepEqual(got.value.map((m) => [m.id, m.label]), [[`claude-x`, `Claude X`], [`claude-y`, `claude-y`]]);
    assert.ok(got.value.every((m) => !(`tools` in m)), `the text-only contract omits tool capabilities`);
  }
});

test(`status mapping matches IN2: 429 rateLimited, 401 unconfigured, 5xx unavailable, other 4xx rejected`, async () => {
  const kind = async (status: number) => {
    const got = await provider({ fetchImpl: stub({ ok: false, status, body: `{"error":{"message":"x"}}` }).fetchImpl }).models();
    return got.ok ? `ok` : got.error.kind;
  };
  assert.equal(await kind(429), `rateLimited`);
  assert.equal(await kind(401), `unconfigured`);
  assert.equal(await kind(503), `unavailable`);
  // Anthropic's "overloaded" status; >= 500 so a fallback MAY be tried.
  assert.equal(await kind(529), `unavailable`);
  assert.equal(await kind(400), `rejected`);
});

const CHAT_OK = JSON.stringify({
  content: [{ type: `text`, text: `hel` }, { type: `text`, text: `lo` }],
  stop_reason: `end_turn`,
  usage: { input_tokens: 12, output_tokens: 3 },
});

test(`system messages are lifted to the top-level field — a system role in the list is a 400`, async () => {
  const s = stub({ body: CHAT_OK });
  await provider({ fetchImpl: s.fetchImpl }).chat({
    model: `m`,
    messages: [{ role: `system`, content: `Be terse.` }, { role: `user`, content: `hi` }, { role: `system`, content: `In English.` }],
  });
  const sent = JSON.parse(s.calls[0]?.body ?? `{}`) as { system?: string; messages: { role: string }[] };
  assert.equal(sent.system, `Be terse.\n\nIn English.`);
  assert.deepEqual(sent.messages.map((m) => m.role), [`user`], `no system role may remain in the list`);
});

test(`max_tokens is always sent — the Messages API requires it`, async () => {
  const s = stub({ body: CHAT_OK });
  await provider({ fetchImpl: s.fetchImpl }).chat({ model: `m`, messages: [{ role: `user`, content: `hi` }] });
  const sent = JSON.parse(s.calls[0]?.body ?? `{}`) as { max_tokens?: number };
  assert.equal(typeof sent.max_tokens, `number`);
  assert.equal(s.calls[0]?.url, `https://api.anthropic.com/v1/messages`);
});

test(`chat concatenates text blocks and maps usage and stop_reason onto the shared enum`, async () => {
  const got = await provider({ fetchImpl: stub({ body: CHAT_OK }).fetchImpl })
    .chat({ model: `m`, messages: [{ role: `user`, content: `hi` }] });
  assert.ok(got.ok);
  if (got.ok) assert.deepEqual(got.value, { content: `hello`, usage: { inputTokens: 12, outputTokens: 3 }, stop: `end` });
});

test(`stop_reason max_tokens is surfaced as "length" — vendor names never leak`, async () => {
  const body = JSON.stringify({ content: [{ type: `text`, text: `half a` }], stop_reason: `max_tokens` });
  const got = await provider({ fetchImpl: stub({ body }).fetchImpl }).chat({ model: `m`, messages: [] });
  assert.equal(got.ok && got.value.stop, `length`);
});

test(`a reply with no content blocks is "rejected", not a crash`, async () => {
  const got = await provider({ fetchImpl: stub({ body: `{"content":[]}` }).fetchImpl }).chat({ model: `m`, messages: [] });
  assert.equal(got.ok === false && got.error.kind, `rejected`);
});

test(`a thrown fetch is "unavailable"; credential() exposes the last four only`, async () => {
  const s = stub(() => { throw new TypeError(`fetch failed: ENOTFOUND`); });
  const got = await provider({ fetchImpl: s.fetchImpl }).reachable();
  assert.equal(got.ok === false && got.error.kind, `unavailable`);
  const c = provider({ fetchImpl: stub({}).fetchImpl, apiKey: `sk-ant-SECRETBODY-9876` }).credential();
  assert.deepEqual(c, { configured: true, hint: `…9876` });
  assert.ok(!JSON.stringify(c).includes(`SECRETBODY`));
});

test(`cost() is integral cents; estimate() hits no network and uses 1024 when maxTokens is absent`, () => {
  const s = stub({});
  const p = provider({ fetchImpl: s.fetchImpl, pricing: { m: { inputPerMTok: 3, outputPerMTok: 15 } } });
  assert.deepEqual(p.cost(`m`, { inputTokens: 1_000_000, outputTokens: 100_000 }), { cents: 450, known: true });
  const est = p.estimate({ model: `m`, messages: [{ role: `user`, content: `x`.repeat(4_000_000) }] });
  assert.deepEqual(s.calls, [], `estimate must not call fetch`);
  // 1M input @ $3 = 300c; default 1024 output @ $15 ≈ 1.5c -> 2c rounded.
  assert.deepEqual(est, { cents: 302, known: true });
});

test(`a tool stop reason is rejected even with text or no content`, async () => {
  for (const content of [[], [{ type: `text`, text: `I will call a tool.` }]]) {
    const body = JSON.stringify({ content, stop_reason: `tool_use` });
    const got = await provider({ id: `test-provider`, fetchImpl: stub({ body }).fetchImpl })
      .chat({ model: `m`, messages: [] });
    assert.equal(got.ok, false);
    if (!got.ok) {
      assert.equal(got.error.kind, `rejected`);
      assert.equal(got.error.provider, `test-provider`);
    }
  }
});

test(`tool blocks are rejected before extracting any accompanying text`, async () => {
  for (const type of [`tool_use`, `server_tool_use`]) {
    const tool = { type, id: `tool-1`, name: `lookup`, input: {} };
    for (const content of [[tool], [{ type: `text`, text: `Checking.` }, tool]]) {
      const body = JSON.stringify({ content, stop_reason: `end_turn` });
      const got = await provider({ fetchImpl: stub({ body }).fetchImpl }).chat({ model: `m`, messages: [] });
      assert.equal(got.ok === false && got.error.kind, `rejected`);
    }
  }
});
