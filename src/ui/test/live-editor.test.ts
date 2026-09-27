/**
 * T-805 unit tests: the editor container's source seam — getLoop on the
 * live source (RPC verb + record mapping) and the fixture source (the demo
 * record the offline editor paints). Runs under
 * `node --experimental-strip-types --test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  FixtureLoopsSource,
  LiveLoopsSource,
  type ChannelRpc,
} from "../src/live/sources.ts";
import type { WireLoop } from "../src/live/contract.ts";
import type { LoopConfig } from "../../model/index.ts";
import { demoEditorConfig } from "../src/features/loops/editor/fixtures.ts";

class FakeRpc implements ChannelRpc {
  readonly calls: { method: string; params: unknown }[] = [];
  readonly responses = new Map<string, unknown>();
  onEvent: ((runId: string, seq: number, event: Record<string, unknown> & { type: string }) => void) | undefined;
  onStateChange: ((state: "connecting" | "open" | "closed") => void) | undefined;

  request(method: string, params?: unknown): Promise<unknown> {
    this.calls.push({ method, params });
    const response = this.responses.get(method);
    if (response === undefined) return Promise.reject(new Error(`no fake response for ${method}`));
    return Promise.resolve(response);
  }

  unsubscribe(): void {}
}

const mkWireLoop = (over: Partial<WireLoop>): WireLoop => ({
  id: over.id ?? "loop-9",
  name: over.name ?? "Triage digest",
  enabled: true,
  version: over.version ?? 7,
  config: {
    name: "Triage digest",
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
    ...over.config,
  } satisfies LoopConfig,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
  ...over,
});

test("LiveLoopsSource.getLoop: loops.get verb, record carries config + version", async () => {
  const rpc = new FakeRpc();
  rpc.responses.set("loops.get", { loop: mkWireLoop({ id: "loop-9", version: 7 }) });
  const source = new LiveLoopsSource(rpc);
  const rec = await source.getLoop("loop-9");
  assert.deepEqual(rpc.calls, [{ method: "loops.get", params: { id: "loop-9" } }]);
  assert.equal(rec.id, "loop-9");
  assert.equal(rec.version, 7);
  assert.equal(rec.name, "Triage digest");
  assert.equal(rec.config.trigger.type, "chat");
});

test("LiveLoopsSource.getLoop: empty row name falls back to config.name", async () => {
  const rpc = new FakeRpc();
  rpc.responses.set("loops.get", { loop: mkWireLoop({ name: "", config: { name: "From config" } as LoopConfig }) });
  const source = new LiveLoopsSource(rpc);
  const rec = await source.getLoop("loop-1");
  assert.equal(rec.name, "From config");
});

test("FixtureLoopsSource.getLoop: the demo record behind the offline editor", async () => {
  const source = new FixtureLoopsSource();
  const rec = await source.getLoop("anything");
  assert.equal(rec.version, 3);
  assert.equal(rec.name, demoEditorConfig.name);
  assert.equal(rec.config, demoEditorConfig);
});

test("FixtureLoopsSource.saveLoop still refuses loudly (demo publish path)", async () => {
  const source = new FixtureLoopsSource();
  await assert.rejects(() => source.saveLoop(null, demoEditorConfig), /connected server/);
});
