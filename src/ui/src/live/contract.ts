/**
 * T-1104 — the UI↔server wire contract the live loops/runs sources speak.
 *
 * These are the JSON-RPC result/param shapes the UI consumes over the T3
 * connect channel (src/connect). Method names are the channel's own
 * (METHOD_SCOPES in channel.ts); the server-side handlers are T-1103's
 * (src/server orchestrator). This file is the pinned agreement between the
 * two — change it only in lockstep with the server handlers.
 *
 * Everything here is JSON-safe: dates are ISO strings, no class instances.
 * Pure types + consts so the file is safe under `node --experimental-strip-types`.
 */
import type { LoopConfig } from "../../../model/index.ts";
import type { Run, RunEvent, Turn } from "../../../runtime/types.ts";

/** A loop as the wire carries it: the server's LoopRow with configJson parsed. */
export interface WireLoop {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly version: number;
  readonly config: LoopConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Display joins, pre-resolved server-side when possible (rows never look
   *  up). Absent while the server has no user/team directory of its own. */
  readonly ownerName?: string | undefined;
  readonly teamName?: string | undefined;
}

/** A run as the wire carries it — the runtime's Run record verbatim. */
export type WireRun = Run;

/** A turn as the wire carries it — the runtime's Turn record verbatim. */
export type WireTurn = Turn;

/** A live stream event — the runtime's RunEvent union verbatim. */
export type WireRunEvent = RunEvent;

// ---- RPC method names (channel.ts METHOD_SCOPES) --------------------------

export const RPC = {
  envDescribe: "env.describe",
  loopsList: "loops.list",
  loopsGet: "loops.get",
  loopsUpsert: "loops.upsert",
  loopsPublish: "loops.publish",
  loopsSetEnabled: "loops.setEnabled",
  runsList: "runs.list",
  runsGet: "runs.get",
  runsSubscribe: "runs.subscribe",
  runsSteer: "runs.steer",
  runsCancel: "runs.cancel",
  runsContinue: "runs.continue",
} as const;

// ---- loops.* --------------------------------------------------------------

export interface LoopsListResult {
  readonly loops: readonly WireLoop[];
}

export interface LoopsGetParams {
  readonly id: string;
}

export interface LoopsGetResult {
  readonly loop: WireLoop;
}

/** Create (id absent) or replace (id present) a loop's draft config. */
export interface LoopsUpsertParams {
  readonly id?: string | undefined;
  readonly config: LoopConfig;
}

export interface LoopsUpsertResult {
  readonly loop: WireLoop;
}

export interface LoopsPublishParams {
  readonly id: string;
}

export interface LoopsPublishResult {
  readonly loop: WireLoop;
}

export interface LoopsSetEnabledParams {
  readonly id: string;
  readonly enabled: boolean;
}

export interface LoopsSetEnabledResult {
  readonly loop: WireLoop;
}

// ---- runs.* ---------------------------------------------------------------

export interface RunsListParams {
  /** Restrict to one loop; absent = aggregate across loops. */
  readonly loopId?: string | undefined;
  readonly limit?: number | undefined;
}

export interface RunsListResult {
  readonly runs: readonly WireRun[];
}

export interface RunsGetParams {
  readonly id: string;
}

/** Run + full turn history; the live tail arrives via runs.subscribe. */
export interface RunsGetResult {
  readonly run: WireRun;
  readonly turns: readonly WireTurn[];
}

export interface RunsTextParams {
  readonly id: string;
  readonly text: string;
}

export interface RunsCancelParams {
  readonly id: string;
}
