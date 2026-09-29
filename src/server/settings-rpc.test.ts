import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLoopsServer, type LoopsServer } from "./index.ts";
import { RpcClient } from "../connect/client.ts";

/** Fake fetch: Linear viewer probe + openrouter models probe. */
const fakeFetch: typeof fetch = (async (url: unknown, init?: { headers?: Record<string, string> }) => {
  const u = String(url);
  if (u.includes("api.linear.app/graphql")) {
    if (init?.headers?.authorization === "bad-token") {
      return new Response("Unauthorized", { status: 401 });
    }
    return new Response(JSON.stringify({
      data: {
        viewer: { id: "u1", name: "Ada", email: "ada@example.com" },
        organization: { id: "o1", name: "Acme", urlKey: "acme" },
      },
    }), { status: 200, headers: { "x-ratelimit-requests-remaining": "2490" } });
  }
  if (u.endsWith("/models")) {
    return new Response(JSON.stringify({ data: [{ id: "m1" }, { id: "m2" }] }), { status: 200 });
  }
  return new Response("not found", { status: 404 });
}) as typeof fetch;

async function boot(): Promise<{ server: LoopsServer; client: RpcClient; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "loops-settings-"));
  const server = createLoopsServer({ dbPath: join(dir, "t.db"), token: "t", fetchImpl: fakeFetch });
  await new Promise<void>((r) => server.http.listen(0, r));
  const client = await RpcClient.connect(`ws://127.0.0.1:${server.port()}/ws`, "t");
  return { server, client, dir };
}

test("settings.get starts unconfigured; secrets are never returned", async () => {
  const { server, client, dir } = await boot();
  try {
    const s0 = await client.call<{ linear: { configured: boolean }; inference: { harnesses: unknown[] } }>("settings.get");
    assert.equal(s0.linear.configured, false);
    assert.equal(s0.inference.harnesses.length, 0);

    await client.call("settings.setLinear", { token: "real-token" });
    await client.call("settings.setInference", {
      name: "main",
      input: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", model: "m1", apiKey: "secret-key" },
    });

    const s1Text = JSON.stringify(await client.call("settings.get"));
    assert.ok(!s1Text.includes("real-token"), "Linear token must never be returned");
    assert.ok(!s1Text.includes("secret-key"), "apiKey must never be returned");

    const s1 = JSON.parse(s1Text);
    assert.equal(s1.linear.configured, true);
    assert.equal(s1.linear.viewerName, "Ada");
    assert.equal(s1.linear.organization, "Acme");
    assert.equal(s1.inference.harnesses[0].configured, true);
    assert.equal(s1.inference.harnesses[0].isDefault, true);
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});

test("setLinear rejects a token Linear rejects; audit carries no secrets", async () => {
  const { server, client, dir } = await boot();
  try {
    await assert.rejects(client.call("settings.setLinear", { token: "bad-token" }), (e: Error & { code?: string }) => {
      assert.equal(e.code, "invalid_params");
      assert.match(e.message, /unauthorized/);
      return true;
    });
    const auditText = JSON.stringify(server.store.auditTail(50));
    assert.ok(!auditText.includes("bad-token"));
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});

test("credential-named extra headers are refused; duplicate names rejected", async () => {
  const { server, client, dir } = await boot();
  try {
    await client.call("settings.setInference", {
      name: "a", input: { provider: "openrouter", baseUrl: "https://x", model: "m", apiKey: "k" },
    });
    await assert.rejects(
      client.call("settings.setInference", { name: "a", input: { extraHeaders: { Authorization: "Bearer z" } } }),
      /apiKey field/,
    );
    await client.call("settings.setInference", {
      name: "b", input: { provider: "openai-compatible", baseUrl: "http://localhost:4000", model: "m", apiKey: "k2" },
    });
    await assert.rejects(
      client.call("settings.setInference", { name: "b", input: { name: "a" } }),
      /already exists/,
    );
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});

test("testInference probes the default harness; dataplane.probe reports rate budget", async () => {
  const { server, client, dir } = await boot();
  try {
    await client.call("settings.setInference", {
      name: "main", input: { provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", model: "m1", apiKey: "k" },
    });
    const probe = await client.call<{ ok: boolean; modelCount?: number }>("settings.testInference");
    assert.equal(probe.ok, true);
    assert.equal(probe.modelCount, 2);

    await assert.rejects(client.call("dataplane.probe"), /not connected/);
    await client.call("settings.setLinear", { token: "real-token" });
    const dp = await client.call<{ ok: boolean; rateLimit?: { requestsRemaining?: number } }>("dataplane.probe");
    assert.equal(dp.ok, true);
    assert.equal(dp.rateLimit?.requestsRemaining, 2490);
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});

test("dataplane.rateBudget is read-only and reflects the shared client's last headers", async () => {
  const { server, client, dir } = await boot();
  try {
    const before = await client.call<{ configured: boolean; budget: Record<string, unknown> }>("dataplane.rateBudget");
    assert.equal(before.configured, false);
    assert.deepEqual(before.budget, {}); // wired client, but no response headers seen yet

    await client.call("settings.setLinear", { token: "real-token" });
    await client.call("dataplane.probe");
    const after = await client.call<{ configured: boolean; budget: { requestsRemaining?: number } }>("dataplane.rateBudget");
    assert.equal(after.configured, true);
    assert.equal(after.budget?.requestsRemaining, 2490);
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});
