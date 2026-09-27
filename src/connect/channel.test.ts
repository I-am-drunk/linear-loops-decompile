/**
 * T-902 channel tests — real two-peer runs over 127.0.0.1 sockets:
 * auth (subprotocol + first-frame), 4401 timeout, scope gates, subscribe +
 * fan-out with monotonic seq, reconnect gap replay, runtime delegation.
 * Run: node --experimental-strip-types --test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { connect } from "node:net";
import type { AddressInfo, Socket } from "node:net";
import { TokenStore } from "./tokens.ts";
import type { Scope } from "./tokens.ts";
import { ChannelServer, METHOD_SCOPES } from "./channel.ts";
import type { RuntimeCommands } from "./channel.ts";
import { ChannelClient } from "./client.ts";
import { CLOSE_CODES } from "./ws.ts";

const FULL: Scope[] = ["env:read", "runs:read", "runs:write"];

interface Rig {
  server: Server;
  channel: ChannelServer;
  tokens: TokenStore;
  url: string;
  calls: { method: string; runId: string; text?: string }[];
  close: () => Promise<void>;
}

async function makeRig(options: { authTimeoutMs?: number } = {}): Promise<Rig> {
  const tokens = new TokenStore();
  const active = new Set<string>(["run-1"]);
  const calls: Rig["calls"] = [];
  const runtime: RuntimeCommands = {
    steer: (runId, text) => (calls.push({ method: "steer", runId, text }), { accepted: true }),
    cancel: (runId) => (calls.push({ method: "cancel", runId }), { canceled: true }),
    continue: (runId, text) => (calls.push({ method: "continue", runId, text }), { continued: true }),
  };
  const channel = new ChannelServer({
    tokens,
    registry: { has: (id) => active.has(id), activeRunIds: () => [...active] },
    runtime,
    descriptor: {
      id: "env-test",
      label: "test",
      platform: "linux",
      capabilities: ["loops", "runs", "settings"],
      protocol: 1,
      product: "loops-server",
      version: "0.1.0",
    },
    ...(options.authTimeoutMs !== undefined ? { authTimeoutMs: options.authTimeoutMs } : {}),
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
    calls,
    close: () =>
      new Promise<void>((r) => {
        channel.closeAll();
        server.close(() => r());
      }),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

test("channel: subprotocol auth + env.describe round-trip", async () => {
  const rig = await makeRig();
  const { token } = rig.tokens.mint({ scopes: FULL });
  const client = new ChannelClient({ url: rig.url, token, reconnect: false });
  await client.connect();
  const descriptor = (await client.request("env.describe")) as Record<string, unknown>;
  assert.equal(descriptor["product"], "loops-server");
  assert.equal(descriptor["id"], "env-test");
  await client.close();
  await rig.close();
});

test("channel: first-frame auth; unauthenticated calls are refused", async () => {
  const rig = await makeRig();
  const { token } = rig.tokens.mint({ scopes: FULL });
  const ws = new WebSocket(rig.url); // no subprotocol
  const frames: Record<string, unknown>[] = [];
  ws.addEventListener("message", (ev) => frames.push(JSON.parse(ev.data as string)));
  await new Promise<void>((r) => ws.addEventListener("open", () => r(), { once: true }));

  ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "env.describe" }));
  await wait(50);
  assert.equal((frames[0] as { error: { code: string } }).error.code, "unauthorized");

  ws.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "auth", params: { token } }));
  await wait(50);
  const authRes = frames.find((f) => f["id"] === 2) as { result: { ok: boolean; scopes: string[] } };
  assert.equal(authRes.result.ok, true);
  assert.deepEqual(authRes.result.scopes, FULL);

  ws.send(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "env.describe" }));
  await wait(50);
  const described = frames.find((f) => f["id"] === 3) as { result: { product: string } };
  assert.equal(described.result.product, "loops-server");
  ws.close();
  await rig.close();
});

test("channel: bad token on first frame -> error + 4401 close", async () => {
  const rig = await makeRig();
  const ws = new WebSocket(rig.url);
  await new Promise<void>((r) => ws.addEventListener("open", () => r(), { once: true }));
  ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "auth", params: { token: "t3_wrong" } }));
  const closed = await new Promise<number>((r) =>
    ws.addEventListener("close", (ev) => r((ev as unknown as { code: number }).code), { once: true }),
  );
  assert.equal(closed, CLOSE_CODES.UNAUTHORIZED);
  await rig.close();
});

test("channel: unauthenticated socket times out with 4401", async () => {
  const rig = await makeRig({ authTimeoutMs: 150 });
  const ws = new WebSocket(rig.url);
  const closed = await new Promise<number>((r) => {
    ws.addEventListener("open", () => {});
    ws.addEventListener("close", (ev) => r((ev as unknown as { code: number }).code), { once: true });
  });
  assert.equal(closed, CLOSE_CODES.UNAUTHORIZED);
  await rig.close();
});

test("channel: unknown method and bad params get stable string codes", async () => {
  const rig = await makeRig();
  const { token } = rig.tokens.mint({ scopes: FULL });
  const client = new ChannelClient({ url: rig.url, token, reconnect: false });
  await client.connect();
  await assert.rejects(client.request("nope.nope"), (e: Error & { code?: string }) => e.code === "method_not_found");
  await assert.rejects(client.request("runs.subscribe", {}), (e: Error & { code?: string }) => e.code === "invalid_params");
  await assert.rejects(client.request("runs.subscribe", { id: "ghost" }), (e: Error & { code?: string }) => e.code === "not_found");
  await client.close();
  await rig.close();
});

test("channel: scope gate — runs:write-less token cannot steer", async () => {
  const rig = await makeRig();
  const { token } = rig.tokens.mint({ scopes: ["env:read", "runs:read"] });
  const client = new ChannelClient({ url: rig.url, token, reconnect: false });
  await client.connect();
  await assert.rejects(
    client.request("runs.steer", { id: "run-1", text: "hi" }),
    (e: Error & { code?: string }) => e.code === "insufficient_scope",
  );
  assert.equal(rig.calls.length, 0); // never reached the runtime
  await client.close();
  await rig.close();
});

test("channel: steer/cancel/continue delegate to the runtime seam", async () => {
  const rig = await makeRig();
  const { token } = rig.tokens.mint({ scopes: FULL });
  const client = new ChannelClient({ url: rig.url, token, reconnect: false });
  await client.connect();
  assert.deepEqual(await client.request("runs.steer", { id: "run-1", text: "focus" }), { accepted: true });
  assert.deepEqual(await client.request("runs.cancel", { id: "run-1" }), { canceled: true });
  assert.deepEqual(await client.request("runs.continue", { id: "run-1", text: "go" }), { continued: true });
  assert.deepEqual(
    rig.calls.map((c) => c.method),
    ["steer", "cancel", "continue"],
  );
  await client.close();
  await rig.close();
});

test("channel: subscribe fan-out with monotonic seq + presence-lite", async () => {
  const rig = await makeRig();
  const { token } = rig.tokens.mint({ scopes: FULL });
  const client = new ChannelClient({ url: rig.url, token, reconnect: false });
  await client.connect();

  const events: { seq: number; type: string }[] = [];
  const sub = (await client.subscribeRuns("run-1", (event, seq) => events.push({ seq, type: event.type }))) as {
    ok: boolean; active: string[]; replayed: number; truncated: boolean;
  };
  assert.equal(sub.ok, true);
  assert.deepEqual(sub.active, ["run-1"]); // presence-lite on subscribe
  assert.equal(sub.replayed, 0);

  rig.channel.publishRunEvent("run-1", { type: "status", state: "active" });
  rig.channel.publishRunEvent("run-1", { type: "part", text: "hello" });
  rig.channel.publishRunEvent("run-1", { type: "done" });
  await wait(50);
  assert.deepEqual(events, [
    { seq: 1, type: "status" },
    { seq: 2, type: "part" },
    { seq: 3, type: "done" },
  ]);
  await client.close();
  await rig.close();
});

test("channel: reconnect resumes with sinceSeq gap replay, no dupes", async () => {
  const rig = await makeRig();
  const { token } = rig.tokens.mint({ scopes: FULL });
  const client = new ChannelClient({ url: rig.url, token, minDelayMs: 25, maxDelayMs: 50 });
  await client.connect();

  const events: number[] = [];
  await client.subscribeRuns("run-1", (_e, seq) => events.push(seq));
  rig.channel.publishRunEvent("run-1", { type: "part", n: 1 });
  rig.channel.publishRunEvent("run-1", { type: "part", n: 2 });
  await wait(50);
  assert.deepEqual(events, [1, 2]);

  // Drop the link server-side (graceful close — client reconnects on its own),
  // then publish two events while the client is down.
  rig.channel.closeAll();
  rig.channel.publishRunEvent("run-1", { type: "part", n: 3 });
  rig.channel.publishRunEvent("run-1", { type: "part", n: 4 });
  await wait(400); // reconnect (25ms backoff) + sinceSeq replay
  assert.deepEqual(events, [1, 2, 3, 4]);
  await client.close();
  await rig.close();
});

test("channel: METHOD_SCOPES covers the spec's v1 RPC surface", () => {
  for (const m of [
    "env.describe", "loops.list", "loops.get", "loops.upsert", "loops.publish", "loops.setEnabled",
    "runs.list", "runs.get", "runs.subscribe", "runs.steer", "runs.cancel", "runs.continue",
    "settings.get", "settings.setLinear", "settings.setInference", "settings.testInference",
    "dataplane.probe",
  ]) {
    assert.ok(METHOD_SCOPES[m] !== undefined, `missing scope gate for ${m}`);
  }
});

/** Hand-rolled client frame (masked, per RFC 6455 §5.3). Payloads < 126B only. */
function maskedClientFrame(opcode: number, payload: Buffer, fin: boolean): Buffer {
  assert.ok(payload.length < 126);
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const header = Buffer.alloc(6);
  header[0] = (fin ? 0x80 : 0) | opcode;
  header[1] = 0x80 | payload.length;
  mask.copy(header, 2);
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) masked[i] = masked[i]! ^ mask[i % 4]!;
  return Buffer.concat([header, masked]);
}

/** Read one (unmasked, < 126B payload) server frame. */
function nextServerFrame(sock: Socket): Promise<{ opcode: number; payload: Buffer }> {
  return new Promise((resolve) => {
    let buf = Buffer.alloc(0);
    const onData = (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      if (buf.length < 2) return;
      const len = buf[1]! & 0x7f;
      if (buf.length < 2 + len) return;
      sock.off("data", onData);
      resolve({ opcode: buf[0]! & 0x0f, payload: Buffer.from(buf.subarray(2, 2 + len)) });
    };
    sock.on("data", onData);
  });
}

test("ws codec: raw handshake, fragmented reassembly, unmasked refusal (1002)", async () => {
  const rig = await makeRig();
  const { token } = rig.tokens.mint({ scopes: FULL });
  const port = Number(new URL(rig.url.replace("ws://", "http://")).port);

  const sock = connect(port, "127.0.0.1");
  const handshake = await new Promise<string>((resolve) => {
    let buf = "";
    sock.on("data", (d: Buffer) => {
      buf += d.toString("latin1");
      if (buf.includes("\r\n\r\n")) resolve(buf);
    });
    sock.write(
      "GET /connect HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n",
    );
  });
  assert.ok(handshake.startsWith("HTTP/1.1 101"), handshake.slice(0, 80));

  // Auth message split across a fragmented text message (text + continuation).
  const authText = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "auth", params: { token } });
  const half = Math.floor(authText.length / 2);
  sock.write(maskedClientFrame(0x1, Buffer.from(authText.slice(0, half), "utf8"), false));
  sock.write(maskedClientFrame(0x0, Buffer.from(authText.slice(half), "utf8"), true));
  const authResp = await nextServerFrame(sock);
  assert.equal(authResp.opcode, 0x1);
  assert.ok(authResp.payload.toString("utf8").includes('"ok":true'), authResp.payload.toString("utf8"));

  // An unmasked client frame must be refused with a protocol close (1002).
  sock.write(Buffer.concat([Buffer.from([0x81, 2]), Buffer.from("hi")]));
  const closeFrame = await nextServerFrame(sock);
  assert.equal(closeFrame.opcode, 0x8);
  assert.equal(closeFrame.payload.readUInt16BE(0), 1002);

  sock.destroy();
  await rig.close();
});


test("channel: lastSeqFor tracks the per-run publish counter", async () => {
  const rig = await makeRig();
  assert.equal(rig.channel.lastSeqFor("run-1"), 0, "nothing published yet");
  rig.channel.publishRunEvent("run-1", { type: "runStatus" });
  rig.channel.publishRunEvent("run-1", { type: "usage" });
  assert.equal(rig.channel.lastSeqFor("run-1"), 2);
  assert.equal(rig.channel.lastSeqFor("run-9"), 0, "unknown runs read 0 — a fresh subscribe");
  await rig.close();
});

test("channel: broadcast reaches authenticated connections only", async () => {
  const rig = await makeRig();
  const { token } = rig.tokens.mint({ scopes: FULL });
  const anon = new WebSocket(rig.url); // never authenticates (5s timeout is far off)
  const anonFrames: Record<string, unknown>[] = [];
  anon.addEventListener("message", (ev) => anonFrames.push(JSON.parse(ev.data as string)));
  await new Promise<void>((r) => anon.addEventListener("open", () => r(), { once: true }));
  const authed = new WebSocket(rig.url, [`t3.${token}`]);
  const frames: Record<string, unknown>[] = [];
  authed.addEventListener("message", (ev) => frames.push(JSON.parse(ev.data as string)));
  await new Promise<void>((r) => authed.addEventListener("open", () => r(), { once: true }));
  await wait(50);

  const sent = rig.channel.broadcast("runs.created", { run: { id: "run-1" } });
  assert.equal(sent, 1, "only the authenticated connection counts");
  await wait(50);
  const hit = frames.find((f) => f["method"] === "runs.created") as { params: { run: { id: string } } } | undefined;
  assert.ok(hit !== undefined, "authenticated connection received the broadcast");
  assert.equal(hit.params.run.id, "run-1");
  assert.equal(
    anonFrames.find((f) => f["method"] === "runs.created"),
    undefined,
    "unauthenticated sockets never see broadcasts",
  );
  authed.close();
  anon.close();
  await rig.close();
});

test("channel: broadcast with requiredScope skips connections whose token lacks it", async () => {
  const rig = await makeRig();
  const { token: runsToken } = rig.tokens.mint({ scopes: ["runs:read"] });
  const { token: loopsOnly } = rig.tokens.mint({ scopes: ["loops:read"] });
  const withRuns = new WebSocket(rig.url, [`t3.${runsToken}`]);
  const runsFrames: Record<string, unknown>[] = [];
  withRuns.addEventListener("message", (ev) => runsFrames.push(JSON.parse(ev.data as string)));
  await new Promise<void>((r) => withRuns.addEventListener("open", () => r(), { once: true }));
  const noRuns = new WebSocket(rig.url, [`t3.${loopsOnly}`]);
  const loopsFrames: Record<string, unknown>[] = [];
  noRuns.addEventListener("message", (ev) => loopsFrames.push(JSON.parse(ev.data as string)));
  await new Promise<void>((r) => noRuns.addEventListener("open", () => r(), { once: true }));
  await wait(50);

  const sent = rig.channel.broadcast("runs.created", { run: { id: "run-1" } }, "runs:read");
  assert.equal(sent, 1, "only the runs:read connection counts");
  await wait(50);
  assert.ok(runsFrames.some((f) => f["method"] === "runs.created"), "runs:read token receives");
  assert.equal(
    loopsFrames.find((f) => f["method"] === "runs.created"),
    undefined,
    "a loops:read-only token must not receive run data",
  );
  // Ungated broadcast still reaches every authenticated connection.
  const all = rig.channel.broadcast("loops.changed", { id: "loop-1" });
  assert.equal(all, 2);
  await wait(50);
  assert.ok(runsFrames.some((f) => f["method"] === "loops.changed"));
  assert.ok(loopsFrames.some((f) => f["method"] === "loops.changed"));
  withRuns.close();
  noRuns.close();
  await rig.close();
});
