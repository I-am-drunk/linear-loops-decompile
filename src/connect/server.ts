/**
 * Server mount: upgrades ws:// connections at /ws and speaks the RPC envelope.
 * Auth is one in-band request: the first frame must be
 * {"jsonrpc":"2.0","id":"...","method":"auth","params":{"token"}}; everything
 * before it gets `unauthorized`. (SPECS/t3-connect.md §Channel.)
 */

import type { Server, IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { acceptKey, encodeClose, encodeText, FrameDecoder } from "./frames.ts";
import { err, isRequest, ok } from "./jsonrpc.ts";

export interface ConnContext {
  token: string;
}

export type Handler = (params: unknown, ctx: ConnContext) => unknown | Promise<unknown>;
export type Registry = Record<string, Handler>;

export class Conn {
  private socket: Socket;
  constructor(socket: Socket) { this.socket = socket; }
  send(msg: object): void {
    this.socket.write(encodeText(JSON.stringify(msg)));
  }
  close(): void {
    try { this.socket.write(encodeClose()); } finally { this.socket.destroy(); }
  }
}

export interface WsOptions {
  path?: string; // default "/ws"
  authorize: (token: string) => ConnContext | null;
  registry: Registry;
  authTimeoutMs?: number; // default 10_000
  onConnection?: (conn: Conn, ctx: ConnContext) => void;
}

export function attachWs(server: Server, opts: WsOptions): void {
  const path = opts.path ?? "/ws";
  server.on("upgrade", (req: IncomingMessage, socket: Socket) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const key = req.headers["sec-websocket-key"];
    if (url.pathname !== path || typeof key !== "string") {
      socket.destroy();
      return;
    }
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${acceptKey(key)}\r\n\r\n`,
    );
    socket.setNoDelay(true);

    const conn = new Conn(socket);
    let ctx: ConnContext | null = null;
    const authTimer = setTimeout(() => conn.close(), opts.authTimeoutMs ?? 10_000);

    const decoder = new FrameDecoder(socket, {
      onClose: () => { clearTimeout(authTimer); socket.destroy(); },
      onText: (text) => {
        let msg: unknown;
        try { msg = JSON.parse(text); } catch { conn.close(); return; }
        if (!isRequest(msg)) return;

        if (!ctx) {
          if (msg.method === "auth" && typeof (msg.params as { token?: unknown })?.token === "string") {
            const granted = opts.authorize((msg.params as { token: string }).token);
            if (granted) {
              ctx = granted;
              clearTimeout(authTimer);
              conn.send(ok(msg.id, { product: "loops-server", protocol: 1 }));
              opts.onConnection?.(conn, ctx);
              return;
            }
          }
          conn.send(err(msg.id, "unauthorized", "first frame must be auth with a valid token"));
          conn.close();
          return;
        }

        const handler = opts.registry[msg.method];
        if (!handler) {
          conn.send(err(msg.id, "method_not_found", `unknown method: ${msg.method}`));
          return;
        }
        Promise.resolve()
          .then(() => handler(msg.params, ctx as ConnContext))
          .then((result) => conn.send(ok(msg.id, result)))
          .catch((e: unknown) => {
            const code = (e as { code?: import("./jsonrpc.ts").RpcErrorCode })?.code ?? "internal";
            const message = e instanceof Error ? e.message : String(e);
            conn.send(err(msg.id, code, message));
          });
      },
    });

    socket.on("data", (chunk) => decoder.feed(chunk));
    socket.on("error", () => { clearTimeout(authTimer); socket.destroy(); });
    socket.on("close", () => clearTimeout(authTimer));
  });
}
