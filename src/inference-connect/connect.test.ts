/** IN4: the T3 Code Connect adapter. Injected channel, so no socket. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { isSecureChannelUrl, makeConnectProvider, type Channel, type Dial } from "./connect.ts";

/** A scripted channel: records calls, replies per method, or rejects with a code. */
function channel(script: Record<string, unknown | (() => never)>) {
  const calls: { method: string; params: unknown }[] = [];
  const ch: Channel = {
    async call<T>(method: string, params?: unknown): Promise<T> {
      calls.push({ method, params });
      const r = script[method];
      if (typeof r === `function`) return (r as () => never)();
      return r as T;
    },
    close() {},
  };
  return { ch, calls };
}

const rpcErr = (code: string, message = code) => (): never => {
  const e = new Error(message) as Error & { code?: string };
  e.code = code;
  throw e;
};

const dialTo = (ch: Channel): Dial => async () => ch;
const provider = (dial: Dial, over: Partial<Parameters<typeof makeConnectProvider>[0]> = {}) =>
  makeConnectProvider({ url: `wss://connect.example/ws`, token: `tok-1234`, dial, ...over });

test(`a non-wss URL is REFUSED at construction, not warned about`, () => {
  const { ch } = channel({});
  assert.throws(() => provider(dialTo(ch), { url: `ws://connect.example/ws` }), /must be wss:/);
  assert.throws(() => provider(dialTo(ch), { url: `https://connect.example/` }), /must be wss:/);
  assert.throws(() => provider(dialTo(ch), { url: `not a url` }), /must be wss:/);
  assert.doesNotThrow(() => provider(dialTo(ch)));
});

test(`isSecureChannelUrl is exported for the settings form to refuse early`, () => {
  assert.equal(isSecureChannelUrl(`wss://x.example/ws`), true);
  assert.equal(isSecureChannelUrl(`ws://x.example/ws`), false);
  assert.equal(isSecureChannelUrl(``), false);
});

test(`no token means unconfigured — and the channel is never dialled`, async () => {
  let dialled = 0;
  const dial: Dial = async () => { dialled++; return channel({}).ch; };
  const got = await makeConnectProvider({ url: `wss://x.example/ws`, dial }).models();
  assert.equal(got.ok === false && got.error.kind, `unconfigured`);
  assert.equal(dialled, 0, `must not open a socket without a token`);
});

test(`the channel is dialled once with the url and token, then reused`, async () => {
  const { ch } = channel({ "inference.models": [{ id: `m` }] });
  const dials: [string, string][] = [];
  const dial: Dial = async (url, token) => { dials.push([url, token]); return ch; };
  const p = provider(dial);
  await p.models();
  await p.models();
  assert.deepEqual(dials, [[`wss://connect.example/ws`, `tok-1234`]], `exactly one dial`);
});

test(`models maps id/label/contextTokens and claims tools ONLY when the channel says so`, async () => {
  const { ch } = channel({ "inference.models": { models: [
    { id: `a`, label: `A`, contextTokens: 200000, tools: true },
    { id: `b` },
  ] } });
  const got = await provider(dialTo(ch)).models();
  assert.ok(got.ok);
  if (got.ok) {
    assert.deepEqual(got.value[0], { id: `a`, label: `A`, contextTokens: 200000, tools: true });
    assert.deepEqual(got.value[1], { id: `b`, label: `b`, tools: false });
  }
});

test(`RPC error codes map onto the shared kinds with IN2's fallback semantics`, async () => {
  const kind = async (code: string) => {
    const { ch } = channel({ "inference.models": rpcErr(code) });
    const got = await provider(dialTo(ch)).models();
    return got.ok ? `ok` : got.error.kind;
  };
  assert.equal(await kind(`unauthorized`), `unconfigured`);
  assert.equal(await kind(`rate_limited`), `rateLimited`);
  assert.equal(await kind(`internal`), `unavailable`);
  // Request-shaped problems must NOT let the registry shop the call around.
  assert.equal(await kind(`invalid_params`), `rejected`);
  assert.equal(await kind(`method_not_found`), `rejected`);
  assert.equal(await kind(`loop_disabled`), `rejected`);
});

test(`a socket failure (no code) is unavailable AND drops the channel so the next call re-dials`, async () => {
  let dials = 0;
  const bad: Channel = { async call() { throw new Error(`socket closed`); }, close() {} };
  const good = channel({ "inference.models": [] }).ch;
  const dial: Dial = async () => (++dials === 1 ? bad : good);
  const p = provider(dial);
  const first = await p.models();
  assert.equal(first.ok === false && first.error.kind, `unavailable`);
  const second = await p.models();
  assert.ok(second.ok, `must recover on the next call`);
  assert.equal(dials, 2, `one re-dial after the drop`);
});

test(`chat sends our request shape and maps the channel's reply onto ChatResult`, async () => {
  const { ch, calls } = channel({ "inference.chat": {
    content: `hello`, usage: { inputTokens: 12, outputTokens: 3 }, stop: `length`,
  } });
  const got = await provider(dialTo(ch)).chat({ model: `m`, messages: [{ role: `user`, content: `hi` }], maxTokens: 50 });
  assert.deepEqual(calls[0]?.method, `inference.chat`);
  assert.deepEqual(calls[0]?.params, { model: `m`, messages: [{ role: `user`, content: `hi` }], maxTokens: 50 });
  assert.ok(got.ok);
  if (got.ok) assert.deepEqual(got.value, { content: `hello`, usage: { inputTokens: 12, outputTokens: 3 }, stop: `length` });
});

test(`an unrecognised stop value becomes "end"; a reply with no content is rejected`, async () => {
  const a = channel({ "inference.chat": { content: `x`, stop: `weird` } }).ch;
  const got = await provider(dialTo(a)).chat({ model: `m`, messages: [] });
  assert.equal(got.ok && got.value.stop, `end`);
  const b = channel({ "inference.chat": { usage: {} } }).ch;
  const none = await provider(dialTo(b)).chat({ model: `m`, messages: [] });
  assert.equal(none.ok === false && none.error.kind, `rejected`);
});

test(`credential() is pairing presence plus the environment label — no key exists to leak`, () => {
  const { ch } = channel({});
  assert.deepEqual(provider(dialTo(ch), { environment: `tj-laptop` }).credential(), { configured: true, hint: `tj-laptop` });
  assert.deepEqual(makeConnectProvider({ url: `wss://x.example/ws`, dial: dialTo(ch) }).credential(), { configured: false });
});
