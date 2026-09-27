/**
 * T-1103 — the composition-root RPC handlers the T-902 channel was designed
 * for (src/connect README §Method ownership: "loops.* / settings.* /
 * dataplane.probe are registered by the composition root"). Until this file
 * the channel's METHOD_SCOPES named methods that existed nowhere.
 *
 * Wire contract (pinned in src/ui/src/live/contract.ts — change in lockstep):
 * - loops.list {} → { loops: WireLoop[] } — every stored loop, WireLoop =
 *   the LoopRow with configJson parsed (rows never look names up; the
 *   optional ownerName/teamName joins stay absent until a directory exists).
 * - loops.get { id } → { loop }
 * - loops.upsert { id?, config } → { loop } — create (server-minted id) or
 *   replace a draft; the Store's zod gate is the only validator.
 * - loops.publish { id } → { loop } — re-publishes the stored config: bumps
 *   version + updatedAt, which is the schedule re-phasing anchor
 *   (orchestrator.definitionFor's publishedAt).
 * - loops.setEnabled { id, enabled } → { loop } — the row toggle (the live
 *   one; the config's own `enabled` is the value at last publish).
 * - runs.list { loopId?, limit? } → { runs } — runtime Run records,
 *   newest-first (default cap 100).
 * - runs.get { id } → { run, turns, lastSeq } — lastSeq is the channel's
 *   event tip for the run: the UI subscribes with sinceSeq=lastSeq, so the
 *   snapshot and the live tail join gaplessly and never double-render.
 *
 * Every loop WRITE hooks orchestrator.reloadLoops() (the merged #81
 * contract: "the channel's loop RPCs hook this") so schedule changes take
 * effect without a restart.
 *
 * Error mapping: StoreValidationError → invalid_params (the zod issues are
 * the message), unknown ids → not_found, no silent catches otherwise — RPC
 * failures must be visible to the caller.
 *
 * Original code.
 */

import { randomUUID } from "node:crypto";
import { RPC_ERRORS, RpcError } from "../connect/rpc.ts";
import type { ChannelServer, RuntimeCommands } from "../connect/channel.ts";
import type { LoopConfig, WorkflowDefinition } from "../model/loop.ts";
import type { Run } from "../runtime/types.ts";
import type { Runner } from "../runtime/runner.ts";
import type { Brain } from "../runtime/brain.ts";
import { definitionFor } from "./orchestrator.ts";
import type { Orchestrator } from "./orchestrator.ts";
import { StoreValidationError } from "./store.ts";
import type { LoopRow, Store } from "./store.ts";

/** WireLoop — the UI's contract shape for one loop (contract.ts). */
export interface WireLoop {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly version: number;
  readonly config: LoopConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function wireLoopOf(row: LoopRow): WireLoop {
  // Zod-validated at write time (Store.saveLoop) — the parse cannot fail on
  // a Store-sourced row; a torn hand-edited DB fails loudly below.
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

export interface LoopsRpcDeps {
  readonly channel: ChannelServer;
  readonly store: Store;
  readonly runner: Runner;
  /** Hooked after every loop write (schedule re-phasing). */
  readonly orchestrator?: Orchestrator | undefined;
  /** Id mint for loops.upsert creates. */
  readonly newId?: (() => string) | undefined;
}

function params(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

function requireId(p: Record<string, unknown>, method: string): string {
  const id = p["id"];
  if (typeof id !== "string" || id.length === 0) {
    throw new RpcError(RPC_ERRORS.INVALID_PARAMS, `${method} needs { id }`);
  }
  return id;
}

function loopOr404(store: Store, id: string): LoopRow {
  const row = store.getLoop(id);
  if (row === null) throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown loop: ${id}`);
  return row;
}

/** Registers loops.* + runs.list/runs.get on the channel. Returns the names. */
export function registerLoopsRpc(deps: LoopsRpcDeps): string[] {
  const { channel, store } = deps;
  const newId = deps.newId ?? (() => randomUUID());
  const reload = (): void => {
    deps.orchestrator?.reloadLoops();
  };

  channel.register("loops.list", () => ({ loops: store.listLoops().map(wireLoopOf) }));

  channel.register("loops.get", (p) => ({ loop: wireLoopOf(loopOr404(store, requireId(params(p), "loops.get"))) }));

  channel.register("loops.upsert", (p) => {
    const prm = params(p);
    const idParam = prm["id"];
    if (idParam !== undefined && (typeof idParam !== "string" || idParam.length === 0)) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "loops.upsert id must be a non-empty string when present");
    }
    const config = prm["config"];
    if (config === undefined || typeof config !== "object" || config === null) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "loops.upsert needs { config }");
    }
    try {
      const row = store.saveLoop(idParam ?? newId(), config);
      reload();
      return { loop: wireLoopOf(row) };
    } catch (error) {
      if (error instanceof StoreValidationError) {
        throw new RpcError(RPC_ERRORS.INVALID_PARAMS, error.message);
      }
      throw error;
    }
  });

  channel.register("loops.publish", (p) => {
    const row = loopOr404(store, requireId(params(p), "loops.publish"));
    // Re-save the stored config: version + updatedAt bump (the re-phasing
    // anchor), no content change.
    const republished = store.saveLoop(row.id, JSON.parse(row.configJson));
    reload();
    return { loop: wireLoopOf(republished) };
  });

  channel.register("loops.setEnabled", (p) => {
    const prm = params(p);
    const id = requireId(prm, "loops.setEnabled");
    const enabled = prm["enabled"];
    if (typeof enabled !== "boolean") {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "loops.setEnabled needs { enabled: boolean }");
    }
    loopOr404(store, id);
    store.setLoopEnabled(id, enabled);
    reload();
    return { loop: wireLoopOf(loopOr404(store, id)) };
  });

  channel.register("runs.list", (p) => {
    const prm = params(p);
    const loopId = prm["loopId"];
    if (loopId !== undefined && (typeof loopId !== "string" || loopId.length === 0)) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "runs.list loopId must be a non-empty string when present");
    }
    const limit = prm["limit"];
    if (limit !== undefined && (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 1000)) {
      throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "runs.list limit must be an integer 1..1000");
    }
    return { runs: store.listRuns({ loopId, limit }) };
  });

  channel.register("runs.get", (p) => {
    const id = requireId(params(p), "runs.get");
    const run = store.getRun(id);
    if (run === null) throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown run: ${id}`);
    return {
      run,
      turns: store.getTurns(id),
      lastSeq: channel.runSeqTip(id),
    };
  });

  return [
    "loops.list",
    "loops.get",
    "loops.upsert",
    "loops.publish",
    "loops.setEnabled",
    "runs.list",
    "runs.get",
  ];
}

/**
 * The channel's RuntimeCommands seam over the real Runner (T-1103). Mapping
 * (settled with the UI's FollowUpBox copy, hub #21 00:14:52Z):
 * - runs.steer on a parked (awaitingInput) run IS the elicitation answer —
 *   the v1 wire has no runs.respond; this is where the answer lands.
 * - runs.continue needs the loop's brain (R6) — resolved per run through
 *   the composition root's brainFor.
 */
export function runtimeCommandsFor(deps: {
  runner: Runner;
  store: Store;
  brainFor: (loop: WorkflowDefinition) => Brain;
}): RuntimeCommands {
  const { runner, store, brainFor } = deps;
  return {
    steer: (runId, text) => {
      const run = runner.getRun(runId);
      if (run.status === "awaitingInput") runner.respond(runId, text);
      else runner.steer(runId, text);
      return { ok: true, runId };
    },
    cancel: (runId) => {
      runner.cancel(runId);
      return { ok: true, runId };
    },
    continue: (runId, text) => {
      const run = runner.getRun(runId);
      const row = store.getLoop(run.loopId);
      const def = row === null ? null : definitionFor(row);
      if (def === null) {
        throw new RpcError(RPC_ERRORS.NOT_FOUND, `run ${runId} references unknown loop: ${run.loopId}`);
      }
      runner.continueRun(runId, text, brainFor(def));
      return { ok: true, runId };
    },
  };
}

/** The channel's RunRegistry over the live Runner (T-1103 accessors). */
export function runnerRegistryView(runner: Runner): { has(runId: string): boolean; activeRunIds(): string[] } {
  return {
    has: (runId) => runner.has(runId),
    activeRunIds: () => runner.activeRunIds(),
  };
}

/** Re-export so compose/tests import one module. */
export type { Run };
