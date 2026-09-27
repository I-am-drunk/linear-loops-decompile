import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLoopsServer, type LoopsServer } from "./index.ts";
import { RpcClient } from "../connect/client.ts";
import type { LoopRecord, LoopSummary } from "../model/loop.ts";

async function boot(): Promise<{ server: LoopsServer; client: RpcClient; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "loops-domain-"));
  const server = createLoopsServer({ dbPath: join(dir, "t.db"), token: "t" });
  await new Promise<void>((r) => server.http.listen(0, r));
  const client = await RpcClient.connect(`ws://127.0.0.1:${server.port()}/ws`, "t");
  return { server, client, dir };
}

const NEW_LOOP = {
  name: "Triage sweeper",
  triggerType: "event",
  trigger: { event: "issue", activationMode: "watchedPropertyChanged" },
  conditions: [{ watchedProperties: ["stateId"] }],
  prompt: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Sweep triage" }] }] },
};

async function list(client: RpcClient): Promise<LoopSummary[]> {
  return (await client.call<{ loops: LoopSummary[] }>("loops.list")).loops;
}

test("create is draft-only and unpublished; get returns the draft", async () => {
  const { server, client, dir } = await boot();
  try {
    const created = await client.call<{ id: string; slugId: string }>("loops.upsert", { input: NEW_LOOP });
    assert.ok(created.id.startsWith("loop_"));
    assert.equal(created.slugId.length, 8);

    const [row] = await list(client);
    assert.equal(row.name, "Triage sweeper");
    assert.equal(row.published, false);
    assert.equal(row.hasDraft, true);
    assert.equal(row.enabled, false);

    const got = await client.call<{ loop: LoopRecord; published: boolean; hasDraft: boolean }>("loops.get", { id: created.slugId });
    assert.equal(got.published, false);
    assert.equal(got.hasDraft, true);
    assert.equal(got.loop.live, null);
    assert.equal(got.loop.draft?.triggerType, "event");
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});

test("publish replaces live with the draft and bumps version; later edits stay on the draft", async () => {
  const { server, client, dir } = await boot();
  try {
    const { id } = await client.call<{ id: string }>("loops.upsert", { input: NEW_LOOP });
    const pub = await client.call<{ version: number; publishedAt: string }>("loops.publish", { id });
    assert.equal(pub.version, 1);
    assert.ok(pub.publishedAt);

    let got = await client.call<{ loop: LoopRecord }>("loops.get", { id });
    assert.equal(got.loop.live?.name, "Triage sweeper");
    assert.equal(got.loop.draft, null);

    // Edit: draft changes, live untouched until the next publish.
    await client.call("loops.upsert", { id, input: { description: "v2 note" } });
    got = await client.call<{ loop: LoopRecord }>("loops.get", { id });
    assert.equal(got.loop.live?.description, undefined);
    assert.equal(got.loop.draft?.description, "v2 note");
    assert.equal(got.loop.draft?.name, "Triage sweeper"); // merge keeps prior fields

    const pub2 = await client.call<{ version: number }>("loops.publish", { id });
    assert.equal(pub2.version, 2);
    got = await client.call<{ loop: LoopRecord }>("loops.get", { id });
    assert.equal(got.loop.live?.description, "v2 note");
    assert.equal(got.loop.draft, null);
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});

test("setEnabled toggles the live loop and rejects unpublished ones", async () => {
  const { server, client, dir } = await boot();
  try {
    const { id } = await client.call<{ id: string }>("loops.upsert", { input: NEW_LOOP });
    await assert.rejects(client.call("loops.setEnabled", { id, enabled: true }), /not published/);

    await client.call("loops.publish", { id });
    const r = await client.call<{ enabled: boolean }>("loops.setEnabled", { id, enabled: true });
    assert.equal(r.enabled, true);

    const [row] = await list(client);
    assert.equal(row.enabled, true);

    const kinds = server.store.auditTail(50).map((e) => e.kind);
    for (const k of ["loops.created", "loops.published", "loops.enabled"]) {
      assert.ok(kinds.includes(k), `audit missing ${k}`);
    }
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});

test("validation: bad triggerType, unknown field, empty publish, missing loop", async () => {
  const { server, client, dir } = await boot();
  try {
    await assert.rejects(
      client.call("loops.upsert", { input: { name: "x", triggerType: "hourly" } }),
      /triggerType must be/,
    );
    await assert.rejects(
      client.call("loops.upsert", { input: { name: "x", triggerType: "chat", bogus: 1 } }),
      /unknown loop field: bogus/,
    );
    await assert.rejects(client.call("loops.publish", { id: "loop_nope" }), (e: Error & { code?: string }) => {
      assert.equal(e.code, "not_found");
      return true;
    });
    const { id } = await client.call<{ id: string }>("loops.upsert", { input: NEW_LOOP });
    await client.call("loops.publish", { id });
    await assert.rejects(client.call("loops.publish", { id }), /nothing to publish/);
    await assert.rejects(
      client.call("loops.upsert", { id, input: { trigger: { activationMode: "sideways" } } }),
      /activationMode must be/,
    );
  } finally {
    client.close(); await server.close(); await rm(dir, { recursive: true, force: true });
  }
});
