/**
 * T-1103 — composition-root wiring, socket level: createLoopsServer exposes
 * the attached channel with the domain RPCs live; the orchestrator appears
 * when a brainFor is supplied and its reloadLoops hooks every loop write.
 * Run: node --experimental-strip-types --test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { ChannelClient } from "../connect/client.ts";
import { defaultLoopConfig } from "../model/loop-config.ts";
import { ScriptBrain } from "../runtime/brain.ts";
import { createLoopsServer } from "./index.ts";
import type { LoopsServer } from "./index.ts";

const SCOPES = ["loops:read", "loops:write", "runs:read", "runs:write"] as const;

async function live(server: LoopsServer): Promise<ChannelClient> {
  const { token } = server.tokens.mint({ scopes: [...SCOPES] });
  const port = await server.listen(0, "127.0.0.1");
  const client = new ChannelClient({ url: `ws://127.0.0.1:${port}/connect`, token, reconnect: false });
  await client.connect();
  return client;
}

test("composition: domain RPCs answer over a real socket; no brainFor → orchestrator null", async () => {
  const loops = createLoopsServer({ dbPath: ":memory:" });
  assert.equal(loops.orchestrator, null);
  const client = await live(loops);

  const upserted = (await client.request("loops.upsert", { config: defaultLoopConfig() })) as {
    loop: { id: string; name: string };
  };
  assert.equal(upserted.loop.name, defaultLoopConfig().name);

  const listed = (await client.request("loops.list")) as { loops: { id: string }[] };
  assert.deepEqual(listed.loops.map((l) => l.id), [upserted.loop.id]);

  const toggled = (await client.request("loops.setEnabled", { id: upserted.loop.id, enabled: false })) as {
    loop: { enabled: boolean };
  };
  assert.equal(toggled.loop.enabled, false);

  const runs = (await client.request("runs.list", { limit: 10 })) as { runs: unknown[] };
  assert.deepEqual(runs.runs, []);

  // Scope gates still bite: unregistered method is a clean method_not_found.
  await assert.rejects(client.request("settings.get"), (e: unknown) => {
    assert.ok(e instanceof Error);
    assert.equal((e as Error & { code?: string }).code, "method_not_found");
    return true;
  });

  await client.close();
  await loops.close();
});

test("composition: brainFor lights the orchestrator; loop writes re-phase it", async () => {
  let brains = 0;
  const loops = createLoopsServer({
    dbPath: ":memory:",
    brainFor: () => {
      brains += 1;
      return new ScriptBrain([[{ kind: "response", text: "ok" }]]);
    },
  });
  assert.ok(loops.orchestrator !== null);
  const client = await live(loops);

  // Schedule-triggered loop lands in the registry via the boot reload…
  const scheduled = { ...defaultLoopConfig(), trigger: { type: "schedule", schedule: { rrule: "FREQ=HOURLY", timezone: "UTC" } } };
  await client.request("loops.upsert", { config: scheduled });
  // …and the write-time reload keeps the registry in step (1 scheduled entry).
  const entries = loops.orchestrator.reloadLoops();
  assert.deepEqual(entries, { scheduled: 1, event: 0, chat: 0 });

  // Disable it through the RPC → the next reload drops it from the registry.
  const listed = (await client.request("loops.list")) as { loops: { id: string }[] };
  await client.request("loops.setEnabled", { id: listed.loops[0]!.id, enabled: false });
  assert.deepEqual(loops.orchestrator.reloadLoops(), { scheduled: 0, event: 0, chat: 0 });
  assert.equal(brains, 0); // binding is lazy — no run, no brain

  await client.close();
  await loops.close();
});
