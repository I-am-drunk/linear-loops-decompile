import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLoopsServer } from "./index.ts";
import { RpcClient } from "../connect/client.ts";

async function boot() {
  const dir = await mkdtemp(join(tmpdir(), "loops-test-"));
  const server = createLoopsServer({ dbPath: join(dir, "test.db"), token: "test-token" });
  await new Promise<void>((r) => server.http.listen(0, r));
  return { server, dir };
}

test("store: settings round-trip + append-only audit", async () => {
  const { server, dir } = await boot();
  try {
    server.store.setSetting("k", "v1");
    server.store.setSetting("k", "v2");
    assert.equal(server.store.getSetting("k"), "v2");
    server.store.audit("test.event", { n: 1 });
    const tail = server.store.auditTail(10);
    assert.equal(tail[0].kind, "test.event");
    assert.deepEqual(JSON.parse(tail[0].json), { n: 1 });
    assert.ok(tail.some((e) => e.kind === "server.boot"));
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("http: health + environment descriptor + SPA fallback", async () => {
  const { server, dir } = await boot();
  try {
    const base = `http://127.0.0.1:${server.port()}`;
    const health = await (await fetch(`${base}/health`)).json();
    assert.deepEqual(health, { ok: true });

    const env = await (await fetch(`${base}/.well-known/t3/environment`)).json();
    assert.equal(env.product, "loops-server");
    assert.equal(env.protocol, 1);
    assert.ok(env.capabilities.includes("loops"));

    const page = await (await fetch(`${base}/loops`)).text();
    assert.match(page, /loops-server/);
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("rpc: env.describe over the real channel; bad token rejected", async () => {
  const { server, dir } = await boot();
  try {
    const client = await RpcClient.connect(`ws://127.0.0.1:${server.port()}/ws`, "test-token");
    const env = await client.call<{ product: string }>("env.describe");
    assert.equal(env.product, "loops-server");
    client.close();

    await assert.rejects(RpcClient.connect(`ws://127.0.0.1:${server.port()}/ws`, "nope", 2000));
  } finally {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("token persists across reboots of the same db", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loops-test-"));
  try {
    const a = createLoopsServer({ dbPath: join(dir, "test.db") });
    const tokenA = a.token;
    await a.close();
    const b = createLoopsServer({ dbPath: join(dir, "test.db") });
    assert.equal(b.token, tokenA);
    await b.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
