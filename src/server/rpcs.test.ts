/**
 * T-1103 tests — the composition-root domain RPCs: loops.* CRUD + scheduler
 * reload hooks, runs.list/get (live-first + durable fallback), wire shapes,
 * param/error mapping, and the runs.created publisher. In-memory store +
 * real Runner; the channel is a recording fake (the structural DomainChannel
 * — the real ChannelServer's socket behavior is src/connect's own test
 * file's business). Run: node --experimental-strip-types --test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultLoopConfig } from "../model/loop-config.ts";
import { ScriptBrain } from "../runtime/brain.ts";
import { Runner } from "../runtime/runner.ts";
import type { Run, RunEvent, Turn } from "../runtime/types.ts";
import { openDatabase } from "./db.ts";
import { createRunEventPublisher, registerDomainRpcs, toWireLoop } from "./rpcs.ts";
import { Store } from "./store.ts";

type Handler = (params: unknown, ctx: unknown) => unknown;

function makeRig(options: { withOrchestrator?: boolean; lastSeq?: number } = {}) {
  const db = openDatabase(":memory:");
  const store = new Store(db);
  let runnerId = 0;
  const runner = new Runner({ idgen: () => `rid-${runnerId++}` });
  const handlers = new Map<string, Handler>();
  let loopId = 0;
  const reloads = { count: 0 };
  const lastSeq = options.lastSeq;
  registerDomainRpcs(
    {
      register: (method, handler) => handlers.set(method, handler),
      ...(lastSeq !== undefined ? { lastSeqFor: () => lastSeq } : {}),
    },
    {
      store,
      runner,
      ...(options.withOrchestrator !== false
        ? {
            orchestrator: {
              reloadLoops: () => {
                reloads.count += 1;
                return { scheduled: 0, event: 0, chat: 0 };
              },
            },
          }
        : {}),
      idgen: () => `loop-${loopId++}`,
    },
  );
  const call = (method: string, params?: unknown): unknown => {
    const handler = handlers.get(method);
    assert.ok(handler !== undefined, `${method} registered`);
    return handler(params ?? {}, {});
  };
  return { db, store, runner, handlers, call, reloads };
}

/** Shorthand for seeding run rows straight into the durable mirror. */
function seedRun(store: Store, id: string, loopId: string, createdAt: string): Run {
  const run: Run = {
    id,
    loopId,
    status: "complete",
    iteration: 1,
    createdAt,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  };
  store.insertRun(run);
  return run;
}

function seedTurn(store: Store, id: string, runId: string, position: number): Turn {
  const turn: Turn = {
    id,
    runId,
    position,
    role: "agent",
    status: "complete",
    parts: [{ kind: "response", text: `turn ${position} text` }],
    startedAt: "2026-09-27T00:00:00.000Z",
    endedAt: "2026-09-27T00:00:01.000Z",
  };
  store.upsertTurn(turn);
  return turn;
}

describe("loops.* RPCs", () => {
  it("upsert creates a loop (draft — no scheduler reload), returns the wire loop", () => {
    const { call, store, reloads } = makeRig();
    const result = call("loops.upsert", { config: defaultLoopConfig() }) as { loop: ReturnType<typeof toWireLoop> };
    assert.equal(result.loop.id, "loop-0", "idgen mints the id when absent");
    assert.equal(result.loop.version, 1);
    assert.equal(result.loop.name, "New loop");
    assert.equal(result.loop.config.trigger.type, "schedule");
    assert.equal(result.loop.enabled, false, "creation honors the scaffold's enabled: false");
    assert.equal(store.getLoop("loop-0")!.enabled, false);
    assert.equal(reloads.count, 0, "draft writes never re-phase the live schedule");
    assert.deepEqual(
      store.listAudit({ loopId: "loop-0" }).map((e) => e["kind"]),
      ["loop.created", "loop.disabled"],
    );
  });

  it("upsert create with enabled: true stays enabled", () => {
    const { call, store } = makeRig();
    const result = call("loops.upsert", {
      config: { ...defaultLoopConfig(), enabled: true },
    }) as { loop: ReturnType<typeof toWireLoop> };
    assert.equal(result.loop.enabled, true);
    assert.equal(store.getLoop("loop-0")!.enabled, true);
    assert.deepEqual(
      store.listAudit({ loopId: "loop-0" }).map((e) => e["kind"]),
      ["loop.created"],
    );
  });

  it("upsert with an id replaces the draft (version bumps, still no reload)", () => {
    const { call, reloads } = makeRig();
    call("loops.upsert", { config: defaultLoopConfig() });
    const again = call("loops.upsert", {
      id: "loop-0",
      config: { ...defaultLoopConfig(), name: "Renamed" },
    }) as { loop: ReturnType<typeof toWireLoop> };
    assert.equal(again.loop.version, 2);
    assert.equal(again.loop.name, "Renamed");
    assert.equal(reloads.count, 0);
  });

  it("upsert maps a bad config to invalid_params (not internal_error)", () => {
    const { call } = makeRig();
    assert.throws(() => call("loops.upsert", { config: { name: "" } }), (err: unknown) => {
      assert.equal((err as { code: string }).code, "invalid_params");
      return true;
    });
    assert.throws(() => call("loops.upsert", {}), (err: unknown) => {
      assert.equal((err as { code: string }).code, "invalid_params");
      return true;
    });
  });

  it("publish returns the loop and reloads the scheduler exactly once", () => {
    const { call, reloads } = makeRig();
    call("loops.upsert", { config: defaultLoopConfig() });
    const published = call("loops.publish", { id: "loop-0" }) as { loop: ReturnType<typeof toWireLoop> };
    assert.equal(published.loop.id, "loop-0");
    assert.equal(reloads.count, 1, "publish is the re-phasing action");
    assert.throws(() => call("loops.publish", { id: "nope" }), (err: unknown) => {
      assert.equal((err as { code: string }).code, "not_found");
      return true;
    });
  });

  it("setEnabled flips the row and reloads; unknown loop is not_found", () => {
    const { call, store, reloads } = makeRig();
    call("loops.upsert", { config: defaultLoopConfig() });
    const flipped = call("loops.setEnabled", { id: "loop-0", enabled: true }) as {
      loop: ReturnType<typeof toWireLoop>;
    };
    assert.equal(flipped.loop.enabled, true);
    assert.equal(store.getLoop("loop-0")!.enabled, true);
    assert.equal(reloads.count, 1);
    assert.throws(() => call("loops.setEnabled", { id: "nope", enabled: true }), (err: unknown) => {
      assert.equal((err as { code: string }).code, "not_found");
      return true;
    });
    assert.throws(() => call("loops.setEnabled", { id: "loop-0" }), (err: unknown) => {
      assert.equal((err as { code: string }).code, "invalid_params");
      return true;
    });
  });

  it("list/get return wire loops: config parsed, no display joins", () => {
    const { call } = makeRig();
    call("loops.upsert", { config: { ...defaultLoopConfig(), name: "Alpha" } });
    call("loops.upsert", { config: { ...defaultLoopConfig(), name: "Beta" } });
    const list = call("loops.list") as { loops: ReturnType<typeof toWireLoop>[] };
    assert.deepEqual(list.loops.map((l) => l.name), ["Alpha", "Beta"]);
    const wire = list.loops[0]!;
    assert.equal(typeof wire.config, "object", "configJson arrives parsed");
    assert.equal("configJson" in wire, false, "the raw column never crosses the wire");
    assert.equal("ownerName" in wire, false, "no server-side directory — contract allows absence");
    const got = call("loops.get", { id: "loop-1" }) as { loop: ReturnType<typeof toWireLoop> };
    assert.equal(got.loop.name, "Beta");
    assert.throws(() => call("loops.get", { id: "nope" }), (err: unknown) => {
      assert.equal((err as { code: string }).code, "not_found");
      return true;
    });
  });
});

describe("runs.* RPCs", () => {
  it("runs.list is newest-first with loopId filter and limit", () => {
    const { call, store } = makeRig();
    store.saveLoop("loop-a", defaultLoopConfig());
    store.saveLoop("loop-b", defaultLoopConfig());
    seedRun(store, "run-1", "loop-a", "2026-09-27T00:00:00.000Z");
    seedRun(store, "run-2", "loop-a", "2026-09-27T00:01:00.000Z");
    seedRun(store, "run-3", "loop-b", "2026-09-27T00:02:00.000Z");
    const all = call("runs.list") as { runs: Run[] };
    assert.deepEqual(all.runs.map((r) => r.id), ["run-3", "run-2", "run-1"]);
    const forA = call("runs.list", { loopId: "loop-a" }) as { runs: Run[] };
    assert.deepEqual(forA.runs.map((r) => r.id), ["run-2", "run-1"]);
    const capped = call("runs.list", { limit: 1 }) as { runs: Run[] };
    assert.deepEqual(capped.runs.map((r) => r.id), ["run-3"]);
    // Full reconstruction: usage/target/optional fields round-trip.
    assert.deepEqual(all.runs[0]!.usage, { inputTokens: 0, outputTokens: 0, costUsd: 0 });
    assert.equal(all.runs[0]!.status, "complete");
  });

  it("runs.list validates limit and loopId", () => {
    const { call } = makeRig();
    for (const bad of [{ limit: 0 }, { limit: -2 }, { limit: 2.5 }, { limit: 501 }, { loopId: "" }]) {
      assert.throws(() => call("runs.list", bad), (err: unknown) => {
        assert.equal((err as { code: string }).code, "invalid_params");
        return true;
      });
    }
  });

  it("runs.get serves the live Runner first (freshest record + turns + lastSeq)", async () => {
    const { call, runner } = makeRig({ lastSeq: 7 });
    const run = runner.start({
      loopId: "loop-a",
      message: "ping",
      brain: new ScriptBrain([[{ kind: "response", text: "pong" }]]),
      runId: "run-live",
      iteration: 1,
    });
    await runner.whenIdle(run.id);
    const got = call("runs.get", { id: "run-live" }) as { run: Run; turns: Turn[]; lastSeq: number };
    assert.equal(got.run.status, "complete");
    assert.equal(got.run.id, "run-live");
    assert.ok(got.turns.some((t) => t.parts.some((p) => p.kind === "response" && p.text === "pong")));
    assert.equal(got.lastSeq, 7, "the channel's publish counter crosses for sinceSeq resumes");
  });

  it("runs.get falls back to the durable store when the Runner never saw the run", () => {
    const { call, store } = makeRig({ lastSeq: 3 });
    store.saveLoop("loop-a", defaultLoopConfig());
    seedRun(store, "run-old", "loop-a", "2026-09-26T23:00:00.000Z");
    seedTurn(store, "turn-1", "run-old", 0);
    seedTurn(store, "turn-2", "run-old", 1);
    const got = call("runs.get", { id: "run-old" }) as { run: Run; turns: Turn[]; lastSeq: number };
    assert.equal(got.run.id, "run-old");
    assert.deepEqual(got.turns.map((t) => t.id), ["turn-1", "turn-2"], "position order");
    assert.equal(got.turns[0]!.parts[0]!.kind, "response");
    assert.equal(got.lastSeq, 3);
  });

  it("runs.get unknown run is not_found", () => {
    const { call } = makeRig();
    assert.throws(() => call("runs.get", { id: "ghost" }), (err: unknown) => {
      assert.equal((err as { code: string }).code, "not_found");
      return true;
    });
  });
});

describe("createRunEventPublisher", () => {
  function fakeRun(status: Run["status"]): Run {
    return {
      id: "run-1",
      loopId: "loop-a",
      status,
      iteration: 1,
      createdAt: "2026-09-27T00:00:00.000Z",
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    };
  }

  function statusEvent(status: Run["status"], seq: number): RunEvent {
    return { seq, runId: "run-1", at: "2026-09-27T00:00:00.000Z", type: "runStatus", status, run: fakeRun(status) };
  }

  it("publishes every event; broadcasts runs.created once, on the pending status", () => {
    const published: { runId: string; event: RunEvent }[] = [];
    const broadcasts: { method: string; params: unknown }[] = [];
    const publish = createRunEventPublisher({
      publishRunEvent: (runId, event) => (published.push({ runId, event }), published.length),
      broadcast: (method, params) => (broadcasts.push({ method, params }), 1),
    });
    publish("run-1", statusEvent("pending", 1));
    publish("run-1", statusEvent("active", 2));
    publish("run-1", statusEvent("complete", 3));
    assert.equal(published.length, 3, "every event fans out to subscribers");
    assert.equal(broadcasts.length, 1, "exactly one runs.created");
    assert.equal(broadcasts[0]!.method, "runs.created");
    assert.equal(((broadcasts[0]!.params as { run: Run }).run).id, "run-1");
  });

  it("a channel without broadcast still publishes (structural optional)", () => {
    const published: string[] = [];
    const publish = createRunEventPublisher({
      publishRunEvent: (runId) => (published.push(runId), 1),
    });
    publish("run-1", statusEvent("pending", 1));
    assert.deepEqual(published, ["run-1"]);
  });
});
