import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { makeAnthropicProvider } from "./anthropic.ts";
import type { FetchLike } from "../inference-openai/openai.ts";

test(`invalid deadlines fail configuration without dispatch`, async () => {
  for (const timeoutMs of [0, -1, 0.5, NaN, Infinity, 2_147_483_648, null as unknown as number]) {
    let calls = 0;
    const p = makeAnthropicProvider({ timeoutMs, fetchImpl: async () => {
      calls++; return Response.json({ data: [] });
    } });
    for (const got of await Promise.all([p.models(), p.reachable(), p.chat({ model: `m`, messages: [] })])) {
      assert.equal(got.ok === false && got.error.kind, `unconfigured`);
    }
    assert.equal(calls, 0);
  }
});

test(`native fetch refuses redirects instead of following another destination`, async (t) => {
  const seen: string[] = [];
  const server = createServer((req, res) => {
    seen.push(req.url ?? ``);
    if (req.url === `/v1/models`) { res.writeHead(302, { location: `/followed` }); res.end(); }
    else res.end(`{"data":[]}`);
  });
  t.after(() => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }));
  server.listen(0, `127.0.0.1`);
  await once(server, `listening`);
  const address = server.address();
  assert.ok(address && typeof address !== `string`);
  const p = makeAnthropicProvider({ baseUrl: `http://127.0.0.1:${address.port}`, fetchImpl: fetch });
  const got = await p.reachable();
  assert.equal(got.ok === false && got.error.kind, `unavailable`);
  assert.deepEqual(seen, [`/v1/models`]);
});

test(`native headers and bodies share one deadline and keep a known rejection`, { timeout: 5000 }, async (t) => {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const server = createServer((req, res) => {
    if (req.url?.startsWith(`/headers/`)) return;
    if (req.url?.startsWith(`/combined/`)) {
      timers.push(setTimeout(() => {
        res.writeHead(200, { "content-type": `application/json` });
        res.write(`{`);
        timers.push(setTimeout(() => res.end(`"data":[]}`), 120));
      }, 120));
      return;
    }
    res.writeHead(req.url?.startsWith(`/reject/`) ? 400 : 200, { "content-type": `application/json` });
    res.write(`{`);
  });
  t.after(() => new Promise<void>((resolve) => {
    for (const timer of timers) clearTimeout(timer);
    server.closeAllConnections(); server.close(() => resolve());
  }));
  server.listen(0, `127.0.0.1`);
  await once(server, `listening`);
  const address = server.address();
  assert.ok(address && typeof address !== `string`);
  for (const [mode, kind] of [[`headers`, `unavailable`], [`body`, `unavailable`],
    [`combined`, `unavailable`], [`reject`, `rejected`]]) {
    let signal: AbortSignal | undefined;
    const p = makeAnthropicProvider({ baseUrl: `http://127.0.0.1:${address.port}/${mode}`, timeoutMs: 200,
      fetchImpl: (url, init) => { signal = init?.signal; return fetch(url, init); },
    });
    const got = await p.reachable();
    assert.equal(got.ok === false && got.error.kind, kind);
    assert.equal(signal?.aborted, true);
  }
});

test(`model pagination shares a total deadline instead of resetting it per page`, { timeout: 5000 }, async (t) => {
  let requests = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const server = createServer((_req, res) => {
    const page = ++requests;
    timers.push(setTimeout(() => res.end(JSON.stringify({
      data: [{ id: String(page) }], has_more: page === 1, last_id: String(page),
    })), 250));
  });
  t.after(() => new Promise<void>((resolve) => {
    for (const timer of timers) clearTimeout(timer);
    server.closeAllConnections(); server.close(() => resolve());
  }));
  server.listen(0, `127.0.0.1`);
  await once(server, `listening`);
  const address = server.address();
  assert.ok(address && typeof address !== `string`);
  const p = makeAnthropicProvider({ baseUrl: `http://127.0.0.1:${address.port}`, timeoutMs: 400, fetchImpl: fetch });
  const got = await p.models();
  assert.equal(got.ok === false && got.error.kind, `unavailable`);
  assert.equal(requests, 2);
});

test(`successful and rejected requests clear their deadline timers`, async () => {
  const signals: AbortSignal[] = [];
  for (const status of [200, 400]) {
    const p = makeAnthropicProvider({ timeoutMs: 100, fetchImpl: async (_url, init) => {
      if (init?.signal) signals.push(init.signal);
      return Response.json({ data: [] }, { status });
    } });
    assert.equal((await p.models()).ok, status === 200);
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => !signal.aborted));
});

test(`an injected transport ignoring abort cannot keep the caller pending`, { timeout: 1000 }, async () => {
  const transports: FetchLike[] = [
    async () => new Promise(() => {}),
    async () => ({ ok: true, status: 200, text: async () => new Promise(() => {}) }),
  ];
  for (const fetchImpl of transports) {
    const p = makeAnthropicProvider({ timeoutMs: 10, fetchImpl });
    const got = await p.chat({ model: `m`, messages: [] });
    assert.equal(got.ok === false && got.error.kind, `unavailable`);
  }
});
