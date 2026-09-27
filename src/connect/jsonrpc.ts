/**
 * JSON-RPC 2.0-ish wire types (SPECS/t3-connect.md §RPC surface).
 * Events are notifications carrying a per-run monotonically increasing seq.
 */

export interface RpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: unknown;
}

export interface RpcEvent {
  jsonrpc: "2.0";
  event: string; // e.g. "runs.event"
  data: unknown;
}

export type RpcErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "not_found"
  | "loop_disabled"
  | "invalid_params"
  | "internal";

export interface RpcResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: { code: RpcErrorCode; message: string; data?: unknown };
}

export function ok(id: string, result: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function err(id: string, code: RpcErrorCode, message: string, data?: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

export function event(name: string, data: unknown): RpcEvent {
  return { jsonrpc: "2.0", event: name, data };
}

export function isRequest(msg: unknown): msg is RpcRequest {
  return (
    typeof msg === "object" && msg !== null &&
    (msg as RpcRequest).jsonrpc === "2.0" &&
    typeof (msg as RpcRequest).method === "string" &&
    typeof (msg as RpcRequest).id === "string"
  );
}
