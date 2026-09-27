/**
 * Client side of the channel (browser or Node 22; both have a global
 * WebSocket). One socket per session token; calls resolve by id; events
 * dispatch to listeners by name.
 */

import type { RpcResponse } from "./jsonrpc.ts";

type EventCb = (data: unknown) => void;

export class RpcClient {
  private ws: WebSocket;
  private counter = 0;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private listeners = new Map<string, Set<EventCb>>();

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (ev) => this.dispatch(String(ev.data));
    ws.onclose = () => {
      for (const p of this.pending.values()) p.reject(new Error("socket closed"));
      this.pending.clear();
    };
  }

  static connect(url: string, token: string, timeoutMs = 10_000): Promise<RpcClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const client = new RpcClient(ws);
      const timer = setTimeout(() => { ws.close(); reject(new Error("auth timeout")); }, timeoutMs);
      ws.onopen = () => {
        void client.callRaw("__auth", "auth", { token })
          .then(() => { clearTimeout(timer); resolve(client); })
          .catch((e) => { clearTimeout(timer); ws.close(); reject(e); });
      };
      ws.onerror = () => { clearTimeout(timer); reject(new Error("websocket error")); };
    });
  }

  private callRaw(id: string, method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  call<T = unknown>(method: string, params?: unknown): Promise<T> {
    return this.callRaw(`c${++this.counter}`, method, params) as Promise<T>;
  }

  on(event: string, cb: EventCb): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  close(): void { this.ws.close(); }

  private dispatch(text: string): void {
    let msg: RpcResponse & { event?: string; data?: unknown };
    try { msg = JSON.parse(text); } catch { return; }
    if (typeof msg.event === "string") {
      for (const cb of this.listeners.get(msg.event) ?? []) cb(msg.data);
      return;
    }
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    if (msg.error) {
      const e = new Error(msg.error.message) as Error & { code?: string };
      e.code = msg.error.code;
      p.reject(e);
    } else {
      p.resolve(msg.result);
    }
  }
}
