/**
 * JSON-RPC-ish message engine (T-902).
 *
 * "Ish" per SPECS/t3-connect.md §4: requests/notifications/responses follow
 * JSON-RPC 2.0 shapes, but error codes are stable STRINGS (e.g.
 * "insufficient_scope") instead of numeric codes — the UI matches on strings,
 * and the spec freezes the vocabulary. Batches are deliberately unsupported
 * (YAGNI; the UI never sends them).
 *
 * The engine is transport-agnostic: dispatch(rawText, ctx) in, serialized
 * response (or null for notifications) out. channel.ts wires it to sockets;
 * tests can drive it in-process.
 *
 * Original code.
 */

/** Stable wire codes. Domain codes beyond this list are added by SPECS, not ad hoc. */
export const RPC_ERRORS = {
  PARSE_ERROR: "parse_error",
  INVALID_REQUEST: "invalid_request",
  METHOD_NOT_FOUND: "method_not_found",
  INVALID_PARAMS: "invalid_params",
  INTERNAL_ERROR: "internal_error",
  UNAUTHORIZED: "unauthorized",
  TOKEN_EXPIRED: "token_expired",
  TOKEN_REVOKED: "token_revoked",
  INSUFFICIENT_SCOPE: "insufficient_scope",
  NOT_FOUND: "not_found",
  LOOP_DISABLED: "loop_disabled",
  RATE_LIMITED: "rate_limited",
  REPLAY_GAP: "replay_gap",
  UNAVAILABLE: "unavailable",
} as const;

export class RpcError extends Error {
  readonly code: string;
  readonly data: unknown;
  constructor(code: string, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

export interface RpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface RpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export type RpcInbound = RpcRequest | RpcNotification;

export type RpcHandler<Ctx> = (params: unknown, ctx: Ctx) => unknown | Promise<unknown>;

export function isRequest(msg: RpcInbound): msg is RpcRequest {
  return "id" in msg;
}

export function notification(method: string, params: unknown): RpcNotification {
  return { jsonrpc: "2.0", method, ...(params !== undefined ? { params } : {}) };
}

export class RpcEngine<Ctx> {
  readonly #handlers = new Map<string, RpcHandler<Ctx>>();

  register(method: string, handler: RpcHandler<Ctx>): void {
    if (this.#handlers.has(method)) throw new Error(`duplicate method: ${method}`);
    this.#handlers.set(method, handler);
  }

  has(method: string): boolean {
    return this.#handlers.has(method);
  }

  /**
   * Dispatch one raw text frame. Returns the serialized response, or null for
   * notifications (their handler still runs; handler errors are swallowed by
   * design — a notification has nowhere to report to).
   */
  async dispatch(raw: string, ctx: Ctx): Promise<string | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return serializeError(null, RPC_ERRORS.PARSE_ERROR, "invalid JSON");
    }
    const msg = parseInbound(parsed);
    if (!msg) return serializeError(null, RPC_ERRORS.INVALID_REQUEST, "not a JSON-RPC message");

    if (!isRequest(msg)) {
      // Notification: fire and forget.
      const handler = this.#handlers.get(msg.method);
      if (handler) {
        try {
          await handler(msg.params, ctx);
        } catch {
          // nowhere to report; the channel logs at its layer
        }
      }
      return null;
    }

    const handler = this.#handlers.get(msg.method);
    if (!handler) {
      return serializeError(msg.id, RPC_ERRORS.METHOD_NOT_FOUND, `unknown method: ${msg.method}`);
    }
    try {
      const result = await handler(msg.params, ctx);
      return JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: result ?? null });
    } catch (err) {
      if (err instanceof RpcError) {
        return serializeError(msg.id, err.code, err.message, err.data);
      }
      return serializeError(msg.id, RPC_ERRORS.INTERNAL_ERROR, "internal error");
    }
  }
}

function parseInbound(value: unknown): RpcInbound | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v["jsonrpc"] !== "2.0") return null;
  if (typeof v["method"] !== "string" || v["method"].length === 0) return null;
  const hasId = "id" in v;
  if (hasId) {
    const id = v["id"];
    if (typeof id !== "string" && typeof id !== "number") return null;
    const msg: RpcRequest = { jsonrpc: "2.0", id, method: v["method"] };
    if ("params" in v) msg.params = v["params"];
    return msg;
  }
  const msg: RpcNotification = { jsonrpc: "2.0", method: v["method"] };
  if ("params" in v) msg.params = v["params"];
  return msg;
}

function serializeError(id: string | number | null, code: string, message: string, data?: unknown): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  });
}

