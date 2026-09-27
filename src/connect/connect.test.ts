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
