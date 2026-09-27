import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLoopsServer, type LoopsServer } from "./index.ts";
import { RpcClient } from "../connect/client.ts";
import type { LoopDetail, LoopSummary } from "../model/loop.ts";

async function boot(): Promise<{ server: LoopsServer; client: RpcClient; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "loops-rpc-"));
  const server = createLoopsServer({ dbPath: join(dir, "t.db"), token: "t" });
  await new Promise<void>((r) => server.http.listen(0, r));
  const client = await RpcClient.connect(`ws://127.0.0.1:${server.port()}/ws`, "t");
  return { server, client, dir };
}

const SCHEDULED = {
  name: "  Weekly digest  ",
  description: "posts a digest",
  triggerType: "schedule",
  schedule: "RRULE:FREQ=WEEKLY;BYDAY=MO",
  activities: ["comment"],
  trustedSourceKeys: ["slack"],
  codeAccess: "read",
  prompt: { type: "doc", content: [{ type: "paragraph" }] },
};

test("create via upsert, list, get: unpublished draft lifecycle", async () => {
  const { server, client, dir } = await boot();
  try {
    assert.deepEqual(await client.call("loops.list"), []);

    const created = await client.call<{ id: string; version: number; hasChanges: boolean }>(
      "loops.upsert",
      { input: SCHEDULED },
    );
    assert.ok(created.id.startsWith("loop_"));
    assert.equal(created.version, 0);
    assert.equal(created.hasChanges, true);

    const list = await client.call<LoopSummary[]>("loops.list");
    assert.equal(list.length, 1);
    assert.equal(list[0]!.name, "Weekly digest"); // trimmed
    assert.equal(list[0]!.triggerType, "schedule");
    assert.equal(list[0]!.enabled, false); // new loops start disabled
    assert.equal(list[0]!.hasChanges, true);
    assert.equal(list[0]!.publishedAt, undefined);
    assert.equal(list[0]!.lastExecutedAt, undefined);

    const got = await client.call<LoopDetail>("loops.get", { id: created.id });
    assert.equal(got.draft.codeAccess, "read");
    assert.deepEqual(got.draft.conditions, []);
    assert.deepEqual(got.config, got.draft); // live mirrors draft until first publish
    assert.equal(got.draft.applyToSubTeams, false);
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});

test("publish replaces the live config and bumps version; persists across reboot", async () => {
  const { server, client, dir } = await boot();
  let server2: LoopsServer | undefined;
  let client2: RpcClient | undefined;
  try {
    const { id } = await client.call<{ id: string }>("loops.upsert", { input: SCHEDULED });

    const p1 = await client.call<{ version: number; publishedAt?: string }>("loops.publish", { id });
    assert.equal(p1.version, 1);
    assert.ok(p1.publishedAt);
    assert.equal((await client.call<LoopSummary[]>("loops.list"))[0]!.hasChanges, false);

    // Nothing to publish: rejected.
    await assert.rejects(client.call("loops.publish", { id }), /no unpublished changes/);

    // Edit lands on the draft only; the live config is untouched.
    await client.call("loops.upsert", { id, input: { description: "posts the weekly digest" } });
    let got = await client.call<LoopDetail>("loops.get", { id });
    assert.equal(got.draft.description, "posts the weekly digest");
    assert.equal(got.config.description, "posts a digest");
    assert.equal(got.hasChanges, true);

    const p2 = await client.call<{ version: number }>("loops.publish", { id });
    assert.equal(p2.version, 2);
    got = await client.call<LoopDetail>("loops.get", { id });
    assert.equal(got.config.description, "posts the weekly digest");
    assert.equal(got.hasChanges, false);

    // Loops persist across reboots of the server.
    client.close();
    await server.close();
    server2 = createLoopsServer({ dbPath: join(dir, "t.db"), token: "t" });
    await new Promise<void>((r) => (server2 as LoopsServer).http.listen(0, r));
    client2 = await RpcClient.connect(`ws://127.0.0.1:${server2.port()}/ws`, "t");
    const list = await client2.call<LoopSummary[]>("loops.list");
    assert.equal(list.length, 1);
    assert.equal(list[0]!.version, 2);
  } finally {
    client.close();
    await server.close().catch(() => {});
    client2?.close();
    if (server2) await server2.close().catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
});

test("setEnabled writes live + draft; validation and not_found", async () => {
  const { server, client, dir } = await boot();
  try {
    const { id } = await client.call<{ id: string }>("loops.upsert", { input: SCHEDULED });
    await client.call("loops.publish", { id });

    await client.call("loops.setEnabled", { id, enabled: true });
    let got = await client.call<LoopDetail>("loops.get", { id });
    assert.equal(got.config.enabled, true);
    assert.equal(got.draft.enabled, true);

    // A later publish does not revert the toggle.
    await client.call("loops.upsert", { id, input: { description: "d2" } });
    await client.call("loops.publish", { id });
    got = await client.call<LoopDetail>("loops.get", { id });
    assert.equal(got.config.enabled, true);

    // Validation.
    await assert.rejects(
      client.call("loops.upsert", { input: { name: "x", triggerType: "bogus" } }),
      /triggerType must be/,
    );
    await assert.rejects(
      client.call("loops.upsert", { input: { name: "x", triggerType: "schedule" } }),
      /schedule required/,
    );
    await assert.rejects(
      client.call("loops.upsert", { input: { name: "x", triggerType: "event", trigger: { entity: "issue" } } }),
      /activationMode must be/,
    );
    await assert.rejects(
      client.call("loops.upsert", { input: { name: "x", triggerType: "chat", codeAccess: "root" } }),
      /codeAccess must be/,
    );
    await assert.rejects(
      client.call("loops.upsert", { input: { name: "x", triggerType: "chat", conditions: [{}] } }),
      /conditions\[0\] is empty/,
    );

    // Unknown ids are not_found.
    await assert.rejects(client.call("loops.get", { id: "loop_nope" }), (e: Error & { code?: string }) => {
      assert.equal(e.code, "not_found");
      return true;
    });
    await assert.rejects(client.call("loops.publish", { id: "loop_nope" }), /no loop/);
    await assert.rejects(client.call("loops.setEnabled", { id: "loop_nope", enabled: true }), /no loop/);
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});
