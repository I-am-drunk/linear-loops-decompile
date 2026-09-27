/**
 * Connect channel client (T-902) — Node 22's built-in WebSocket.
 *
 * This is the reference client; the browser UI speaks the same protocol with
 * the same shapes (the browser's native WebSocket is API-identical for what
 * we use: constructor with protocols, onopen/onmessage/onclose/onerror).
 *
 * Behavior:
 * - Auth rides the `t3.<token>` subprotocol (see channel.ts; a bad token is a
 *   failed handshake from the client's point of view — the WS API hides the
 *   HTTP status, so use first-frame auth instead when you need the reason).
 * - request() correlates by id with a timeout.
 * - runs.subscribe via subscribeRuns(): tracks the last seen seq per run and
 *   re-subscribes with sinceSeq after every reconnect, so a flaky link
 *   resumes gaps instead of losing events (the server replays its retained
 *   window and flags `truncated` when the gap is older than retention — the
 *   caller should then runs.get to resync).
 * - Reconnect: exponential backoff (minDelayMs → maxDelayMs, doubling, no
 *   jitter — deterministic for tests; add jitter at the call site if ever
   *   needed). close() is intentional and stops reconnecting.
 *
 * Original code.
 */

export interface ChannelClientOptions {
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
  active: string[];
  replayed: number;
  truncated: boolean;
}

type RunEventHandler = (event: Record<string, unknown> & { type: string }, seq: number) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface SubState {
  lastSeq: number;
  onEvent: RunEventHandler | undefined;
}

export class ChannelClient {
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
  /** Fires for every runs.event notification (after dedupe), subscribed or not. */
  onEvent: ((runId: string, seq: number, event: Record<string, unknown> & { type: string }) => void) | undefined;
  /** connecting → open → closed transitions. */
  onStateChange: ((state: "connecting" | "open" | "closed") => void) | undefined;

  constructor(options: ChannelClientOptions) {
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

  /** True when the socket is open. */
  get isOpen(): boolean {
    return this.#ws !== null && this.#ws.readyState === WebSocket.OPEN;
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const ws = this.#ws;
    if (ws === null || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("not connected"));
    }
    const id = this.#nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error("request_timeout"));
      }, this.#requestTimeoutMs);
      timer.unref?.();
      this.#pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) }));
    });
  }

  /** Subscribe to a run's event stream; resumes from the last seen seq. */
  async subscribeRuns(runId: string, onEvent?: RunEventHandler): Promise<SubscribeResult> {
    const existing = this.#subs.get(runId);
    const sub: SubState = existing ?? { lastSeq: 0, onEvent: undefined };
    sub.onEvent = onEvent ?? sub.onEvent;
    this.#subs.set(runId, sub);
    const result = (await this.request("runs.subscribe", {
      id: runId,
      ...(sub.lastSeq > 0 ? { sinceSeq: sub.lastSeq } : {}),
    })) as SubscribeResult;
    return result;
  }

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
        // Resume subscriptions (gap replay) after a reconnect.
        for (const [runId, sub] of this.#subs) {
          void this.request("runs.subscribe", {
            id: runId,
            ...(sub.lastSeq > 0 ? { sinceSeq: sub.lastSeq } : {}),
          }).catch(() => {
            /* resubscribe failure surfaces on the next event/timeout */
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
          const timer = setTimeout(() => {
            void this.#open().catch(() => {});
          }, delay);
          timer.unref?.();
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
      const params = m["params"] as { runId?: string; seq?: number; event?: Record<string, unknown> & { type: string } } | undefined;
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

