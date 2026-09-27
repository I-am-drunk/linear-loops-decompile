/**
 * T-1103 — composition-root RPC + live-compose acceptance tests.
 *
 * The M5 end-to-end proof over a REAL socket (no mocks at the transport
 * layer): a loop written via loops.upsert fires through the merged
 * orchestrator (cron tick AND manual/event paths), the runtime executes it
 * against a scripted brain, the write-back sink fires, and the UI's read
 * surface (runs.list / runs.get+lastSeq / runs.subscribe replay / steer /
 * continue) consumes the results — exactly the seam T-1104's UI speaks.
 *
 * Run: node --experimental-strip-types --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { TokenStore } from "../connect/tokens.ts";
import type { Scope } from "../connect/tokens.ts";
import { ScriptBrain } from "../runtime/brain.ts";
import type { Brain } from "../runtime/brain.ts";
import { defaultLoopConfig } from "../model/loop-config.ts";
import type { LoopConfig } from "../model/loop.ts";
import { createLiveLoopsServer } from "./compose.ts";
import type { LiveLoopsServer } from "./compose.ts";
import type { EntityReader } from "../runtime/context.ts";
import type { WriteBackInput, WriteBackResult } from "./orchestrator.ts";

const FULL: Scope[] = ["env:read", "loops:read", "loops:write", "runs:read", "runs:write", "settings:read", "settings:write"];

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

/** Minimal JSON-RPC-over-WS test client (the UI's client shape, raw). */
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
  writes: WriteBackInput[];
  brains: ScriptBrain[];
  close: () => Promise<void>;
}

async function makeRig(options: { exchanges?: (readonly import("../runtime/types.ts").Part[])[] } = {}): Promise<Rig> {
  const writes: WriteBackInput[] = [];
  const brains: ScriptBrain[] = [];
  const brainFor = (): Brain => {
    const brain = new ScriptBrain(options.exchanges ?? [[{ kind: "response", text: "digest posted" }]]);
    brains.push(brain);
    return brain;
  };
  const reader: EntityReader = {
    readEntity: async (target) => ({ title: `SUP-1: Flaky login (${target.id})`, description: "spinner", url: "https://example/SUP-1" }),
  };
  const live = createLiveLoopsServer({
    dbPath: ":memory:",
    brainFor,
    reader,
    writeBack: async (input) => {
      writes.push(input);
      return { commentId: "cmt-1", url: null, deduplicated: false } satisfies WriteBackResult;
    },
  });
  const port = await live.listen(0, "127.0.0.1");
  return {
    live,
    url: `ws://127.0.0.1:${port}/connect`,
    writes,
    brains,
    close: () => live.close(),
  };
}

function authed(rig: Rig, scopes: Scope[] = FULL): Promise<TestClient> {
  const { token } = rig.live.tokens.mint({ scopes });
  return TestClient.connect(rig.url, token);
}

function loopConfig(over: Partial<LoopConfig> = {}): LoopConfig {
  return { ...defaultLoopConfig(), name: "Triage digest", enabled: true, ...over };
}

// ---- the M5 acceptance: cron → brain → write-back → UI reads --------------

test("M5 e2e: loop written over RPC fires on the cron tick and is readable by the UI surface", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);

    // 1. Write the loop over the wire (the UI's editor save path).
    const upserted = (await client.request("loops.upsert", {
      config: loopConfig({ trigger: { type: "schedule", schedule: { rrule: "FREQ=MINUTELY", timezone: "UTC" } } }),
    })) as { loop: { id: string; name: string; enabled: boolean; version: number } };
    const loopId = upserted.loop.id;
    assert.equal(upserted.loop.name, "Triage digest");
    assert.equal(upserted.loop.enabled, true);
    assert.equal(upserted.loop.version, 1);

    // The upsert hooked reloadLoops: the schedule registry holds the entry.
    assert.deepEqual(rig.live.bootLoops, { scheduled: 0, event: 0, chat: 0 }); // written after boot
    assert.ok(rig.live.registry.list().some((e) => e.id === `loop:${loopId}`), "registry holds the loop entry");

    // 2. Drive the cron tick just past the first occurrence (anchor+60s; at
    //    +120s the misfire "skip" policy would correctly collapse both
    //    occurrences as missed downtime — Linear's semantics, see schedule.ts).
    const tick = await rig.live.orchestrator.tick(new Date(Date.now() + 61_000));
    assert.ok(tick.started.length >= 1, `tick started a run (${JSON.stringify(tick)})`);
    const runId = tick.started[0]!;

    // 3. The scripted brain completes the run; persistence mirrors it.
    await waitFor(() => rig.live.store.getRun(runId)?.status === "complete");

    // 4. The UI read surface: runs.list (aggregate + per-loop).
    const listed = (await client.request("runs.list", {})) as { runs: { id: string; status: string }[] };
    assert.ok(listed.runs.some((r) => r.id === runId && r.status === "complete"));
    const listedForLoop = (await client.request("runs.list", { loopId })) as { runs: { id: string }[] };
    assert.deepEqual(listedForLoop.runs.map((r) => r.id), [runId]);

    // 5. runs.get: history + lastSeq; subscribe from lastSeq replays NOTHING
    //    (snapshot and live tail join gaplessly — never double-render).
    const got = (await client.request("runs.get", { id: runId })) as {
      run: { id: string; status: string };
      turns: { role: string; parts: { kind: string; text?: string }[] }[];
      lastSeq: number;
    };
    assert.equal(got.run.status, "complete");
    assert.ok(got.lastSeq > 0, "events were published (lastSeq is the channel tip)");
    const responseParts = got.turns.flatMap((t) => t.parts).filter((p) => p.kind === "response");
    assert.ok(responseParts.some((p) => p.text === "digest posted"), "brain's response is in the turn history");

    const sub = (await client.request("runs.subscribe", { id: runId, sinceSeq: got.lastSeq })) as { replayed: number; truncated: boolean; active: string[] };
    assert.equal(sub.replayed, 0, "nothing after the tip replays");
    assert.equal(sub.truncated, false);
    await wait(50);
    assert.equal(client.notifications.length, 0, "no duplicate events after a tip-anchored subscribe");

    // 6. runs.continue: the follow-up streams over the same channel.
    const continued = (await client.request("runs.continue", { id: runId, text: "weekly edition please" })) as { ok: boolean };
    assert.equal(continued.ok, true);
    await waitFor(() => client.notifications.some((n) => n.method === "runs.event"));
    const steered = client.notifications.find(
      (n) => n.method === "runs.event" && (n.params["event"] as Record<string, unknown>)["type"] === "partAppended",
    );
    assert.ok(steered !== undefined, "the continuation streams parts live");

    client.close();
  } finally {
    await rig.close();
  }
});

// ---- event path + write-back ----------------------------------------------

test("M5 e2e: issue event loop fires via handleEvent and writes back a comment", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);
    const upserted = (await client.request("loops.upsert", {
      config: loopConfig({
        trigger: { type: "event", event: { entity: "issue", kind: "created" }, activationMode: "collectionChanged" },
      }),
    })) as { loop: { id: string } };
    const loopId = upserted.loop.id;

    const result = await rig.live.orchestrator.handleEvent({
      id: "evt-1",
      entity: "issue",
      kind: "created",
      entityId: "issue-abc",
    });
    assert.ok(result.fired.includes(loopId), `loop fired (${JSON.stringify(result)})`);
    assert.equal(result.started.length, 1);
    const runId = result.started[0]!;
    await waitFor(() => rig.live.store.getRun(runId)?.status === "complete");

    // The write-back leg: one comment sink call with the brain's response.
    await waitFor(() => rig.writes.length === 1);
    assert.equal(rig.writes[0]?.target.id, "issue-abc");
    assert.equal(rig.writes[0]?.responseText, "digest posted");

    // runs.get is target-faithful.
    const got = (await client.request("runs.get", { id: runId })) as { run: { target?: { id: string } } };
    assert.equal(got.run.target?.id, "issue-abc");
    client.close();
  } finally {
    await rig.close();
  }
});

// ---- parked run: steer IS the elicitation answer ---------------------------

test("M5 e2e: awaitingInput run parks with its question; runs.steer answers it", async () => {
  const rig = await makeRig({
    exchanges: [
      [{ kind: "elicitation", elicitationKind: "select", prompt: "Post the digest?", choices: ["Post", "Discard"] }],
      [{ kind: "response", text: "posted after approval" }],
    ],
  });
  try {
    const client = await authed(rig);
    const upserted = (await client.request("loops.upsert", { config: loopConfig() })) as { loop: { id: string } };
    const requested = await rig.live.orchestrator.requestRun({
      loopId: upserted.loop.id,
      kind: "manual",
      requestedAt: new Date().toISOString(),
    });
    assert.equal(requested.outcome, "started");
    const runId = requested.runId!;

    await waitFor(() => rig.live.store.getRun(runId)?.status === "awaitingInput");
    // runs.get reconstructs the parked question (snapshot overlay).
    const parked = (await client.request("runs.get", { id: runId })) as {
      run: { status: string; pendingElicitation?: { prompt: string; choices?: string[] } };
    };
    assert.equal(parked.run.status, "awaitingInput");
    assert.equal(parked.run.pendingElicitation?.prompt, "Post the digest?");
    assert.deepEqual(parked.run.pendingElicitation?.choices, ["Post", "Discard"]);

    // The FollowUpBox's "Send answer" is runs.steer on the wire.
    await client.request("runs.steer", { id: runId, text: "Post" });
    await waitFor(() => rig.live.store.getRun(runId)?.status === "complete");
    const done = (await client.request("runs.get", { id: runId })) as { run: { status: string } };
    assert.equal(done.run.status, "complete");
    client.close();
  } finally {
    await rig.close();
  }
});

// ---- loops RPC validation + scope gates ------------------------------------

test("loops RPC: zod gate maps to invalid_params, unknown ids to not_found, scopes enforced", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);

    const bad = await client.request("loops.upsert", { config: { name: "" } }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.ok(bad instanceof Error);
    assert.equal((bad as Error & { code?: string }).code, "invalid_params");

    const missing = await client.request("loops.get", { id: "nope" }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((missing as Error & { code?: string }).code, "not_found");
    const missingRun = await client.request("runs.get", { id: "nope" }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((missingRun as Error & { code?: string }).code, "not_found");

    // setEnabled round-trip (row toggle is authoritative).
    const created = (await client.request("loops.upsert", { config: loopConfig() })) as { loop: { id: string } };
    const disabled = (await client.request("loops.setEnabled", { id: created.loop.id, enabled: false })) as {
      loop: { enabled: boolean };
    };
    assert.equal(disabled.loop.enabled, false);
    const listed = (await client.request("loops.list", {})) as { loops: { id: string; enabled: boolean }[] };
    assert.equal(listed.loops.find((l) => l.id === created.loop.id)?.enabled, false);
    // Disabled loops leave the schedule registry (the reload hook again).
    assert.ok(!rig.live.registry.list().some((e) => e.id === `loop:${created.loop.id}`));

    // A read-only token cannot write.
    const reader = await authed(rig, ["loops:read", "runs:read"]);
    const denied = await reader.request("loops.upsert", { config: loopConfig() }).then(
      () => null,
      (e: Error & { code?: string }) => e,
    );
    assert.equal((denied as Error & { code?: string }).code, "insufficient_scope");

    client.close();
    reader.close();
  } finally {
    await rig.close();
  }
});
