/** IN3: the Anthropic adapter. Injected fetch, so no network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeRegistry } from "../inference/registry.ts";
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

test(`unsafe endpoints are refused before every network operation`, async () => {
  for (const baseUrl of [`http://proxy.example`, `not a URL`, `ftp://proxy.example`,
    `https://user:password@proxy.example`, `https://proxy.example?query=1`, `https://proxy.example#fragment`]) {
    const s = stub({ body: `{"data":[]}` });
    const p = provider({ baseUrl, fetchImpl: s.fetchImpl });
    for (const result of await Promise.all([p.models(), p.reachable(), p.chat({ model: `m`, messages: [] })])) {
      assert.deepEqual(result, { ok: false, error: { kind: `unconfigured`, provider: p.id } });
    }
    assert.deepEqual(s.calls, []);
  }
});

const interruptedResponse = (status = 200): Response => new Response(new ReadableStream({
  start(controller) { controller.error(new Error(`connection reset`)); },
}), { status });

test(`interrupted successful bodies are typed failures for all network operations`, async () => {
  const p = provider({ fetchImpl: async () => interruptedResponse() });
  for (const result of await Promise.all([p.models(), p.reachable(), p.chat({ model: `m`, messages: [] })])) {
    assert.equal(result.ok === false && result.error.kind, `unavailable`);
  }
});

test(`interrupted error bodies preserve the known HTTP failure kind`, async () => {
  const cases = [[400, `rejected`], [401, `unconfigured`], [403, `unconfigured`], [429, `rateLimited`],
    [502, `unavailable`], [529, `unavailable`]] as const;
  for (const [status, kind] of cases) {
    const got = await provider({ fetchImpl: async () => interruptedResponse(status) }).reachable();
    assert.equal(got.ok === false && got.error.kind, kind);
  }
});

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

test(`invalid model responses do not claim reachability or block a healthy fallback`, async () => {
  for (const response of [() => new Response(`<html>Sign in</html>`), () => Response.json({}),
    () => Response.json({ data: [null, { id: 1 }] }), () => interruptedResponse()]) {
    const p = provider({ id: `bad`, fetchImpl: async () => response() });
    const got = await p.reachable();
    assert.equal(got.ok === false && got.error.kind, `unavailable`);
    const registry = makeRegistry();
    registry.register(p);
    registry.register(provider({ id: `good`, fetchImpl: stub({ body: `{"data":[{"id":"m"}]}` }).fetchImpl }));
    const resolved = await registry.resolve([`bad`, `good`]);
    assert.equal(resolved.ok && resolved.value.id, `good`);
  }
});

test(`models follows documented cursors and retains every page`, async () => {
  const calls: string[] = [];
  const p = provider({ fetchImpl: async (url) => {
    calls.push(url);
    return calls.length === 1
      ? Response.json({ data: [{ id: `model/one`, display_name: `One` }], has_more: true, last_id: `model/one` })
      : Response.json({ data: [{ id: `two` }], has_more: false, last_id: `two` });
  } });
  assert.deepEqual(await p.models(), { ok: true, value: [{ id: `model/one`, label: `One` }, { id: `two`, label: `two` }] });
  assert.deepEqual(calls, [`https://api.anthropic.com/v1/models`, `https://api.anthropic.com/v1/models?after_id=model%2Fone`]);
});

test(`malformed or cyclic pagination fails instead of returning a partial catalog`, async () => {
  const pages = [
    { data: [{ id: `one` }], has_more: true },
    { data: [], has_more: true, last_id: `one` },
    { data: [{ id: `one` }], has_more: true, last_id: String.fromCharCode(0xd800) },
    { data: [{ id: `one` }], has_more: `yes`, last_id: `one` },
    { data: [{ id: `one` }], has_more: true, last_id: `one` },
  ];
  for (const page of pages) {
    let calls = 0;
    const got = await provider({ fetchImpl: async () => {
      assert.ok(++calls <= 2, `pagination must terminate`);
      return Response.json(page);
    } }).models();
    assert.equal(got.ok === false && got.error.kind, `unavailable`);
    assert.ok(calls <= 2, `pagination must terminate`);
  }
});

const CHAT_OK = JSON.stringify({
  content: [{ type: `text`, text: `hel` }, { type: `text`, text: `lo` }],
  stop_reason: `end_turn`,
  usage: { input_tokens: 12, output_tokens: 3 },
});

const PRICED = { pricing: { m: { inputPerMTok: 3, outputPerMTok: 15 } } };

test(`missing, invalid and unrepresentable cached usage cannot become known zero cost`, async () => {
  const usages = [undefined, {}, { input_tokens: 12 }, { output_tokens: 3 },
    { input_tokens: -1, output_tokens: 3 }, { input_tokens: 1.5, output_tokens: 3 },
    { input_tokens: 1, output_tokens: Number.MAX_SAFE_INTEGER + 1 },
    { input_tokens: `12`, output_tokens: 3 },
    { input_tokens: 12, output_tokens: 3, cache_creation_input_tokens: 1000 },
    { input_tokens: 12, output_tokens: 3, cache_read_input_tokens: 1000 }];
  for (const usage of usages) {
    const p = provider({ ...PRICED, fetchImpl: async () => Response.json({ ...JSON.parse(CHAT_OK), usage }) });
    const got = await p.chat({ model: `m`, messages: [] });
    assert.ok(got.ok);
    if (got.ok) {
      assert.equal(got.value.content, `hello`);
      assert.equal(got.value.usage.known, false);
      assert.deepEqual(p.cost(`m`, got.value.usage), { known: false, cents: 0 });
    }
  }
});

test(`measured zero usage stays known while invalid or explicitly unknown counts cannot be priced`, async () => {
  const p = provider({ ...PRICED, fetchImpl: async () => Response.json({ ...JSON.parse(CHAT_OK),
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: null },
  }) });
  const got = await p.chat({ model: `m`, messages: [] });
  assert.ok(got.ok);
  if (got.ok) {
    assert.deepEqual(got.value.usage, { inputTokens: 0, outputTokens: 0 });
    assert.deepEqual(p.cost(`m`, got.value.usage), { known: true, cents: 0 });
  }
  for (const usage of [{ inputTokens: 100, outputTokens: 100, known: false },
    { inputTokens: -1, outputTokens: 0 }, { inputTokens: 0, outputTokens: NaN }]) {
    assert.deepEqual(p.cost(`m`, usage), { known: false, cents: 0 });
  }
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
  await provider({ fetchImpl: s.fetchImpl }).chat({ model: `m`, messages: [], maxTokens: 73 });
  const sent = JSON.parse(s.calls[0]?.body ?? `{}`) as { max_tokens?: number };
  assert.equal(sent.max_tokens, 1024);
  assert.equal(JSON.parse(s.calls[1]?.body ?? `{}`).max_tokens, 73);
  assert.equal(s.calls[0]?.url, `https://api.anthropic.com/v1/messages`);
});

test(`chat concatenates text blocks and maps usage and stop_reason onto the shared enum`, async () => {
  const got = await provider({ fetchImpl: stub({ body: CHAT_OK }).fetchImpl })
    .chat({ model: `m`, messages: [{ role: `user`, content: `hi` }] });
  assert.ok(got.ok);
  if (got.ok) assert.deepEqual(got.value, { content: `hello`, usage: { inputTokens: 12, outputTokens: 3 }, stop: `end` });
});

test(`documented stop reasons retain completion, refusal and both truncation cases`, async () => {
  const cases = [[`end_turn`, `end`], [`stop_sequence`, `end`], [`refusal`, `refusal`],
    [`max_tokens`, `length`], [`model_context_window_exceeded`, `length`]];
  for (const [stop_reason, stop] of cases) {
    const p = provider({ fetchImpl: async () => Response.json({ ...JSON.parse(CHAT_OK), stop_reason }) });
    const got = await p.chat({ model: `m`, messages: [] });
    assert.equal(got.ok && got.value.stop, stop);
  }
});

test(`paused, missing and unknown stop reasons never claim a complete turn`, async () => {
  for (const stop_reason of [`pause_turn`, `future_reason`, undefined, null]) {
    const p = provider({ fetchImpl: async () => Response.json({ ...JSON.parse(CHAT_OK), stop_reason }) });
    const got = await p.chat({ model: `m`, messages: [] });
    assert.equal(got.ok === false && got.error.kind, `rejected`);
  }
});

test(`malformed or unsupported blocks cannot hide behind accompanying text`, async () => {
  for (const block of [null, { type: `text`, text: 4 }, { type: `image` }, { type: `future_tool` }]) {
    for (const content of [[block], [{ type: `text`, text: `Partial` }, block]]) {
      const p = provider({ fetchImpl: async () => Response.json({ ...JSON.parse(CHAT_OK), content }) });
      const got = await p.chat({ model: `m`, messages: [] });
      assert.equal(got.ok === false && got.error.kind, `rejected`);
    }
  }
});

test(`thinking alone is rejected; final text and explicitly empty text remain valid`, async () => {
  for (const type of [`thinking`, `redacted_thinking`]) {
    for (const content of [[{ type }], [{ type }, { type: `text`, text: `` }]]) {
      const p = provider({ fetchImpl: async () => Response.json({ ...JSON.parse(CHAT_OK), content }) });
      const got = await p.chat({ model: `m`, messages: [] });
      assert.equal(got.ok, content.length === 2);
      if (got.ok) assert.equal(got.value.content, ``);
    }
  }
});

test(`stop_reason max_tokens is surfaced as "length" — vendor names never leak`, async () => {
  const body = JSON.stringify({ content: [{ type: `text`, text: `half a` }], stop_reason: `max_tokens` });
  const got = await provider({ fetchImpl: stub({ body }).fetchImpl }).chat({ model: `m`, messages: [] });
  assert.equal(got.ok && got.value.stop, `length`);
});

test(`a reply with no content blocks is "rejected", not a crash`, async () => {
  const got = await provider({ fetchImpl: stub({ body: `{"content":[],"stop_reason":"end_turn"}` }).fetchImpl }).chat({ model: `m`, messages: [] });
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

test(`short keys have no hint and failure details redact keys before truncating`, async () => {
  for (const apiKey of [`a`, `ab`, `abc`, `abcd`]) {
    assert.deepEqual(provider({ apiKey, fetchImpl: stub({}).fetchImpl }).credential(), { configured: true });
  }
  const apiKey = `test-secret.*[12345678]`;
  const message = `Invalid key: ${apiKey}; repeated ${apiKey}`;
  const transports: FetchLike[] = [
    async () => { throw new Error(message); },
    async () => new Response(new ReadableStream({ start(c) { c.error(new Error(message)); } })),
    async () => Response.json({ error: { message } }, { status: 400 }),
    async () => new Response(`<html>${message}</html>`, { status: 503 }),
    async () => Response.json({ error: { message: message.repeat(20) } }, { status: 500 }),
  ];
  for (const fetchImpl of transports) {
    const got = await provider({ apiKey, fetchImpl }).models();
    assert.ok(!got.ok && `detail` in got.error);
    if (!got.ok && `detail` in got.error) {
      assert.ok(!got.error.detail.includes(apiKey));
      assert.ok(got.error.detail.includes(`[redacted]`));
      assert.ok(got.error.detail.length <= 200);
    }
  }
  const got = await provider({ apiKey, fetchImpl: async () => new Response(`x`.repeat(190) + apiKey, { status: 500 }) }).models();
  assert.ok(!got.ok && `detail` in got.error);
  if (!got.ok && `detail` in got.error) assert.ok(!got.error.detail.includes(`test-secret`));
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
