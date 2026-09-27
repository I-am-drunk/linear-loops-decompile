/**
 * T-1103 — the composition-root domain RPCs: loops.list/get/upsert/publish/
 * setEnabled + runs.list/get, registered on the T3 connect channel so the
 * UI's live sources (src/ui/src/live — contract.ts pins the wire shapes)
 * talk to the real server. THE M5 critical path: the channel owns transport/
 * auth/subscriptions and expects the composition root to inject these
 * (channel.ts: "Domain methods are injected"); they existed nowhere until
 * this file.
 *
 * Layering (house rule — http.ts): the server never imports the connect
 * package's transport graph; the channel arrives structurally (DomainChannel),
 * exactly like the orchestrator's WriteBackSink seam. The single connect
 * import is rpc.ts — a zero-dependency leaf holding the SPECS-frozen wire
 * error vocabulary; sharing it keeps `not_found`/`invalid_params` honest
 * (the RpcEngine maps a plain throw to a generic internal_error, which would
 * hide a missing run behind "internal error").
 *
 * Scheduler coherence (settled in engine/adapters.ts — "republishing a loop
 * re-phases its schedule" — and Store.saveLoop, which bumps the updatedAt
 * anchor on every write): UPSERTS ARE DRAFTS and never touch the live
 * registry; PUBLISH and SETENABLED hook the orchestrator's reloadLoops()
 * (orchestrator.ts: "the channel's loop RPCs hook this"). The UI's save flow
 * (sources.ts saveLoop) is upsert-then-publish, so every editor save lands
 * exactly one re-phase.
 *
 * runs.get reads the live Runner first (it alone carries pendingElicitation
 * and sub-event freshness), falling back to the store — a run whose Runner
 * state is gone (pre-restart, unrestored) still renders from the durable
 * mirror persistence.ts maintains. The DB record has no pendingElicitation
 * column; that is a documented gap of the fallback path only.
 *
 * Additions beyond the pinned contract (additive — safe under its structural
 * typing; the UI adopts them when R7 picks them up):
 * - runs.get carries `lastSeq`, the channel's own publish counter, so a
 *   client can load history then subscribe with sinceSeq=lastSeq and lose
 *   nothing fired in between (the load→subscribe race; hub #59 protocol ask).
 * - createRunEventPublisher emits a `runs.created` broadcast on each run's
 *   first (pending) status — the list pages' refresh trigger that retires
 *   the UI's 5s poll (same ask).
 *
 * Original code.
 */

import { randomUUID } from "node:crypto";
import { RPC_ERRORS, RpcError } from "../connect/rpc.ts";
import type { LoopConfig } from "../model/loop.ts";
import type { Runner } from "../runtime/runner.ts";
import type { Run, RunEvent } from "../runtime/types.ts";
import { StoreValidationError } from "./store.ts";
import type { LoopRow, Store } from "./store.ts";

/** The wire loop — mirror of the UI contract's WireLoop (pinned agreement;
 *  display joins ownerName/teamName stay absent: the server keeps no
 *  user/team directory of its own, which the contract explicitly allows). */
export interface WireLoop {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly version: number;
  readonly config: LoopConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** LoopRow → WireLoop (configJson parsed). */
export function toWireLoop(row: LoopRow): WireLoop {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    version: row.version,
    // Zod-validated at write time (Store.saveLoop) — the cast is honest.
    config: JSON.parse(row.configJson) as LoopConfig,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The slice of the connect channel the domain RPCs need (structural). */
export interface DomainChannel {
  register(
    method: string,
    handler: (params: unknown, ctx: unknown) => unknown | Promise<unknown>,
  ): void;
  /** The channel's per-run publish seq — feeds runs.get's lastSeq. */
  lastSeqFor?(runId: string): number;
}

/** The orchestrator slice the loop write RPCs hook (structural). */
export interface OrchestratorReload {
  reloadLoops(): unknown;
}

export interface DomainRpcDeps {
  store: Store;
  runner: Runner;
  /** M5 orchestrator — publish/setEnabled hook its reloadLoops(). */
  orchestrator?: OrchestratorReload | undefined;
  /** Loop id minting for upsert-create. Default: crypto.randomUUID. */
  idgen?: (() => string) | undefined;
}

/** The runs.list limit ceiling — the wire never pages (M5), so the cap keeps
 *  the aggregate list honest. */
const MAX_RUNS_LIMIT = 500;

/**
 * Register every domain method on the channel. Scopes are the channel's
 * (METHOD_SCOPES gates before these handlers run); these handlers own params
 * validation, domain errors, and the scheduler reload hooks.
 */
export function registerDomainRpcs(channel: DomainChannel, deps: DomainRpcDeps): void {
  const idgen = deps.idgen ?? (() => randomUUID());
  const { store, runner } = deps;

  channel.register("loops.list", () => ({ loops: store.listLoops().map(toWireLoop) }));

  channel.register("loops.get", (params) => {
    const id = requireId(params, "loops.get");
    const row = store.getLoop(id);
    if (row === null) throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown loop: ${id}`);
    return { loop: toWireLoop(row) };
  });

  channel.register("loops.upsert", (params) => {
    const p = asParams(params, "loops.upsert");
    const idParam = p["id"];
    if (idParam !== undefined && (typeof idParam !== "string" || idParam.length === 0)) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "loops.upsert id must be a non-empty string");
    }
    if (!("config" in p)) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "loops.upsert needs { config }");
    }
    // Draft write only — the schedule registry is publish's business (see
    // the header: upserts never re-phase a live loop).
    const isCreate = idParam === undefined || store.getLoop(idParam) === null;
    try {
      const row = store.saveLoop(idParam ?? idgen(), p["config"]);
      // Creation honors the draft's own enabled flag: saveLoop births every
      // row enabled (the row toggle is the live one — orchestrator.ts), and
      // without this a freshly scaffolded "New loop" (enabled: false) would
      // go live on publish despite the editor never enabling it. On REPLACE
      // the live row toggle wins over the (possibly stale) draft flag.
      if (isCreate) {
        const draftEnabled = (JSON.parse(row.configJson) as LoopConfig).enabled;
        if (row.enabled !== draftEnabled) {
          store.setLoopEnabled(row.id, draftEnabled);
          return { loop: toWireLoop(store.getLoop(row.id)!) };
        }
      }
      return { loop: toWireLoop(row) };
    } catch (error) {
      if (error instanceof StoreValidationError) {
        throw new RpcError(RPC_ERRORS.INVALID_PARAMS, error.message);
      }
      throw error;
    }
  });

  channel.register("loops.publish", (params) => {
    const id = requireId(params, "loops.publish");
    const row = store.getLoop(id);
    if (row === null) throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown loop: ${id}`);
    // The re-phasing action: the row's updatedAt anchor (bumped by the last
    // upsert) becomes the live schedule's anchor here. Never fake success
    // without it — a publish that doesn't reach the registry is a silent
    // schedule divergence (the channel's own "runtime not wired" pattern).
    if (deps.orchestrator === undefined) {
      throw new RpcError(RPC_ERRORS.UNAVAILABLE, "orchestrator not wired");
    }
    deps.orchestrator.reloadLoops();
    return { loop: toWireLoop(row) };
  });

  channel.register("loops.setEnabled", (params) => {
    const p = asParams(params, "loops.setEnabled");
    const id = requireId(params, "loops.setEnabled");
    const enabled = p["enabled"];
    if (typeof enabled !== "boolean") {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "loops.setEnabled needs { enabled: boolean }");
    }
    if (store.getLoop(id) === null) throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown loop: ${id}`);
    if (deps.orchestrator === undefined) {
      throw new RpcError(RPC_ERRORS.UNAVAILABLE, "orchestrator not wired");
    }
    store.setLoopEnabled(id, enabled);
    deps.orchestrator.reloadLoops();
    return { loop: toWireLoop(store.getLoop(id)!) };
  });

  channel.register("runs.list", (params) => {
    const p = asParams(params, "runs.list");
    const loopId = p["loopId"];
    if (loopId !== undefined && (typeof loopId !== "string" || loopId.length === 0)) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "runs.list loopId must be a non-empty string");
    }
    const limit = p["limit"];
    if (
      limit !== undefined &&
      (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > MAX_RUNS_LIMIT)
    ) {
      throw new RpcError(
        RPC_ERRORS.INVALID_PARAMS,
        `runs.list limit must be an integer 1..${MAX_RUNS_LIMIT}`,
      );
    }
    const runs = store.listRuns({
      ...(loopId !== undefined ? { loopId } : {}),
      ...(limit !== undefined ? { limit } : {}),
    });
    return { runs };
  });

  channel.register("runs.get", (params) => {
    const id = requireId(params, "runs.get");
    const lastSeq =
      channel.lastSeqFor !== undefined ? { lastSeq: channel.lastSeqFor(id) } : {};
    // Live first: the Runner's record is the freshest and the only one that
    // carries pendingElicitation (awaitingInput runs render their question).
    try {
      const run = runner.getRun(id);
      return { run, turns: runner.getTurns(id), ...lastSeq };
    } catch {
      // Unknown to the runtime — the durable mirror may still have it.
    }
    const run = store.getRun(id);
    if (run === null) throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown run: ${id}`);
    return { run, turns: store.listTurns(id), ...lastSeq };
  });
}

/** The broadcast-capable channel slice the run-event publisher needs. */
export interface RunEventChannel {
  publishRunEvent(runId: string, event: RunEvent): number;
  /** `requiredScope` gates recipients the way METHOD_SCOPES gates requests. */
  broadcast?(method: string, params: unknown, requiredScope?: string): number;
}

/**
 * The composition root's `publish` for createOrchestrator: every run event
 * fans out to the run's channel subscribers; a run's FIRST (pending) status
 * also broadcasts `runs.created` to every authenticated connection — the
 * signal that retires the runs list's poll.
 */
export function createRunEventPublisher(
  channel: RunEventChannel,
): (runId: string, event: RunEvent) => void {
  return (runId, event) => {
    channel.publishRunEvent(runId, event);
    if (event.type === "runStatus" && event.status === "pending") {
      // Scope-gated like the runs.* reads: a token without runs:read must not
      // receive run records it could not fetch (broadcast parity with
      // METHOD_SCOPES).
      channel.broadcast?.("runs.created", { run: event.run }, "runs:read");
    }
  };
}

// ---- params validation ------------------------------------------------------

function asParams(params: unknown, method: string): Record<string, unknown> {
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    throw new RpcError(RPC_ERRORS.INVALID_PARAMS, `${method} needs a params object`);
  }
  return params as Record<string, unknown>;
}

function requireId(params: unknown, method: string): string {
  const id = asParams(params, method)["id"];
  if (typeof id !== "string" || id.length === 0) {
    throw new RpcError(RPC_ERRORS.INVALID_PARAMS, `${method} needs { id }`);
  }
  return id;
}
