/**
 * T-1103 follow-up — live-compose e2e acceptance over REAL sockets (no
 * transport mocks), exercising the merged #111 RPC implementation through
 * the composition root (compose.ts), plus its fixes:
 *
 *  - the orchestrator's run watch lives past terminal → runs.continue
 *    streams (complete is continuable; the off()-at-terminal bug);
 *  - upserts are DRAFTS (never re-phase); publish/setEnabled hook
 *    reloadLoops (the merged #111 semantics, pinned here);
 *  - runs.created broadcasts to runs:read connections (and only those);
 *  - runs.get's lastSeq joins snapshot→subscribe with zero replays;
 *  - steer on a parked run IS the elicitation answer;
 *  - store.getRun reconstructs a parked run's question from its snapshot
 *    (the durable-fallback path when the Runner no longer holds the run).
 *
 * Run: node --experimental-strip-types --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ScriptBrain } from "../runtime/brain.ts";
import type { Brain } from "../runtime/brain.ts";
import type { Part, Run } from "../runtime/types.ts";
import { defaultLoopConfig } from "../model/loop-config.ts";
import type { LoopConfig } from "../model/loop.ts";
import { createLiveLoopsServer } from "./compose.ts";
import type { LiveLoopsServer } from "./compose.ts";
import type { EntityReader } from "../runtime/context.ts";
import type { WriteBackInput, WriteBackResult } from "./orchestrator.ts";
import type { Scope } from "../connect/tokens.ts";

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
  close: () => Promise<void>;
}

async function makeRig(options: { exchanges?: (readonly Part[])[] } = {}): Promise<Rig> {
  const writes: WriteBackInput[] = [];
  const brainFor = (): Brain => new ScriptBrain(options.exchanges ?? [[{ kind: "response", text: "digest posted" }]]);
  const reader: EntityReader = {
    readEntity: async (target) => ({ title: `SUP-1 (${target.id})`, description: "spinner", url: "https://example/SUP-1" }),
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
  return { live, url: `ws://127.0.0.1:${port}/connect`, writes, close: () => live.close() };
}

function authed(rig: Rig, scopes: Scope[] = FULL): Promise<TestClient> {
  const { token } = rig.live.tokens.mint({ scopes });
  return TestClient.connect(rig.url, token);
}

function loopConfig(over: Partial<LoopConfig> = {}): LoopConfig {
  return { ...defaultLoopConfig(), name: "Triage digest", enabled: true, ...over };
}

// ---- the M5 acceptance: cron → brain → write-back → UI reads --------------

test("e2e: draft→publish→cron tick→run→UI surface (list/get+lastSeq/subscribe/continue/runs.created)", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);
    // A second connection with only runs:read — the broadcast's audience.
    const watcher = await authed(rig, ["runs:read"]);
    // A third without runs:read — must receive nothing.
    const settingsOnly = await authed(rig, ["settings:write"]);

    // 1. Upsert = DRAFT: the schedule registry stays empty (merged #111
    //    semantics — re-phasing happens exactly once, at publish/setEnabled).
    const upserted = (await client.request("loops.upsert", {
      config: loopConfig({ trigger: { type: "schedule", schedule: { rrule: "FREQ=MINUTELY", timezone: "UTC" } } }),
    })) as { loop: { id: string; version: number } };
    const loopId = upserted.loop.id;
    assert.equal(upserted.loop.version, 1);
    assert.ok(!rig.live.registry.list().some((e) => e.id === `loop:${loopId}`), "draft does not re-phase");

    // 2. Publish: the registry entry lands (the editor's saveLoop flow).
    //    #111 semantics: the UPSERT bumped the row's updatedAt anchor;
    //    publish activates it via reloadLoops — no version bump, and it
    //    refuses (unavailable) when no orchestrator is wired, so a publish
    //    can never fake a re-phase.
    const published = (await client.request("loops.publish", { id: loopId })) as { loop: { version: number } };
    assert.equal(published.loop.version, 1);
    assert.ok(rig.live.registry.list().some((e) => e.id === `loop:${loopId}`), "publish re-phases");

    // 3. Tick just past the first occurrence (at +120s the misfire "skip"
    //    policy would correctly collapse both as missed downtime).
    const tick = await rig.live.orchestrator.tick(new Date(Date.now() + 61_000));
    assert.ok(tick.started.length >= 1, `tick started a run (${JSON.stringify(tick)})`);
    const runId = tick.started[0]!;

    // 4. runs.created broadcast: the runs:read watcher got it, the
    //    settings-only connection did not (scope-gated fan-out).
    await waitFor(() => watcher.notifications.some((n) => n.method === "runs.created"));
    const created = watcher.notifications.find((n) => n.method === "runs.created");
    assert.equal((created?.params["run"] as Record<string, unknown>)["id"], runId);
    await wait(50);
    assert.ok(!settingsOnly.notifications.some((n) => n.method === "runs.created"));

    await waitFor(() => rig.live.store.getRun(runId)?.status === "complete");

    // 5. The UI read surface: list (aggregate + per-loop), get+lastSeq, and
    //    a tip-anchored subscribe that replays NOTHING (no double-render).
    const listed = (await client.request("runs.list", {})) as { runs: { id: string; status: string }[] };
    assert.ok(listed.runs.some((r) => r.id === runId && r.status === "complete"));
    const got = (await client.request("runs.get", { id: runId })) as {
      run: { status: string };
      turns: { parts: { kind: string; text?: string }[] }[];
      lastSeq: number;
    };
    assert.equal(got.run.status, "complete");
    assert.ok(got.lastSeq > 0, "events were published (lastSeq is the channel tip)");
    assert.ok(got.turns.flatMap((t) => t.parts).some((p) => p.kind === "response" && p.text === "digest posted"));

    const sub = (await client.request("runs.subscribe", { id: runId, sinceSeq: got.lastSeq })) as { replayed: number; truncated: boolean };
    assert.deepEqual({ replayed: sub.replayed, truncated: sub.truncated }, { replayed: 0, truncated: false });
    const atSub = client.notifications.length; // runs.created etc. arrived earlier by design
    await wait(50);
    assert.equal(client.notifications.length, atSub, "no duplicate events after a tip-anchored subscribe");

    // 6. runs.continue: the follow-up STREAMS (the watch lives past
    //    terminal — the bug this follow-up fixes).
    await client.request("runs.continue", { id: runId, text: "weekly edition please" });
    await waitFor(() =>
      client.notifications.some(
        (n) => n.method === "runs.event" && (n.params["event"] as Record<string, unknown>)["type"] === "partAppended",
      ),
    );

    client.close();
    watcher.close();
    settingsOnly.close();
  } finally {
    await rig.close();
  }
});

// ---- event path + write-back ----------------------------------------------

test("e2e: issue event loop fires via handleEvent and writes back a comment", async () => {
  const rig = await makeRig();
  try {
    const client = await authed(rig);
    const upserted = (await client.request("loops.upsert", {
      config: loopConfig({
        trigger: { type: "event", event: { entity: "issue", kind: "created" }, activationMode: "collectionChanged" },
      }),
    })) as { loop: { id: string } };
    await client.request("loops.publish", { id: upserted.loop.id });

    const result = await rig.live.orchestrator.handleEvent({ id: "evt-1", entity: "issue", kind: "created", entityId: "issue-abc" });
    assert.ok(result.fired.includes(upserted.loop.id), `loop fired (${JSON.stringify(result)})`);
    const runId = result.started[0]!;
    await waitFor(() => rig.live.store.getRun(runId)?.status === "complete");
    await waitFor(() => rig.writes.length === 1);
    assert.equal(rig.writes[0]?.target.id, "issue-abc");
    assert.equal(rig.writes[0]?.responseText, "digest posted");
    client.close();
  } finally {
    await rig.close();
  }
});

// ---- parked run: steer IS the elicitation answer ---------------------------

test("e2e: awaitingInput run parks with its question; runs.steer answers it", async () => {
  const rig = await makeRig({
    exchanges: [
      [{ kind: "elicitation", elicitationKind: "select", prompt: "Post the digest?", choices: ["Post", "Discard"] }],
      [{ kind: "response", text: "posted after approval" }],
    ],
  });
  try {
    const client = await authed(rig);
    const upserted = (await client.request("loops.upsert", { config: loopConfig() })) as { loop: { id: string } };
    await client.request("loops.publish", { id: upserted.loop.id });
    const requested = await rig.live.orchestrator.requestRun({
      loopId: upserted.loop.id,
      kind: "manual",
      requestedAt: new Date().toISOString(),
    });
    assert.equal(requested.outcome, "started");
    const runId = requested.runId!;

    await waitFor(() => rig.live.store.getRun(runId)?.status === "awaitingInput");
    const parked = (await client.request("runs.get", { id: runId })) as {
      run: { status: string; pendingElicitation?: { prompt: string } };
    };
    assert.equal(parked.run.status, "awaitingInput");
    assert.equal(parked.run.pendingElicitation?.prompt, "Post the digest?");

    await client.request("runs.steer", { id: runId, text: "Post" });
    await waitFor(() => rig.live.store.getRun(runId)?.status === "complete");
    client.close();
  } finally {
    await rig.close();
  }
});

// ---- store fallback: pendingElicitation survives via the snapshot ----------

test("store.getRun reconstructs a parked run's question from its snapshot", () => {
  const live = createLiveLoopsServer({ dbPath: ":memory:" });
  // runs.loop_id REFERENCES loops(id) — the loop row must exist first.
  live.store.saveLoop("loop-x", defaultLoopConfig());
  const run: Run = {
    id: "run-x",
    loopId: "loop-x",
    status: "awaitingInput",
    iteration: 1,
    createdAt: new Date().toISOString(),
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  };
  live.store.insertRun(run);
  const pendingElicitation = { kind: "elicitation" as const, elicitationKind: "freeText" as const, prompt: "which channel?" };
  live.store.saveSnapshot(run.id, new Date().toISOString(), JSON.stringify({ run: { ...run, pendingElicitation } }));
  const got = live.store.getRun(run.id);
  assert.equal(got?.status, "awaitingInput");
  assert.equal(got?.pendingElicitation?.prompt, "which channel?");
  return live.close();
});
