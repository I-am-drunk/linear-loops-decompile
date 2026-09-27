/**
 * T-1104 — the browser's T3 connect channel client.
 *
 * Protocol twin of src/connect/client.ts (the Node reference): same wire
 * shapes, same auth, same resume semantics, because the server side is
 * exactly the merged ChannelServer (T-902). What the protocol guarantees:
 *
 * - Socket: `GET <server>/connect` upgraded to WebSocket, JSON text frames.
 * - Auth rides the `t3.<token>` subprotocol (the server echoes it on accept;
 *   a bad token fails the handshake — the WS API hides the HTTP status, so a
 *   failed connect surfaces as `closed` before `open`).
 * - Requests correlate by incrementing `id` and time out client-side.
 * - Run events arrive as `runs.event` notifications `{runId, seq, event}`;
 *   `seq` is per-run monotonic. After a reconnect every subscription is
 *   re-issued with `sinceSeq` = last seen seq, so gaps replay from the
 *   server's retained window; a `truncated` subscribe result means the gap
 *   outlived retention and the caller must resync with `runs.get`.
 * - Reconnect: exponential backoff (min → max, doubling, deterministic — no
 *   jitter, matching the reference client). close() is intentional and
 *   stops reconnecting.
 *
 * Browser vs the Node twin: global WebSocket only, no Node APIs; timers are
 * plain browser timers. Original code.
 */

export interface LiveClientOptions {
  /** ws(s)://host[:port]/connect */
  url: string;
  token: string;
  reconnect?: boolean;
  minDelayMs?: number;
  maxDelayMs?: number;
  requestTimeoutMs?: number;
}

export interface SubscribeResult {
  ok: true;
  runId: string;
  /** Presence-lite: the server's active run ids at subscribe time. */
  active: string[];
  replayed: number;
  /** True when the retained window could not cover the gap → resync via runs.get. */
  truncated: boolean;
}

export type LiveConnState = "connecting" | "open" | "closed";

/** The run event payload shape is the runtime's (opaque to transport). */
export type LiveRunEvent = Record<string, unknown> & { type: string };

type RunEventHandler = (event: LiveRunEvent, seq: number) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface SubState {
  lastSeq: number;
  onEvent: RunEventHandler | undefined;
}

export class LiveChannelClient {
  readonly #url: string;
  readonly #token: string;
  readonly #reconnect: boolean;
  readonly #minDelayMs: number;
  readonly #maxDelayMs: number;
  readonly #requestTimeoutMs: number;

  #ws: WebSocket | null = null;
  #nextId = 1;
  #delayMs: number;
  #intentionalClose = false;
  readonly #pending = new Map<number, PendingRequest>();
  readonly #subs = new Map<string, SubState>();

  /** Fires for every accepted runs.event notification (after seq dedupe). */
  onEvent: ((runId: string, seq: number, event: LiveRunEvent) => void) | undefined;
  /** connecting → open → closed transitions. */
  onStateChange: ((state: LiveConnState) => void) | undefined;

  constructor(options: LiveClientOptions) {
    this.#url = options.url;
    this.#token = options.token;
    this.#reconnect = options.reconnect ?? true;
    this.#minDelayMs = options.minDelayMs ?? 100;
    this.#maxDelayMs = options.maxDelayMs ?? 5_000;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    this.#delayMs = this.#minDelayMs;
  }

  /** Open the socket. Resolves on open; retries forever unless close()d. */
  connect(): Promise<void> {
    this.#intentionalClose = false;
    return this.#open();
  }

  get isOpen(): boolean {
    return this.#ws !== null && this.#ws.readyState === WebSocket.OPEN;
  }

  /** Typed request/response against the channel's RPC surface. */
  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    const ws = this.#ws;
    if (ws === null || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("not connected"));
    }
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error("request_timeout"));
      }, this.#requestTimeoutMs);
      this.#pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) }));
    });
  }

  /** Subscribe to one run's event stream; resumes from the last seen seq. */
  async subscribeRuns(runId: string, onEvent?: RunEventHandler): Promise<SubscribeResult> {
    const existing = this.#subs.get(runId);
    const sub: SubState = existing ?? { lastSeq: 0, onEvent: undefined };
    sub.onEvent = onEvent ?? sub.onEvent;
    this.#subs.set(runId, sub);
    return (await this.request("runs.subscribe", {
      id: runId,
      ...(sub.lastSeq > 0 ? { sinceSeq: sub.lastSeq } : {}),
    })) as SubscribeResult;
  }

  /** Client-side drop (the v1 protocol has no runs.unsubscribe). */
  unsubscribe(runId: string): void {
    this.#subs.delete(runId);
  }

  /** Intentional close: no reconnect. */
  close(): Promise<void> {
    this.#intentionalClose = true;
    return new Promise((resolve) => {
      const ws = this.#ws;
      if (ws === null || ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      ws.addEventListener("close", () => resolve(), { once: true });
      ws.close(1000, "client closing");
    });
  }

  #open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.onStateChange?.("connecting");
      const ws = new WebSocket(this.#url, [`t3.${this.#token}`]);
      this.#ws = ws;
      let settled = false;

      ws.addEventListener("open", () => {
        settled = true;
        this.#delayMs = this.#minDelayMs;
        this.onStateChange?.("open");
        // Resume subscriptions (gap replay) after every reconnect.
        for (const [runId, sub] of this.#subs) {
          void this.request("runs.subscribe", {
            id: runId,
            ...(sub.lastSeq > 0 ? { sinceSeq: sub.lastSeq } : {}),
          }).catch(() => {
            /* a failed resubscribe surfaces on the next event/timeout */
          });
        }
        resolve();
      });

      ws.addEventListener("message", (ev: MessageEvent) => {
        if (typeof ev.data !== "string") return;
        this.#handleFrame(ev.data);
      });

      ws.addEventListener("close", () => {
        this.#ws = null;
        this.#failAllPending(new Error("connection closed"));
        this.onStateChange?.("closed");
        if (!settled && !this.#reconnect) {
          // e.g. handshake refused (bad token) — no retry wanted
          reject(new Error("connection refused"));
          return;
        }
        if (!this.#intentionalClose && this.#reconnect) {
          const delay = this.#delayMs;
          this.#delayMs = Math.min(this.#delayMs * 2, this.#maxDelayMs);
          setTimeout(() => {
            void this.#open().catch(() => {});
          }, delay);
        }
      });

      ws.addEventListener("error", () => {
        // close follows; the close handler owns reconnect logic
      });
    });
  }

  #handleFrame(text: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (typeof msg !== "object" || msg === null) return;
    const m = msg as Record<string, unknown>;

    if ("id" in m && (typeof m["id"] === "number" || typeof m["id"] === "string")) {
      const id = m["id"] as number;
      const pending = this.#pending.get(id);
      if (!pending) return;
      this.#pending.delete(id);
      clearTimeout(pending.timer);
      const err = m["error"] as { code?: string; message?: string } | undefined;
      if (err !== undefined) {
        const e = new Error(err.message ?? "rpc error");
        (e as Error & { code?: string }).code = err.code ?? "rpc_error";
        pending.reject(e);
      } else {
        pending.resolve(m["result"]);
      }
      return;
    }

    if (m["method"] === "runs.event") {
      const params = m["params"] as { runId?: string; seq?: number; event?: LiveRunEvent } | undefined;
      if (!params || typeof params.runId !== "string" || typeof params.seq !== "number" || !params.event) return;
      const sub = this.#subs.get(params.runId);
      if (sub && params.seq <= sub.lastSeq) return; // replay/overlap dedupe
      if (sub) sub.lastSeq = params.seq;
      sub?.onEvent?.(params.event, params.seq);
      this.onEvent?.(params.runId, params.seq, params.event);
    }
  }

  #failAllPending(err: Error): void {
    for (const [, pending] of this.#pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.#pending.clear();
  }
}
