/**
 * The connect channel (T-902) — the UI ↔ server link.
 *
 * Wire protocol (SPECS/t3-connect.md §4 + RPC surface v1):
 * - WebSocket at `<server>/connect`, JSON-RPC-ish frames (see rpc.ts).
 * - Auth: bearer token either as the `t3.<token>` subprotocol value (echoed
 *   per RFC 6455) or as a first-frame `auth` request. Unauthenticated
 *   sockets get `authTimeoutMs` to authenticate, then a 4401 close.
 * - `runs.subscribe(id, sinceSeq?)` opts into a run's event stream. Events
 *   are notifications `{method: "runs.event", params: {runId, seq, event}}`
 *   with a per-run monotonic seq. The server retains the last N events per
 *   run; sinceSeq replays the retained gap. When the retained window cannot
 *   cover the gap, the subscribe result's `truncated: true` tells the client
 *   to resync via `runs.get` (the channel never invents events — run event
 *   SHAPES belong to R5's runtime).
 * - Presence-lite: every subscribe result carries `active: string[]` (the
 *   registry's active run ids).
 * - Scope gates: every method maps to the closed scope set (METHOD_SCOPES);
 *   the caller's token must hold it. Revoked/expired tokens fail the NEXT
 *   call — revocation takes effect without a reconnect.
 *
 * Domain methods are injected: loops.* / settings.* / dataplane.probe are
 * registered by the composition root (T-1101) with handlers backed by R3/R6;
 * runs.steer/cancel/continue delegate to the injected RuntimeCommands seam
 * (R5's runner). This package owns transport + auth + subscription plumbing
 * only.
 *
 * Original code.
 */

import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { TokenStore } from "./tokens.ts";
import type { Scope, TokenRecord } from "./tokens.ts";
import { CLOSE_CODES, WsConnection, checkUpgrade } from "./ws.ts";
import { RPC_ERRORS, RpcEngine, RpcError, notification } from "./rpc.ts";
import type { EnvironmentDescriptor } from "./descriptor.ts";

/** Method → required scope. The complete v1 gate table (spec §RPC surface). */
export const METHOD_SCOPES: Record<string, Scope> = {
  "env.describe": "env:read",
  "loops.list": "loops:read",
  "loops.get": "loops:read",
  "loops.upsert": "loops:write",
  "loops.publish": "loops:write",
  "loops.setEnabled": "loops:write",
  "runs.list": "runs:read",
  "runs.get": "runs:read",
  "runs.subscribe": "runs:read",
  "runs.steer": "runs:write",
  "runs.cancel": "runs:write",
  "runs.continue": "runs:write",
  "settings.get": "settings:read",
  "settings.setLinear": "settings:write",
  "settings.setInference": "settings:write",
  "settings.testInference": "settings:read",
  "dataplane.probe": "env:read",
};

/** Read-only view of run liveness, owned by the runtime/server layer. */
export interface RunRegistry {
  has(runId: string): boolean;
  activeRunIds(): string[];
}

/** R5's runner, injected. The channel validates + delegates; it never executes. */
export interface RuntimeCommands {
  steer(runId: string, text: string): unknown | Promise<unknown>;
  cancel(runId: string): unknown | Promise<unknown>;
  continue(runId: string, text: string): unknown | Promise<unknown>;
}

/** What a run event looks like to the channel: opaque. R5 owns the shape. */
export type RunEventPayload = Record<string, unknown> & { type: string };

export interface ChannelContext {
  /** The authenticated token for this connection. */
  record: TokenRecord;
  /** This connection (send notifications with connection.sendJson). */
  connection: WsConnection;
  /** Run ids this connection is subscribed to. */
  subscribedRunIds: ReadonlySet<string>;
}

type Handler = (params: unknown, ctx: ChannelContext) => unknown | Promise<unknown>;

export interface ChannelOptions {
  tokens: TokenStore;
  registry: RunRegistry;
  runtime?: RuntimeCommands | undefined;
  /** Enables the built-in env.describe method when present. */
  descriptor?: EnvironmentDescriptor | undefined;
  /** Ms an unauthenticated socket may live before a 4401 close. Default 5000. */
  authTimeoutMs?: number;
  /** Events retained per run for sinceSeq replay. Default 500. */
  ringBufferSize?: number;
  maxMessageBytes?: number;
  /** WS upgrade path. Default "/connect". */
  path?: string;
}

interface ConnState {
  conn: WsConnection;
  record: TokenRecord | null;
  subs: Set<string>;
  authTimer: NodeJS.Timeout | null;
}

interface RunBuffer {
  seq: number;
  events: { seq: number; event: RunEventPayload }[];
}

const AUTH_SUBPROTOCOL_PREFIX = "t3.";

export class ChannelServer {
  readonly #tokens: TokenStore;
  readonly #registry: RunRegistry;
  readonly #runtime: RuntimeCommands | undefined;
  readonly #authTimeoutMs: number;
  readonly #ringBufferSize: number;
  readonly #maxMessageBytes: number | undefined;
  readonly #path: string;
  readonly #engine = new RpcEngine<ChannelContext>();
  readonly #conns = new Set<ConnState>();
  readonly #buffers = new Map<string, RunBuffer>();

  constructor(options: ChannelOptions) {
    this.#tokens = options.tokens;
    this.#registry = options.registry;
    this.#runtime = options.runtime;
    this.#authTimeoutMs = options.authTimeoutMs ?? 5_000;
    this.#ringBufferSize = options.ringBufferSize ?? 500;
    this.#maxMessageBytes = options.maxMessageBytes;
    this.#path = options.path ?? "/connect";

    if (options.descriptor !== undefined) {
      const descriptor = options.descriptor;
      this.register("env.describe", () => descriptor);
    }
    this.register("runs.subscribe", (params, ctx) => this.#subscribe(params, ctx));
    this.register("runs.steer", (params) => this.#delegate("steer", params));
    this.register("runs.cancel", (params) => this.#delegate("cancel", params));
    this.register("runs.continue", (params) => this.#delegate("continue", params));
  }

  /**
   * Register an app method (loops.*, settings.*, dataplane.probe, …).
   * The scope gate comes from METHOD_SCOPES unless overridden.
   */
  register(method: string, handler: Handler, scopeOverride?: Scope): void {
    const scope = scopeOverride ?? METHOD_SCOPES[method];
    this.#engine.register(method, async (params, ctx) => {
      const invalid = this.#tokens.checkValidity(ctx.record);
      if (invalid === "token_expired") throw new RpcError(RPC_ERRORS.TOKEN_EXPIRED, "token expired");
      if (invalid !== null) throw new RpcError(RPC_ERRORS.TOKEN_REVOKED, "token revoked");
      if (scope !== undefined && !ctx.record.scopes.includes(scope)) {
        throw new RpcError(RPC_ERRORS.INSUFFICIENT_SCOPE, `${method} requires ${scope}`);
      }
      return handler(params, ctx);
    });
  }

  /** Attach to a node:http server's upgrade event. Other paths are refused. */
  attach(server: Server): void {
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const path = (req.url ?? "/").split("?")[0] ?? "/";
      if (path !== this.#path) {
        socket.destroy();
        return;
      }

      // Subprotocol auth: `t3.<token>` — decide BEFORE the 101 so a bad token
      // gets a plain HTTP 401 (post-upgrade close codes can't carry detail).
      const check = checkUpgrade(req);
      let authed: TokenRecord | null = null;
      let tokenProtocol: string | null = null;
      if (check.ok) {
        tokenProtocol = check.protocols.find((p) => p.startsWith(AUTH_SUBPROTOCOL_PREFIX)) ?? null;
        if (tokenProtocol !== null) {
          const plaintext = tokenProtocol.slice(AUTH_SUBPROTOCOL_PREFIX.length);
          const record = this.#tokens.lookup(plaintext);
          const invalid = record ? this.#tokens.checkValidity(record) : "unknown_token";
          if (record === undefined || invalid !== null) {
            socket.write(
              "HTTP/1.1 401 Unauthorized\r\nconnection: close\r\ncontent-type: application/json\r\n\r\n" +
                JSON.stringify({ error: invalid ?? "unknown_token" }),
            );
            socket.destroy();
            return;
          }
          authed = record;
        }
      }

      const stateRef: { current: ConnState | undefined } = { current: undefined };
      const earlyMessages: string[] = [];
      const conn = WsConnection.accept(req, socket, head, {
        ...(this.#maxMessageBytes !== undefined ? { maxMessageBytes: this.#maxMessageBytes } : {}),
        selectProtocol: () => tokenProtocol,
        onMessage: (text) => {
          const state = stateRef.current;
          if (state) void this.#handleMessage(state, text);
          else earlyMessages.push(text);
        },
        onClose: () => {
          const state = stateRef.current;
          if (state) this.#dropConn(state);
        },
      });
      if (conn === null) return;

      const state: ConnState = { conn, record: authed, subs: new Set(), authTimer: null };
      if (authed === null) {
        state.authTimer = setTimeout(() => {
          conn.close(CLOSE_CODES.UNAUTHORIZED, "authentication timeout");
        }, this.#authTimeoutMs);
        state.authTimer.unref();
      }
      stateRef.current = state;
      this.#conns.add(state);
      for (const text of earlyMessages) void this.#handleMessage(state, text);
    });
  }

  /**
   * Publish one run event: assigns the per-run seq, retains it in the ring
   * buffer (for sinceSeq replay), and fans out to subscribers. Returns seq.
   * Buffering happens with or without subscribers — replay must survive a
   * client that was disconnected when the event fired.
   */
  publishRunEvent(runId: string, event: RunEventPayload): number {
    let buf = this.#buffers.get(runId);
    if (buf === undefined) {
      buf = { seq: 0, events: [] };
      this.#buffers.set(runId, buf);
    }
    buf.seq += 1;
    const seq = buf.seq;
    buf.events.push({ seq, event });
    if (buf.events.length > this.#ringBufferSize) buf.events.shift();

    const frame = JSON.stringify(notification("runs.event", { runId, seq, event }));
    for (const state of this.#conns) {
      if (state.record !== null && state.subs.has(runId)) state.conn.sendText(frame);
    }
    return seq;
  }

  /** Drop a run's retained events (e.g. long after completion). */
  pruneRun(runId: string): void {
    this.#buffers.delete(runId);
  }

  /**
   * Highest seq assigned for a run (0 when nothing was published). Pairs with
   * runs.get's `lastSeq` (T-1103): a client that loads a run's history and
   * then subscribes with `sinceSeq: lastSeq` loses nothing fired between the
   * two calls.
   */
  lastSeqFor(runId: string): number {
    return this.#buffers.get(runId)?.seq ?? 0;
  }

  /**
   * Broadcast a notification to every AUTHENTICATED connection (runs.created
   * from T-1103's run-event publisher is the first consumer — list pages
   * refresh on it instead of polling). `requiredScope` gates the fan-out the
   * way METHOD_SCOPES gates requests: a connection whose token lacks it is
   * skipped (a settings-only token must not receive run data). Returns the
   * recipient count.
   */
  broadcast(method: string, params: unknown, requiredScope?: Scope): number {
    const frame = JSON.stringify(notification(method, params));
    let sent = 0;
    for (const state of this.#conns) {
      if (state.record === null) continue;
      if (requiredScope !== undefined && !state.record.scopes.includes(requiredScope)) continue;
      state.conn.sendText(frame);
      sent += 1;
    }
    return sent;
  }

  connectionCount(): number {
    return this.#conns.size;
  }

  closeAll(code: number = CLOSE_CODES.GOING_AWAY): void {
    for (const state of this.#conns) {
      if (state.authTimer !== null) clearTimeout(state.authTimer);
      state.conn.close(code, "server closing");
    }
  }

  async #handleMessage(state: ConnState, text: string): Promise<void> {
    if (state.record === null) {
      this.#handleAuthFrame(state, text);
      return;
    }
    const ctx: ChannelContext = {
      record: state.record,
      connection: state.conn,
      subscribedRunIds: state.subs,
    };
    const response = await this.#engine.dispatch(text, ctx);
    if (response !== null) state.conn.sendText(response);
  }

  /** First-frame auth: {"jsonrpc":"2.0","id":N,"method":"auth","params":{"token"}} */
  #handleAuthFrame(state: ConnState, text: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      state.conn.sendJson({ jsonrpc: "2.0", id: null, error: { code: RPC_ERRORS.PARSE_ERROR, message: "invalid JSON" } });
      return;
    }
    const msg = parsed as Record<string, unknown> | null;
    const id = msg !== null && (typeof msg["id"] === "string" || typeof msg["id"] === "number") ? msg["id"] : null;
    const isAuth =
      msg !== null && msg["method"] === "auth" && typeof (msg["params"] as Record<string, unknown>)?.["token"] === "string";
    if (!isAuth) {
      if (id !== null) {
        state.conn.sendJson({ jsonrpc: "2.0", id, error: { code: RPC_ERRORS.UNAUTHORIZED, message: "authenticate first" } });
      }
      return; // the auth timer is still running
    }
    const token = (msg!["params"] as Record<string, unknown>)["token"] as string;
    const record = this.#tokens.lookup(token);
    const invalid = record ? this.#tokens.checkValidity(record) : "unknown_token";
    if (record === undefined || invalid !== null) {
      if (id !== null) {
        state.conn.sendJson({ jsonrpc: "2.0", id, error: { code: RPC_ERRORS.UNAUTHORIZED, message: invalid ?? "unknown_token" } });
      }
      state.conn.close(CLOSE_CODES.UNAUTHORIZED, invalid ?? "unknown_token");
      return;
    }
    state.record = record;
    if (state.authTimer !== null) {
      clearTimeout(state.authTimer);
      state.authTimer = null;
    }
    if (id !== null) {
      state.conn.sendJson({ jsonrpc: "2.0", id, result: { ok: true, scopes: record.scopes } });
    }
  }

  #dropConn(state: ConnState): void {
    if (state.authTimer !== null) clearTimeout(state.authTimer);
    this.#conns.delete(state);
  }

  #subscribe(params: unknown, ctx: ChannelContext): unknown {
    const p = (params ?? {}) as Record<string, unknown>;
    const runId = p["id"];
    if (typeof runId !== "string" || runId.length === 0) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "runs.subscribe needs { id }");
    }
    const sinceSeq = p["sinceSeq"];
    if (
      sinceSeq !== undefined &&
      (typeof sinceSeq !== "number" || !Number.isInteger(sinceSeq) || sinceSeq < 0)
    ) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "sinceSeq must be a non-negative integer");
    }
    if (!this.#registry.has(runId)) {
      throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown run: ${runId}`);
    }

    const state = this.#stateFor(ctx.connection);
    let replayed = 0;
    let truncated = false;
    const buf = this.#buffers.get(runId);
    if (sinceSeq !== undefined && buf !== undefined) {
      const retained = buf.events.filter((e) => e.seq > sinceSeq);
      // Gap the buffer can't cover: events between sinceSeq and the oldest
      // retained seq were evicted — the client must resync via runs.get.
      const oldest = buf.events[0];
      truncated = oldest !== undefined && oldest.seq > sinceSeq + 1;
      for (const e of retained) {
        ctx.connection.sendJson(notification("runs.event", { runId, seq: e.seq, event: e.event }));
        replayed += 1;
      }
    }
    // Subscribe AFTER replay so live fan-out can't interleave with it.
    state?.subs.add(runId);
    return { ok: true, runId, active: this.#registry.activeRunIds(), replayed, truncated };
  }

  async #delegate(kind: "steer" | "cancel" | "continue", params: unknown): Promise<unknown> {
    const p = (params ?? {}) as Record<string, unknown>;
    const runId = p["id"];
    if (typeof runId !== "string" || runId.length === 0) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, `runs.${kind} needs { id }`);
    }
    if (!this.#registry.has(runId)) {
      throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown run: ${runId}`);
    }
    if (this.#runtime === undefined) {
      throw new RpcError(RPC_ERRORS.UNAVAILABLE, "runtime not wired");
    }
    if (kind === "cancel") return this.#runtime.cancel(runId);
    const text = p["text"];
    if (typeof text !== "string" || text.length === 0) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, `runs.${kind} needs { text }`);
    }
    return kind === "steer" ? this.#runtime.steer(runId, text) : this.#runtime.continue(runId, text);
  }

  #stateFor(conn: WsConnection): ConnState | undefined {
    for (const state of this.#conns) if (state.conn === conn) return state;
    return undefined;
  }
}

