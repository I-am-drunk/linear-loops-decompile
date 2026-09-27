/**
 * T-1106 — settings RPC + live dataplane binding tests, over REAL sockets.
 *
 * Covers the operator acceptance: configure inference + Linear over the
 * wire, then an issue event fires a run whose write-back lands through the
 * dataplane seam the binding built at setLinear (no restart). And the
 * absolute discipline: no RPC payload ever contains a token, key, or ref.
 *
 * Run: node --experimental-strip-types --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ScriptBrain } from "../runtime/brain.ts";
import type { Brain } from "../runtime/brain.ts";
import type { LinearClient, Viewer } from "../dataplane/client.ts";
import type { IssueSummary } from "../dataplane/reads.ts";
import type { CreatedComment } from "../dataplane/writes.ts";
import { defaultLoopConfig } from "../model/loop-config.ts";
import type { LoopConfig } from "../model/loop.ts";
import { createLiveLoopsServer } from "./compose.ts";
import type { LiveLoopsServer } from "./compose.ts";
import type { Scope } from "../connect/tokens.ts";

const FULL: Scope[] = ["env:read", "loops:read", "loops:write", "runs:read", "runs:write", "settings:read", "settings:write"];

const VIEWER: Viewer = { id: "u-1", name: "Ada Lovelace", email: "ada@example.com" };
const GOOD_TOKEN = "lin_api_GOOD";
const HARNESS_KEY = "sk-test-SECRET";

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(cond: () => boolean, timeoutMs = 3_000, stepMs = 25): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: timed out");
    await wait(stepMs);
  }
}

class TestClient {
  #ws: WebSocket;
  #nextId = 1;
  #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  notifications: { method: string; params: Record<string, unknown> }[] = [];

  private constructor(ws: WebSocket) {
    this.#ws = ws;
    ws.addEventListener("message", (ev: MessageEvent) => {
      if (typeof ev.data !== "string") return;
      const msg = JSON.parse(ev.data) as Record<string, unknown>;
      if (typeof msg["id"] === "number") {
        const p = this.#pending.get(msg["id"]);
        if (p === undefined) return;
        this.#pending.delete(msg["id"]);
        const err = msg["error"] as { code?: string; message?: string } | undefined;
        if (err !== undefined) {
          const e = new Error(err.message ?? "rpc error");
          (e as Error & { code?: string }).code = err.code ?? "rpc_error";
          p.reject(e);
        } else p.resolve(msg["result"]);
      } else if (typeof msg["method"] === "string") {
        this.notifications.push({ method: msg["method"], params: (msg["params"] ?? {}) as Record<string, unknown> });
      }
    });
  }

  static async connect(url: string, token: string): Promise<TestClient> {
    const ws = new WebSocket(url, [`t3.${token}`]);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("close", () => reject(new Error("handshake refused")), { once: true });
    });
    return new TestClient(ws);
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.#ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) }));
    });
  }

  close(): void {
    this.#ws.close(1000, "test done");
  }
}

interface Rig {
  live: LiveLoopsServer;
  url: string;
  comments: { issueId: string; body: string }[];
  close: () => Promise<void>;
}

async function makeRig(): Promise<Rig> {
  const comments: Rig["comments"] = [];
  const issue: IssueSummary = {
    id: "issue-abc",
    identifier: "SUP-1",
    title: "Flaky login",
    description: null,
    priority: 2,
    url: "https://example/SUP-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    state: { id: "s1", name: "Triage", type: "triage" },
    team: { id: "t1", key: "SUP" },
    labels: [],
  };
  const brainFor = (): Brain => new ScriptBrain([[{ kind: "response", text: "digest posted" }]]);
  const live = createLiveLoopsServer({
    dbPath: ":memory:",
    brainFor,
    settingsDeps: {
      verifyLinear: async (token) => {
        if (token !== GOOD_TOKEN) throw new Error("401 Unauthorized");
        return VIEWER;
      },
      linearClientFor: (_token) =>
        ({
          verifyAuth: async () => VIEWER,
          rateBudget: () => null,
        }) as unknown as LinearClient,
      chatAdapterFor: () => ({
        provider: "openrouter",
        streamChat: async function* (): AsyncGenerator<never> {},
        listModels: async () => [{ id: "m-1", label: "m-1" }, { id: "m-2", label: "m-2" }],
      }),
      readIssue: async () => issue,
      writeComment: async (_client, input) => {
        comments.push({ issueId: input.issueId, body: input.body });
        return { value: { id: "cmt-1", body: input.body, createdAt: new Date().toISOString() }, deduplicated: false };
      },
    },
  });
  const port = await live.listen(0, "127.0.0.1");
  return { live, url: `ws://127.0.0.1:${port}/connect`, comments, close: () => live.close() };
}

function authed(rig: Rig, scopes: Scope[] = FULL): Promise<TestClient> {
  const { token } = rig.live.tokens.mint({ scopes });
  return TestClient.connect(rig.url, token);
}

function eventLoop(over: Partial<LoopConfig> = {}): LoopConfig {
  return {
    ...defaultLoopConfig(),
    name: "Triage digest",
    enabled: true,
    trigger: { type: "event", event: { entity: "issue", kind: "created" }, activationMode: "collectionChanged" },
    ...over,
  };
}

test("settings.get starts disconnected with no harnesses; environment present", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);
    const got = (await client.request("settings.get", {})) as {
      linear: { status: string };
      harnesses: unknown[];
      environment: { product: string };
    };
    assert.equal(got.linear.status, "disconnected");
    assert.deepEqual(got.harnesses, []);
    assert.equal(got.environment.product, "loops-server");
    client.close();
  } finally {
    await rig.close();
  }
});

test("setInference validates, creates write-only, probes; settings.get never echoes key material", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);

    const bad = await client.request("settings.setInference", { input: { name: "" } }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((bad as Error & { code?: string }).code, "invalid_params");

    const created = (await client.request("settings.setInference", {
      input: { name: "OpenRouter", provider: "openrouter", apiKey: HARNESS_KEY, model: "openai/gpt-x", makeDefault: true },
    })) as { harness: { id: string; isDefault: boolean; hasApiKey: boolean } };
    assert.equal(created.harness.isDefault, true);
    assert.equal(created.harness.hasApiKey, true);

    const got = await client.request("settings.get", {});
    const raw = JSON.stringify(got);
    assert.ok(!raw.includes(HARNESS_KEY), "no key material in settings.get");
    assert.ok(raw.includes("OpenRouter"), "the harness is listed");

    const probed = (await client.request("settings.testInference", { id: created.harness.id })) as {
      ok: boolean;
      models?: string[];
    };
    assert.equal(probed.ok, true);
    assert.deepEqual(probed.models, ["m-1", "m-2"]);

    const missing = await client.request("settings.testInference", { id: "nope" }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((missing as Error & { code?: string }).code, "not_found");

    // Update path (id present): change the model.
    const updated = (await client.request("settings.setInference", {
      id: created.harness.id,
      input: { model: "openai/gpt-y" },
    })) as { harness: { model: string } };
    assert.equal(updated.harness.model, "openai/gpt-y");

    client.close();
  } finally {
    await rig.close();
  }
});

test("setLinear verifies then persists write-only; probe reflects state; failures store nothing", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);

    const before = (await client.request("dataplane.probe", {})) as { linear: { status: string } };
    assert.equal(before.linear.status, "disconnected");

    const denied = await client.request("settings.setLinear", { token: "lin_api_BAD" }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((denied as Error & { code?: string }).code, "invalid_params");
    assert.ok(!String(denied).includes("lin_api_BAD"), "the failed token is not echoed");
    const stillOff = (await client.request("settings.get", {})) as { linear: { status: string } };
    assert.equal(stillOff.linear.status, "disconnected", "an unverified token is never stored");

    const connected = (await client.request("settings.setLinear", { token: GOOD_TOKEN })) as {
      linear: { status: string; user?: { name: string } };
    };
    assert.equal(connected.linear.status, "connected");
    assert.equal(connected.linear.user?.name, "Ada Lovelace");

    const got = await client.request("settings.get", {});
    const raw = JSON.stringify(got);
    assert.ok(!raw.includes(GOOD_TOKEN), "settings.get never contains the PAT");
    assert.ok(!raw.includes('"ref"'), "settings.get never contains the secret ref");

    const probe = (await client.request("dataplane.probe", {})) as { linear: { status: string; user?: { email: string } } };
    assert.equal(probe.linear.status, "connected");
    assert.equal(probe.linear.user?.email, "ada@example.com");

    client.close();
  } finally {
    await rig.close();
  }
});

test("operator acceptance: after setLinear, an event run writes back through the dataplane binding", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);
    await client.request("settings.setLinear", { token: GOOD_TOKEN });
    const upserted = (await client.request("loops.upsert", { config: eventLoop() })) as { loop: { id: string } };
    await client.request("loops.publish", { id: upserted.loop.id });

    const result = await rig.live.orchestrator.handleEvent({ id: "evt-1", entity: "issue", kind: "created", entityId: "issue-abc" });
    const runId = result.started[0]!;
    await waitFor(() => rig.live.store.getRun(runId)?.status === "complete");
    await waitFor(() => rig.comments.length === 1);
    assert.equal(rig.comments[0]?.issueId, "issue-abc");
    assert.equal(rig.comments[0]?.body, "digest posted");
    client.close();
  } finally {
    await rig.close();
  }
});

test("setInference delete/setDefault ops + draft probe + dup-name + credential refusal (agent-06 delta)", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);

    const a = (await client.request("settings.setInference", {
      input: { name: "A", provider: "openrouter", model: "m1" },
    })) as { harness: { id: string } };
    const b = (await client.request("settings.setInference", {
      input: { name: "B", provider: "openrouter", model: "m2" },
    })) as { harness: { id: string } };

    // setDefault op
    const def = (await client.request("settings.setInference", { op: "setDefault", id: b.harness.id })) as {
      harness: { isDefault: boolean };
    };
    assert.equal(def.harness.isDefault, true);

    // delete op (+ unknown id → not_found)
    const del = (await client.request("settings.setInference", { op: "delete", id: b.harness.id })) as {
      ok: boolean;
      harnesses: unknown[];
    };
    assert.equal(del.ok, true);
    assert.equal(del.harnesses.length, 1);
    const delMissing = await client.request("settings.setInference", { op: "delete", id: "nope" }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((delMissing as Error & { code?: string }).code, "not_found");

    // duplicate name → invalid_params (never a raw sqlite error)
    const dup = await client.request("settings.setInference", {
      input: { name: "A", provider: "openrouter", model: "m9" },
    }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((dup as Error & { code?: string }).code, "invalid_params");
    assert.match((dup as Error).message, /already exists/i);

    // credential-named extraHeaders refused — write path AND draft probe
    const hdr = await client.request("settings.setInference", {
      input: { name: "H", provider: "openrouter", model: "m", extraHeaders: { Authorization: "Bearer x" } },
    }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((hdr as Error & { code?: string }).code, "invalid_params");
    const hdrDraft = await client.request("settings.testInference", {
      draft: { name: "D", provider: "openrouter", model: "m", extraHeaders: { "X-Api-Key": "k" } },
    }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((hdrDraft as Error & { code?: string }).code, "invalid_params");

    // draft probe: works, and persists nothing
    const probe = (await client.request("settings.testInference", {
      draft: { name: "D", provider: "openrouter", model: "m", apiKey: "sk-draft" },
    })) as { ok: boolean; models?: string[] };
    assert.equal(probe.ok, true);
    assert.deepEqual(probe.models, ["m-1", "m-2"]);
    const got = (await client.request("settings.get", {})) as { harnesses: unknown[] };
    assert.equal(got.harnesses.length, 1); // only "A" — the draft never persisted

    client.close();
  } finally {
    await rig.close();
  }
});
