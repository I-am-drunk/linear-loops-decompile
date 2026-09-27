/**
 * T-1103 — domain RPC handlers: the seven loops + runs methods the T-1104
 * UI consumes, plus the run-event sink (runs.created broadcast). Fake
 * channel, real Store on :memory: — no sockets.
 * Run: node --experimental-strip-types --test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultLoopConfig } from "../model/loop-config.ts";
import { RpcError, RPC_ERRORS } from "../connect/rpc.ts";
import { ScriptBrain } from "../runtime/brain.ts";
import { Runner } from "../runtime/runner.ts";
import type { RunEvent } from "../runtime/types.ts";
import { openDatabase } from "./db.ts";
import { persistRun } from "./persistence.ts";
import { channelRunEventSink, registerDomainRpcs } from "./rpc.ts";
import type { DomainRpcChannel, RunEventChannel } from "./rpc.ts";
import { Store } from "./store.ts";

type Handler = (params: unknown) => unknown;

class FakeChannel implements DomainRpcChannel, RunEventChannel {
  readonly handlers = new Map<string, Handler>();
  readonly seqs = new Map<string, number>();
  readonly broadcasts: { method: string; params: unknown }[] = [];
  readonly published: { runId: string; event: Record<string, unknown> & { type: string } }[] = [];

  register(method: string, handler: Handler): void {
    this.handlers.set(method, handler);
  }
  lastSeqFor(runId: string): number {
    return this.seqs.get(runId) ?? 0;
  }
  publishRunEvent(runId: string, event: Record<string, unknown> & { type: string }): number {
    const seq = (this.seqs.get(runId) ?? 0) + 1;
    this.seqs.set(runId, seq);
    this.published.push({ runId, event });
    return seq;
  }
  broadcast(method: string, params: unknown): number {
    this.broadcasts.push({ method, params });
    return 1;
  }

  call(method: string, params?: unknown): unknown {
    const handler = this.handlers.get(method);
    assert.ok(handler !== undefined, `no handler registered for ${method}`);
    return handler(params);
  }
}

function rig(options: { reloadLoops?: () => void } = {}) {
  const store = new Store(openDatabase(":memory:"));
  const channel = new FakeChannel();
  const reloads: string[] = [];
  const reloadLoops =
    options.reloadLoops ??
    (() => {
      reloads.push("reload");
    });
  registerDomainRpcs(channel, { store, reloadLoops });
  return { store, channel, reloads };
}

/** Start + persist one run so the store has run/turn rows to read. */
async function makeRun(store: Store, loopId: string, runId: string): Promise<void> {
  const runner = new Runner();
  const brain = new ScriptBrain([[{ kind: "response", text: `answer for ${runId}` }]]);
  const run = runner.start({ loopId, message: "go", brain, runId, iteration: 1 });
  persistRun(runner, store, run.id);
  await runner.whenIdle(run.id);
}

// ---- loops.* ---------------------------------------------------------------

test("loops.upsert → list → get round-trip; every write re-phases", () => {
  const { channel, reloads } = rig();
  const config = defaultLoopConfig();

  const created = channel.call("loops.upsert", { config }) as { loop: { id: string; version: number } };
  assert.equal(typeof created.loop.id, "string");
  assert.equal(created.loop.version, 1);
  assert.equal(reloads.length, 1);

  const listed = channel.call("loops.list") as { loops: { id: string; config: unknown }[] };
  assert.equal(listed.loops.length, 1);
  assert.equal(listed.loops[0]!.id, created.loop.id);
  // The wire shape carries the PARSED config, never configJson.
  assert.equal((listed.loops[0]!.config as { name: string }).name, config.name);
  assert.equal("configJson" in listed.loops[0]!, false);

  const got = channel.call("loops.get", { id: created.loop.id }) as { loop: { id: string } };
  assert.equal(got.loop.id, created.loop.id);
  assert.equal(reloads.length, 1); // reads never re-phase

  const renamed = channel.call("loops.upsert", { id: created.loop.id, config: { ...config, name: "v2" } }) as {
    loop: { version: number };
  };
  assert.equal(renamed.loop.version, 2);
  assert.equal(reloads.length, 2);
});

test("loops.publish re-phases and returns the live row; unknown id 404s", () => {
  const { channel, reloads } = rig();
  const created = channel.call("loops.upsert", { config: defaultLoopConfig() }) as { loop: { id: string } };
  reloads.length = 0;

  const published = channel.call("loops.publish", { id: created.loop.id }) as { loop: { id: string } };
  assert.equal(published.loop.id, created.loop.id);
  assert.equal(reloads.length, 1);

  assert.throws(() => channel.call("loops.publish", { id: "nope" }), (e: unknown) => {
    assert.ok(e instanceof RpcError);
    assert.equal(e.code, RPC_ERRORS.NOT_FOUND);
    return true;
  });
});

test("loops.setEnabled flips the row toggle and re-phases", () => {
  const { channel, reloads } = rig();
  const created = channel.call("loops.upsert", { config: defaultLoopConfig() }) as {
    loop: { id: string; enabled: boolean };
  };
  assert.equal(created.loop.enabled, true);
  reloads.length = 0;

  const off = channel.call("loops.setEnabled", { id: created.loop.id, enabled: false }) as {
    loop: { enabled: boolean };
  };
  assert.equal(off.loop.enabled, false);
  assert.equal(reloads.length, 1);

  assert.throws(() => channel.call("loops.setEnabled", { id: created.loop.id, enabled: "yes" }), (e: unknown) => {
    assert.ok(e instanceof RpcError && e.code === RPC_ERRORS.INVALID_PARAMS);
    return true;
  });
  assert.throws(() => channel.call("loops.setEnabled", { id: "nope", enabled: true }), (e: unknown) => {
    assert.ok(e instanceof RpcError && e.code === RPC_ERRORS.NOT_FOUND);
    return true;
  });
});

test("loops.upsert maps the zod rail to invalid_params", () => {
  const { channel } = rig();
  assert.throws(() => channel.call("loops.upsert", { config: { name: "" } }), (e: unknown) => {
    assert.ok(e instanceof RpcError);
    assert.equal(e.code, RPC_ERRORS.INVALID_PARAMS);
    assert.match(e.message, /invalid loop config/);
    return true;
  });
  assert.throws(() => channel.call("loops.upsert", {}), (e: unknown) => {
    assert.ok(e instanceof RpcError && e.code === RPC_ERRORS.INVALID_PARAMS);
    return true;
  });
});

test("loops RPCs work without a reloadLoops seam (orchestrator not yet wired)", () => {
  const store = new Store(openDatabase(":memory:"));
  const channel = new FakeChannel();
  registerDomainRpcs(channel, { store });
  const created = channel.call("loops.upsert", { config: defaultLoopConfig() }) as { loop: { id: string } };
  const published = channel.call("loops.publish", { id: created.loop.id }) as { loop: { id: string } };
  assert.equal(published.loop.id, created.loop.id);
});

// ---- runs.* ----------------------------------------------------------------

test("runs.list filters by loop, newest first, honors limit", async () => {
  const { store, channel } = rig();
  store.saveLoop("loop-a", defaultLoopConfig());
  store.saveLoop("loop-b", { ...defaultLoopConfig(), name: "B" });
  await makeRun(store, "loop-a", "run-a1");
  await makeRun(store, "loop-a", "run-a2");
  await makeRun(store, "loop-b", "run-b1");

  const all = channel.call("runs.list", { limit: 10 }) as { runs: { id: string }[] };
  assert.deepEqual(all.runs.map((r) => r.id), ["run-b1", "run-a2", "run-a1"]);

  const onlyA = channel.call("runs.list", { loopId: "loop-a", limit: 10 }) as { runs: { id: string }[] };
  assert.deepEqual(onlyA.runs.map((r) => r.id), ["run-a2", "run-a1"]);

  const capped = channel.call("runs.list", { limit: 1 }) as { runs: { id: string }[] };
  assert.deepEqual(capped.runs.map((r) => r.id), ["run-b1"]);

  assert.throws(() => channel.call("runs.list", { limit: 0 }), (e: unknown) => {
    assert.ok(e instanceof RpcError && e.code === RPC_ERRORS.INVALID_PARAMS);
    return true;
  });
  assert.throws(() => channel.call("runs.list", { limit: 9000 }), (e: unknown) => {
    assert.ok(e instanceof RpcError && e.code === RPC_ERRORS.INVALID_PARAMS);
    return true;
  });
});

test("runs.get returns run + turns + the channel lastSeq", async () => {
  const { store, channel } = rig();
  store.saveLoop("loop-1", defaultLoopConfig());
  await makeRun(store, "loop-1", "run-1");
  channel.seqs.set("run-1", 7); // the channel has stamped 7 events this boot

  const got = channel.call("runs.get", { id: "run-1" }) as {
    run: { id: string; status: string; usage: { inputTokens: number } };
    turns: { role: string; parts: { kind: string }[] }[];
    lastSeq: number;
  };
  assert.equal(got.run.id, "run-1");
  assert.equal(got.run.status, "complete");
  assert.ok(got.run.usage.inputTokens >= 0);
  // The first exchange's assembled prompt is not a turn row (runtime
  // contract — a user turn appears only from steer/respond/continue), so a
  // fresh completed run carries exactly its agent turn.
  assert.equal(got.turns.length, 1);
  assert.deepEqual(got.turns.map((t) => t.role), ["agent"]);
  assert.equal(got.turns[0]!.parts[0]!.kind, "response");
  assert.equal(got.lastSeq, 7);

  assert.throws(() => channel.call("runs.get", { id: "nope" }), (e: unknown) => {
    assert.ok(e instanceof RpcError && e.code === RPC_ERRORS.NOT_FOUND);
    return true;
  });
});

// ---- the run-event sink -----------------------------------------------------

test("channelRunEventSink publishes every event; runs.created fires once at creation", () => {
  const channel = new FakeChannel();
  const sink = channelRunEventSink(channel);
  const at = new Date().toISOString();
  const run = {
    id: "run-1",
    loopId: "loop-1",
    status: "pending",
    iteration: 1,
    createdAt: at,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  } as const;

  sink("run-1", { seq: 1, runId: "run-1", at, type: "runStatus", status: "pending", run: { ...run } });
  sink("run-1", { seq: 2, runId: "run-1", at, type: "usage", usage: { inputTokens: 3, outputTokens: 4, costUsd: 0 } });
  sink("run-1", { seq: 3, runId: "run-1", at, type: "runStatus", status: "active", run: { ...run, status: "active" } });

  assert.equal(channel.published.length, 3);
  assert.equal(channel.lastSeqFor("run-1"), 3);
  // Exactly one runs.created — the pending runStatus, never later statuses.
  assert.equal(channel.broadcasts.length, 1);
  assert.equal(channel.broadcasts[0]!.method, "runs.created");
  assert.equal((channel.broadcasts[0]!.params as { run: { id: string } }).run.id, "run-1");
});
