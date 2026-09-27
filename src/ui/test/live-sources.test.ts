/**
 * T-1104 unit tests for the data sources against a fake channel — no socket.
 * Runs under `node --experimental-strip-types --test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  FixtureLoopsSource,
  FixtureRunsSource,
  LiveLoopsSource,
  LiveRunsSource,
  selectSources,
  type ChannelRpc,
} from "../src/live/sources.ts";
import type { WireLoop, WireRun, WireTurn } from "../src/live/contract.ts";
import type { RunEvent } from "../../runtime/types.ts";
import type { ChannelClient } from "../../connect/client.ts";
import type { LoopConfig } from "../../model/index.ts";
import { demoLoops } from "../src/features/loops/fixtures.ts";

interface Call {
  readonly method: string;
  readonly params: unknown;
}

class FakeRpc implements ChannelRpc {
  readonly calls: Call[] = [];
  readonly responses = new Map<string, unknown>();
  #runHandler: ((event: Record<string, unknown> & { type: string }, seq: number) => void) | undefined;
  unsubscribed: string[] = [];

  request(method: string, params?: unknown): Promise<unknown> {
    this.calls.push({ method, params });
    const response = this.responses.get(method);
    if (response === undefined) return Promise.reject(new Error(`no fake response for ${method}`));
    return Promise.resolve(response);
  }

  subscribeRuns(_runId: string, onEvent?: (event: Record<string, unknown> & { type: string }, seq: number) => void): Promise<unknown> {
    this.#runHandler = onEvent;
    return Promise.resolve({ ok: true, replayed: 0, truncated: false, active: [] });
  }

  unsubscribe(runId: string): void {
    this.unsubscribed.push(runId);
  }

  emit(event: RunEvent): void {
    this.#runHandler?.(event, event.seq);
  }
}

const mkRun = (over: Partial<WireRun>): WireRun => ({
  id: over.id ?? "run-1",
  loopId: over.loopId ?? "loop-1",
  status: over.status ?? "complete",
  iteration: 1,
  createdAt: "2026-09-27T10:00:00.000Z",
  usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  ...over,
});

const mkLoop = (over: Partial<WireLoop>): WireLoop => ({
  id: over.id ?? "loop-1",
  name: over.name ?? "Triage digest",
  enabled: over.enabled ?? true,
  version: 1,
  config: {
    name: over.name ?? "Triage digest",
    prompt: { format: "markdown", markdown: "Summarize" },
    trigger: { type: "chat" },
    conditions: [],
    enabled: true,
    applyToSubTeams: false,
    activities: ["comment"],
    trustedSourceKeys: [],
    codeAccess: "none",
    editAccess: "team",
    subscriberIds: [],
  } satisfies LoopConfig,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
  ...over,
});

test("LiveLoopsSource.listLoops: joins the most recent run per loop as the chip", async () => {
  const rpc = new FakeRpc();
  rpc.responses.set("loops.list", { loops: [mkLoop({ id: "loop-1" }), mkLoop({ id: "loop-2", name: "SLA watch" })] });
  rpc.responses.set("runs.list", {
    runs: [
      mkRun({ id: "r1", loopId: "loop-1", createdAt: "2026-09-26T09:00:00.000Z" }),
      mkRun({
        id: "r2", loopId: "loop-1", status: "error", createdAt: "2026-09-27T09:00:00.000Z",
        startedAt: "2026-09-27T09:00:01.000Z", endedAt: "2026-09-27T09:00:05.000Z",
      }),
    ],
  });
  const loops = await new LiveLoopsSource(rpc).listLoops();
  assert.equal(loops.length, 2);
  assert.equal(loops[0]!.lastRun?.status, "error");
  assert.equal(loops[0]!.lastRun?.at, "2026-09-27T09:00:05.000Z");
  assert.equal(loops[1]!.lastRun, undefined);
});

test("LiveLoopsSource.setEnabled + saveLoop: exact RPC verbs, publish after upsert", async () => {
  const rpc = new FakeRpc();
  rpc.responses.set("loops.setEnabled", { loop: mkLoop({ enabled: false }) });
  rpc.responses.set("loops.upsert", { loop: mkLoop({ id: "loop-9" }) });
  rpc.responses.set("loops.publish", { loop: mkLoop({ id: "loop-9", version: 2 }) });
  const source = new LiveLoopsSource(rpc);

  await source.setEnabled("loop-1", false);
  assert.deepEqual(rpc.calls[0], { method: "loops.setEnabled", params: { id: "loop-1", enabled: false } });

  const config = mkLoop({}).config;
  const id = await source.saveLoop(null, config);
  assert.equal(id, "loop-9");
  assert.deepEqual(rpc.calls.slice(1).map((c) => c.method), ["loops.upsert", "loops.publish"]);
  // create path: no id key at all on the upsert params
  assert.equal("id" in (rpc.calls[1]!.params as Record<string, unknown>), false);
});

test("LiveRunsSource.listRuns: pre-joins loop names; passes loopId through", async () => {
  const rpc = new FakeRpc();
  rpc.responses.set("loops.list", { loops: [mkLoop({ id: "loop-1", name: "Triage digest" })] });
  rpc.responses.set("runs.list", { runs: [mkRun({ id: "r1", loopId: "loop-1" })] });
  const runs = await new LiveRunsSource(rpc).listRuns("loop-1");
  assert.equal(runs[0]!.loopName, "Triage digest");
  const listCall = rpc.calls.find((c) => c.method === "runs.list")!;
  assert.deepEqual(listCall.params, { loopId: "loop-1", limit: 200 });
});

test("LiveRunsSource.watchRun: initial detail, live tail, unsubscribe", async () => {
  const rpc = new FakeRpc();
  const turns: WireTurn[] = [
    {
      id: "t1", runId: "r1", position: 0, role: "agent", status: "streaming",
      startedAt: "2026-09-27T10:00:01.000Z",
      parts: [{ kind: "thought", text: "Drafting." }],
    },
  ];
  rpc.responses.set("loops.list", { loops: [mkLoop({ id: "loop-1" })] });
  rpc.responses.set("runs.get", { run: mkRun({ id: "r1", status: "active" }), turns });

  const updates: string[] = [];
  const source = new LiveRunsSource(rpc);
  const unsub = await source.watchRun("r1", (d) => {
    updates.push(`${d.status}:${d.activities.length}`);
  });
  assert.deepEqual(updates, ["active:1"]);

  rpc.emit({ seq: 5, runId: "r1", at: "2026-09-27T10:00:09.000Z", type: "partAppended", turnId: "t1", part: { kind: "response", text: "Done" } });
  rpc.emit({ seq: 6, runId: "r1", at: "2026-09-27T10:00:10.000Z", type: "runStatus", status: "complete", run: mkRun({ id: "r1", status: "complete", summary: "Wrapped." }) });
  assert.deepEqual(updates, ["active:1", "active:2", "complete:2"]);

  unsub();
  assert.deepEqual(rpc.unsubscribed, ["r1"]);
});

test("fixture sources: offline behavior preserved (demo data, no-op intents, unknown run rejects)", async () => {
  const loops = new FixtureLoopsSource();
  assert.deepEqual(await loops.listLoops(), demoLoops);
  await loops.setEnabled("any", false); // no-op resolves
  await assert.rejects(() => loops.saveLoop(null, mkLoop({}).config));

  const runs = new FixtureRunsSource();
  assert.ok((await runs.listRuns()).length > 0);
  await assert.rejects(() => runs.getRun("nope"), /not in the offline fixture set/);
  let calls = 0;
  const unsub = await runs.watchRun("run-8", () => calls++);
  assert.equal(calls, 1);
  assert.equal(typeof unsub, "function");
});

test("selectSources: null client → fixtures; a client → live", () => {
  const fixture = selectSources(null);
  assert.equal(fixture.loops.kind, "fixture");
  assert.equal(fixture.runs.kind, "fixture");
  const live = selectSources(new FakeRpc() as unknown as ChannelClient);
  assert.equal(live.loops.kind, "live");
  assert.equal(live.runs.kind, "live");
});
