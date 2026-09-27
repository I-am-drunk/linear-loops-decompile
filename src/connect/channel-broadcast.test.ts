/**
 * T-1103 — channel accessors for the composition root: `lastSeqFor` (the
 * runs.get → runs.subscribe race closer) and `broadcast` (runs.created-style
 * list signals, scope-filtered).
 * Run: node --experimental-strip-types --test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { TokenStore } from "./tokens.ts";
import type { Scope } from "./tokens.ts";
import { ChannelServer } from "./channel.ts";

const READ_ONLY: Scope[] = ["runs:read"];
const WRITE_ONLY: Scope[] = ["runs:write"];

interface Rig {
  server: Server;
  channel: ChannelServer;
  tokens: TokenStore;
  url: string;
  close: () => Promise<void>;
}

async function makeRig(): Promise<Rig> {
  const tokens = new TokenStore();
  const channel = new ChannelServer({
    tokens,
    registry: { has: () => true, activeRunIds: () => [] },
  });
  const server = createServer((_req, res) => {
    res.writeHead(404).end();
  });
  channel.attach(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    channel,
    tokens,
    url: `ws://127.0.0.1:${port}/connect`,
    close: () =>
      new Promise<void>((r) => {
        channel.closeAll();
        server.close(() => r());
      }),
  };
}

/** Connect a raw socket, authenticate first-frame, collect every frame. */
async function authedSocket(
  url: string,
  token: string,
): Promise<{ frames: Record<string, unknown>[]; ws: WebSocket }> {
  const ws = new WebSocket(url);
  const frames: Record<string, unknown>[] = [];
  ws.addEventListener("message", (ev) => frames.push(JSON.parse(ev.data as string)));
  await new Promise<void>((r) => ws.addEventListener("open", () => r(), { once: true }));
  ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "auth", params: { token } }));
  // Wait for the auth result frame.
  for (let i = 0; i < 100 && !frames.some((f) => f["id"] === 1); i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.ok(frames.some((f) => f["id"] === 1 && (f["result"] as Record<string, unknown>)?.["ok"] === true));
  return { frames, ws };
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

test("lastSeqFor(): 0 before any publish, tracks publishRunEvent's stamps", () => {
  const channel = new ChannelServer({
    tokens: new TokenStore(),
    registry: { has: () => true, activeRunIds: () => [] },
  });
  assert.equal(channel.lastSeqFor("run-1"), 0);
  const seq1 = channel.publishRunEvent("run-1", { type: "runStatus" });
  assert.equal(seq1, 1);
  assert.equal(channel.lastSeqFor("run-1"), 1);
  channel.publishRunEvent("run-1", { type: "usage" });
  assert.equal(channel.lastSeqFor("run-1"), 2);
  // Per-run: another run's seq is independent.
  assert.equal(channel.lastSeqFor("run-2"), 0);
  channel.publishRunEvent("run-2", { type: "runStatus" });
  assert.equal(channel.lastSeqFor("run-2"), 1);
  assert.equal(channel.lastSeqFor("run-1"), 2);
});

test("broadcast(): only authenticated connections holding the scope receive", async () => {
  const rig = await makeRig();
  const reader = rig.tokens.mint({ scopes: READ_ONLY });
  const writer = rig.tokens.mint({ scopes: WRITE_ONLY });
  const a = await authedSocket(rig.url, reader.token);
  const b = await authedSocket(rig.url, writer.token);
  const before = a.frames.length;

  const sent = rig.channel.broadcast("runs.created", { run: { id: "run-1" } });
  assert.equal(sent, 1); // the runs:read conn only — runs:write lacks the default scope
  await wait(50);

  const created = a.frames.slice(before).filter((f) => f["method"] === "runs.created");
  assert.equal(created.length, 1);
  assert.deepEqual(created[0]!["params"], { run: { id: "run-1" } });
  assert.equal(b.frames.filter((f) => f["method"] === "runs.created").length, 0);

  // An explicit scope override reaches the other token instead.
  const sentWrite = rig.channel.broadcast("runs.created", { run: { id: "run-2" } }, "runs:write");
  assert.equal(sentWrite, 1);
  await wait(50);
  assert.equal(b.frames.filter((f) => f["method"] === "runs.created").length, 1);

  a.ws.close();
  b.ws.close();
  await rig.close();
});
