import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { attachWs, type Conn } from "./server.ts";
import { RpcClient } from "./client.ts";
import { encodeText, FrameDecoder } from "./frames.ts";
import { event } from "./jsonrpc.ts";

async function boot() {
  const http = createServer();
  const conns: Conn[] = [];
  attachWs(http, {
    authorize: (token) => (token === "dev-token" ? { token } : null),
    registry: {
      ping: () => "pong",
      add: (p) => {
        const { a, b } = p as { a: number; b: number };
        return a + b;
      },
      subscribe: (_p, _ctx) => {
        const conn = conns.at(-1)!;
        setTimeout(() => conn.send(event("runs.event", { seq: 1, kind: "status", status: "active" })), 10);
        return { subscribed: true };
      },
    },
    onConnection: (conn) => conns.push(conn),
  });
  await new Promise<void>((r) => http.listen(0, r));
  const port = (http.address() as AddressInfo).port;
  return { http, url: `ws://127.0.0.1:${port}/ws` };
}

test("round trip: auth, calls, events, errors", async () => {
  const { http, url } = await boot();
  try {
    const client = await RpcClient.connect(url, "dev-token");
    assert.equal(await client.call("ping"), "pong");
    assert.equal(await client.call("add", { a: 2, b: 3 }), 5);

    await assert.rejects(client.call("nope"), (e: Error & { code?: string }) => {
      assert.equal(e.code, "method_not_found");
      return true;
    });

    const got = new Promise((resolve) => client.on("runs.event", resolve));
    assert.deepEqual(await client.call("subscribe"), { subscribed: true });
    assert.deepEqual(await got, { seq: 1, kind: "status", status: "active" });

    client.close();
  } finally {
    http.close();
  }
});

test("bad token is rejected", async () => {
  const { http, url } = await boot();
  try {
    await assert.rejects(RpcClient.connect(url, "wrong", 2000), (e: Error & { code?: string }) => {
      assert.equal(e.code, "unauthorized");
      return true;
    });
  } finally {
    http.close();
  }
});

test("frame codec: masked client frame decodes; text encodes", () => {
  const written: Buffer[] = [];
  const fakeSocket = { write: (b: Buffer) => { written.push(b); return true; } };
  const texts: string[] = [];
  const dec = new FrameDecoder(fakeSocket as never, { onText: (t) => texts.push(t), onClose: () => {} });

  // build a MASKED text frame (what browsers/node clients send)
  const payload = Buffer.from("hello corpus", "utf8");
  const mask = Buffer.from([1, 2, 3, 4]);
  const maskedPayload = payload.map((b, i) => b ^ mask[i % 4]);
  const frame = Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, maskedPayload]);
  // split across two feeds to prove incremental parsing
  dec.feed(frame.subarray(0, 5));
  dec.feed(frame.subarray(5));
  assert.deepEqual(texts, ["hello corpus"]);

  const out = encodeText("ok");
  assert.equal(out[0], 0x81);
  assert.equal(out[1], 2);
  assert.equal(out.subarray(2).toString(), "ok");
});

test("client refuses cleartext remote endpoints before opening a socket", async () => {
  for (const url of ["ws://example.com/ws", "ws://127.0.0.1.example.com/ws", "ws://localhost/ws", "http://example.com/ws"]) {
    await assert.rejects(RpcClient.connect(url, "secret"), /require wss/);
  }
});

function maskedFrame(text: string, opcode = 1, fin = true): Buffer {
  const encoded = encodeText(text);
  encoded[0] = (fin ? 0x80 : 0) | opcode;
  const headerLength = encoded[1] === 126 ? 4 : encoded[1] === 127 ? 10 : 2;
  encoded[1] |= 0x80;
  // An all-zero mask is legal and keeps fixture construction simple.
  return Buffer.concat([encoded.subarray(0, headerLength), Buffer.alloc(4), encoded.subarray(headerLength)]);
}

test("decoder bounds announced lengths and aggregate fragmented messages", () => {
  for (const chunks of [
    [maskedFrame("x".repeat(4097)).subarray(0, 8)],
    [Buffer.from([0x81, 0xff, 0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0])],
    [maskedFrame("x".repeat(3000), 1, false), maskedFrame("y".repeat(2000), 0)],
    [maskedFrame("", 1, false), ...Array.from({ length: 1024 }, () => maskedFrame("", 0, false))],
  ]) {
    let closed = 0;
    const texts: string[] = [];
    const dec = new FrameDecoder({ write: () => true } as never,
      { onText: (t) => texts.push(t), onClose: () => closed++ }, () => 4096);
    for (const chunk of chunks) dec.feed(chunk);
    dec.feed(maskedFrame("must not be delivered"));
    assert.equal(closed, 1);
    assert.deepEqual(texts, []);
  }
});

test("decoder supports byte-wise input, coalesced frames, fragments and control interleaving", () => {
  const texts: string[] = [];
  const dec = new FrameDecoder({ write: () => true } as never,
    { onText: (t) => texts.push(t), onClose: () => assert.fail("unexpected close") });
  const large = "x".repeat(65536);
  for (const byte of maskedFrame(large)) dec.feed(Buffer.from([byte]));
  dec.feed(Buffer.concat([maskedFrame("a", 1, false), maskedFrame("ping", 9), maskedFrame("b", 0), maskedFrame("")]));
  assert.deepEqual(texts, [large, "ab", ""]);
});

test("pre-auth socket limits are stricter than authenticated RPC limits", async () => {
  const { http, url } = await boot();
  try {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve) => { ws.onopen = () => resolve(); });
    const closed = new Promise<void>((resolve) => { ws.onclose = () => resolve(); });
    ws.send("x".repeat(4097));
    await closed;
    const client = await RpcClient.connect(url, "dev-token");
    assert.equal(await client.call("ping", { padding: "x".repeat(8192) }), "pong");
    client.close();
  } finally { http.close(); }
});
