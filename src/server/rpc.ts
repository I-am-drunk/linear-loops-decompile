/**
 * Domain RPCs (T-1103) — the composition-root handlers the connect channel
 * gates but nothing served until now: `loops.list/get/upsert/publish/
 * setEnabled` and `runs.list/get`, registered on the ChannelServer by
 * `createLoopsServer` (the M5 critical path — the T-1104 UI seam consumes
 * exactly these).
 *
 * Wire contract: `src/ui/src/live/contract.ts` (T-1104, PR #94) pinned the
 * result/param shapes; channel.ts's METHOD_SCOPES owns the scope gates.
 * Two protocol extensions the hub (#59) asked the implementor for:
 * - `runs.get` also returns `lastSeq` — the channel's per-run event seq at
 *   answer time. A client subscribes with `sinceSeq: lastSeq` and the ring
 *   buffer replays anything it missed between the get and the subscribe —
 *   the load→subscribe race is closed. (Additive field; older clients
 *   ignore it.)
 * - `runs.created` broadcast (see `channelRunEventSink`) — fired once per
 *   run creation so list views refresh on push instead of the 5s poll.
 *
 * Read path: runs/turns come from the Store (the persistence bridge mirrors
 * every runtime event synchronously, so rows are as fresh as the Runner and
 * survive restarts). Write path: loops go through Store.saveLoop (zod rail)
 * and every mutation re-phases the engine via the injected `reloadLoops` —
 * the T-1102 orchestrator's documented hook.
 *
 * Original code.
 */

import { randomUUID } from "node:crypto";

import { RPC_ERRORS, RpcError } from "../connect/rpc.ts";
import type { Scope } from "../connect/tokens.ts";
import type { LoopConfig } from "../model/loop.ts";
import type { EntityId, RunEvent } from "../runtime/types.ts";
import { StoreValidationError } from "./store.ts";
import type { LoopRow, Store } from "./store.ts";

// ---------------------------------------------------------------------------
// Structural channel seam (tests fake it — no socket needed)
// ---------------------------------------------------------------------------

/** The slice of ChannelServer the domain RPCs use. */
export interface DomainRpcChannel {
  register(method: string, handler: (params: unknown) => unknown, scopeOverride?: Scope): void;
  lastSeqFor(runId: string): number;
}

/** The slice of ChannelServer the run-event sink uses (publish + broadcast). */
export interface RunEventChannel {
  publishRunEvent(runId: string, event: Record<string, unknown> & { type: string }): number;
  broadcast(method: string, params: unknown): number;
}

export interface DomainRpcDeps {
  store: Store;
  /**
   * Re-phase the engine from the stored rows — the orchestrator's
   * `reloadLoops`. Injected (optional) so the RPC layer never imports the
   * engine; when absent the store write still lands and the next boot/tick
   * picks it up.
   */
  reloadLoops?: (() => unknown) | undefined;
  /** Loop id minting (tests pin it). Defaults to crypto.randomUUID. */
  idgen?: (() => string) | undefined;
}

// ---------------------------------------------------------------------------
// Wire shapes (mirror src/ui/src/live/contract.ts — change in lockstep)
// ---------------------------------------------------------------------------

/** A loop as the wire carries it: the LoopRow with configJson parsed. */
export interface WireLoop {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly version: number;
  readonly config: LoopConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function wireLoop(row: LoopRow): WireLoop {
  // Zod-validated at write time (Store.saveLoop) — the parse-cast is honest.
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    version: row.version,
    config: JSON.parse(row.configJson) as LoopConfig,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

/**
 * Register every domain RPC on the channel. Scope gates come from the
 * channel's own METHOD_SCOPES (no overrides here).
 */
export function registerDomainRpcs(channel: DomainRpcChannel, deps: DomainRpcDeps): void {
  const { store } = deps;
  const idgen = deps.idgen ?? (() => randomUUID());
  const reload = (): void => {
    deps.reloadLoops?.();
  };

  channel.register("loops.list", () =>
    guard(() => ({ loops: store.listLoops().map(wireLoop) })),
  );

  channel.register("loops.get", (params) =>
    guard(() => {
      const id = needString(params, "id");
      const row = store.getLoop(id);
      if (row === null) throw notFound(`unknown loop: ${id}`);
      return { loop: wireLoop(row) };
    }),
  );

  channel.register("loops.upsert", (params) =>
    guard(() => {
      const p = asParams(params);
      const id = p["id"] === undefined ? idgen() : needString(params, "id");
      const config = p["config"];
      if (typeof config !== "object" || config === null || Array.isArray(config)) {
        throw invalid("loops.upsert needs { config } (a loop config object)");
      }
      const row = store.saveLoop(id, config);
      reload();
      return { loop: wireLoop(row) };
    }),
  );

  channel.register("loops.publish", (params) =>
    guard(() => {
      const id = needString(params, "id");
      const row = store.getLoop(id);
      if (row === null) throw notFound(`unknown loop: ${id}`);
      // The T-1101 store holds ONE live config per loop (no draft table), so
      // upsert already persisted what publish promotes — publish's distinct
      // act today is re-phasing the scheduler from the stored rows (Linear's
      // own publish re-phases cron jobs the same way). A draft/revision
      // model, when it lands, hangs off this same hook.
      reload();
      return { loop: wireLoop(store.getLoop(id)!) };
    }),
  );

  channel.register("loops.setEnabled", (params) =>
    guard(() => {
      const id = needString(params, "id");
      const enabled = (asParams(params))["enabled"];
      if (typeof enabled !== "boolean") throw invalid("loops.setEnabled needs { enabled: boolean }");
      if (store.getLoop(id) === null) throw notFound(`unknown loop: ${id}`);
      store.setLoopEnabled(id, enabled);
      reload();
      return { loop: wireLoop(store.getLoop(id)!) };
    }),
  );

  channel.register("runs.list", (params) =>
    guard(() => {
      const p = asParams(params);
      const loopId = p["loopId"] === undefined ? undefined : needString(params, "loopId");
      const limitRaw = p["limit"];
      if (
        limitRaw !== undefined &&
        (typeof limitRaw !== "number" || !Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 500)
      ) {
        throw invalid("runs.list limit must be an integer in 1…500");
      }
      const limit = limitRaw ?? 50;
      return { runs: store.listRuns({ ...(loopId !== undefined ? { loopId } : {}), limit }) };
    }),
  );

  channel.register("runs.get", (params) =>
    guard(() => {
      const id = needString(params, "id");
      const run = store.getRun(id);
      if (run === null) throw notFound(`unknown run: ${id}`);
      const turns = store.listTurns(id);
      // lastSeq = the channel's stamped seq NOW; subscribing with
      // sinceSeq=lastSeq replays whatever lands in between (ring buffer).
      return { run, turns, lastSeq: channel.lastSeqFor(id) };
    }),
  );
}

/**
 * The composition root's `publish` seam for the T-1102 orchestrator: stamps
 * + fans out every run event, and on the run's CREATION event (runStatus
 * pending — the first event a run ever emits) broadcasts `runs.created`
 * with the run record so loops/runs list views refresh on push.
 */
export function channelRunEventSink(
  channel: RunEventChannel,
): (runId: EntityId, event: RunEvent) => void {
  return (runId, event) => {
    channel.publishRunEvent(runId, event);
    if (event.type === "runStatus" && event.status === "pending") {
      channel.broadcast("runs.created", { run: event.run });
    }
  };
}

// ---------------------------------------------------------------------------
// Param + error plumbing
// ---------------------------------------------------------------------------

function asParams(params: unknown): Record<string, unknown> {
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    throw invalid("params must be an object");
  }
  return params as Record<string, unknown>;
}

function needString(params: unknown, name: string): string {
  const value = asParams(params)[name];
  if (typeof value !== "string" || value.length === 0) {
    throw invalid(`missing or invalid param: ${name} (non-empty string)`);
  }
  return value;
}

function invalid(message: string): RpcError {
  return new RpcError(RPC_ERRORS.INVALID_PARAMS, message);
}

function notFound(message: string): RpcError {
  return new RpcError(RPC_ERRORS.NOT_FOUND, message);
}

/** Map store rails onto wire codes; RpcErrors pass through untouched. */
function guard<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof RpcError) throw error;
    if (error instanceof StoreValidationError) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, error.message);
    }
    throw error;
  }
}
