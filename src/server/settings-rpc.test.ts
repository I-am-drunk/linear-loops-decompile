/**
 * Tests for the T-606 settings.* inference RPC handlers: CRUD + default
 * rails, probe paths (saved + unpersisted draft), error mapping, and the
 * write-only secret discipline. Fixture channel + fixture fetch — no
 * network, no credentials.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { openDatabase } from "./db.ts";
import { createInferenceStores } from "./brain.ts";
import { registerSettingsRpcs, type SettingsRpcDeps } from "./settings-rpc.ts";
import type { DomainChannel } from "./rpcs.ts";

// ---- fixture channel ----------------------------------------------------------

type Handler = (params: unknown, ctx: unknown) => unknown;

function fakeChannel(): { channel: DomainChannel; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    channel: {
      register(method: string, handler: Handler): void {
        handlers.set(method, handler);
      },
    },
  };
}

function setup(overrides: Partial<SettingsRpcDeps> = {}) {
  const db = openDatabase(":memory:");
  const { harnessStore } = createInferenceStores(db, ":memory:");
  const { channel, handlers } = fakeChannel();
  registerSettingsRpcs(channel, { harnessStore, ...overrides });
  const call = (method: string, params?: unknown): Promise<unknown> =>
    // Sync throws become rejections (what the channel's error mapping sees).
    Promise.resolve().then(() => handlers.get(method)!(params, null));
  return { db, harnessStore, call };
}

const OPENROUTER_MODELS = { data: [{ id: "anthropic/claude-4", name: "Claude 4" }, { id: "openai/gpt-5" }] };

function probeFetch(calls: { url: string; headers: Record<string, string> }[], status = 200): typeof fetch {
  return (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
    if (status !== 200) {
      return new Response(JSON.stringify({ error: { message: "bad key" } }), { status });
    }
    return new Response(JSON.stringify(OPENROUTER_MODELS), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

// ---- settings.get -------------------------------------------------------------

test("settings.get: empty install → empty inference, linear default-off; status seam honored", async () => {
  const { db, call } = setup();
  try {
    const first = (await call("settings.get")) as { inference: { harnesses: unknown[]; defaultId: string | null }; linear: unknown };
    assert.deepEqual(first.inference, { harnesses: [], defaultId: null });
    assert.deepEqual(first.linear, { connected: false });
  } finally {
    db.close();
  }

  const withLinear = setup({ linearStatus: () => ({ connected: true, team: "acme" }) });
  try {
    const got = (await withLinear.call("settings.get")) as { linear: unknown };
    assert.deepEqual(got.linear, { connected: true, team: "acme" });
  } finally {
    withLinear.db.close();
  }
});

// ---- setInference CRUD --------------------------------------------------------

test("upsert create → first harness becomes default; DTO is public (hasApiKey, never key material)", async () => {
  const { db, call } = setup();
  try {
    const out = (await call("settings.setInference", {
      op: "upsert",
      input: { name: "main", provider: "openrouter", apiKey: "sk-or-secret", model: "anthropic/claude-4", effort: "medium" },
    })) as { harnesses: Record<string, unknown>[]; defaultId: string };
    assert.equal(out.harnesses.length, 1);
    const h = out.harnesses[0]!;
    assert.equal(h["isDefault"], true);
    assert.equal(h["hasApiKey"], true);
    assert.equal(h["provider"], "openrouter");
    assert.equal(h["baseUrl"], "https://openrouter.ai/api/v1"); // provider default filled
    assert.equal(h["apiKey"], undefined); // never echoed
    assert.equal(h["apiKeyRef"], undefined);
    assert.equal(out.defaultId, h["id"]);
  } finally {
    db.close();
  }
});

test("upsert update / delete / setDefault + unknown-id and invalid-input errors", async () => {
  const { db, call, harnessStore } = setup();
  try {
    await call("settings.setInference", { op: "upsert", input: { name: "a", provider: "openrouter", model: "m1" } });
    const second = (await call("settings.setInference", { op: "upsert", input: { name: "b", provider: "anthropic", model: "claude-x" } })) as { harnesses: { id: string; isDefault: boolean }[] };
    const [a, b] = second.harnesses;
    assert.equal(a!.isDefault, true);
    assert.equal(b!.isDefault, false);

    // update
    await call("settings.setInference", { op: "upsert", id: a!.id, input: { model: "m2" } });
    assert.equal(harnessStore.get(a!.id)!.model, "m2");

    // setDefault
    const afterDefault = (await call("settings.setInference", { op: "setDefault", id: b!.id })) as { defaultId: string };
    assert.equal(afterDefault.defaultId, b!.id);

    // delete (the default goes first: the store leaves defaultId EMPTY —
    // a run then gets the actionable no-harness error, never a silent
    // fall-back to a harness the user did not choose)
    const afterDelete = (await call("settings.setInference", { op: "delete", id: b!.id })) as { harnesses: unknown[]; defaultId: string | null };
    assert.equal(afterDelete.harnesses.length, 1);
    assert.equal(afterDelete.defaultId, null);

    // error mapping
    await assert.rejects(call("settings.setInference", { op: "delete", id: "nope" }), /no inference harness found/i);
    await assert.rejects(
      call("settings.setInference", { op: "upsert", input: { name: "x", provider: "bogus", model: "m" } }),
      /invalid|provider/i,
    );
    await assert.rejects(call("settings.setInference", { op: "teleport" }), /op/);
  } finally {
    db.close();
  }
});

// ---- testInference probes -----------------------------------------------------

test("testInference { id }: probes the saved harness — key decrypted into the call, never returned", async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const { db, call } = setup({ fetchFn: probeFetch(calls) });
  try {
    const created = (await call("settings.setInference", {
      op: "upsert",
      input: { name: "main", provider: "openrouter", apiKey: "sk-or-secret", model: "anthropic/claude-4" },
    })) as { harnesses: { id: string }[] };
    const result = (await call("settings.testInference", { id: created.harnesses[0]!.id })) as {
      ok: boolean;
      models: { id: string; label: string | null }[];
      latencyMs: number;
    };
    assert.equal(result.ok, true);
    assert.deepEqual(result.models, [
      { id: "anthropic/claude-4", label: "Claude 4" },
      { id: "openai/gpt-5", label: null },
    ]);
    assert.equal(typeof result.latencyMs, "number");
    // The write-only rail, proven: the stored key reached the provider call.
    assert.equal(calls[0]!.url, "https://openrouter.ai/api/v1/models");
    assert.equal(calls[0]!.headers.authorization, "Bearer sk-or-secret");
    assert.equal(JSON.stringify(result).includes("sk-or-secret"), false);
  } finally {
    db.close();
  }
});

test("testInference { id }: a provider failure is a RESULT, not an RPC error", async () => {
  const { db, call } = setup({ fetchFn: probeFetch([], 401) });
  try {
    const created = (await call("settings.setInference", {
      op: "upsert",
      input: { name: "main", provider: "openrouter", apiKey: "bad", model: "m" },
    })) as { harnesses: { id: string }[] };
    const result = (await call("settings.testInference", { id: created.harnesses[0]!.id })) as { ok: boolean; error: string; latencyMs: number };
    assert.equal(result.ok, false);
    assert.match(result.error, /401|model probe failed/i);
    assert.equal(typeof result.latencyMs, "number");
  } finally {
    db.close();
  }
});

test("testInference { draft }: probes WITHOUT persisting (draft key used once, store stays empty)", async () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const { db, call, harnessStore } = setup({ fetchFn: probeFetch(calls) });
  try {
    const result = (await call("settings.testInference", {
      draft: { name: "candidate", provider: "openrouter", apiKey: "sk-draft", model: "anthropic/claude-4" },
    })) as { ok: boolean; models: unknown[] };
    assert.equal(result.ok, true);
    assert.equal(calls[0]!.headers.authorization, "Bearer sk-draft");
    assert.equal(harnessStore.list().length, 0); // nothing persisted
    const got = (await call("settings.get")) as { inference: { harnesses: unknown[] } };
    assert.equal(got.inference.harnesses.length, 0);
  } finally {
    db.close();
  }
});

test("testInference: invalid draft → invalid_params; unknown id → not_found", async () => {
  const { db, call } = setup();
  try {
    await assert.rejects(call("settings.testInference", { draft: { name: "x", provider: "openrouter" } }), /model/i);
    await assert.rejects(call("settings.testInference", { id: "ghost" }), /no inference harness found/i);
  } finally {
    db.close();
  }
});
