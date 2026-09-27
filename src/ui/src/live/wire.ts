/**
 * T-1104 — the UI ↔ server wire contract over T3 connect (v1).
 *
 * Method names and scopes are fixed by METHOD_SCOPES in
 * src/connect/channel.ts (T-902); run/turn RECORD shapes are the runtime's
 * (src/runtime/types.ts); the loop config shape is the model's zod-validated
 * LoopConfig (src/model/loop-config.ts). This file pins the DTOs the
 * composition-root handlers (server side, T-1103) must return so this UI
 * needs zero further changes when they land — the channel was designed for
 * the composition root to register these methods (src/connect/README §Method
 * ownership).
 *
 * Everything here is JSON-safe. Type-only imports: nothing from the model or
 * runtime reaches the browser bundle.
 */
import type { LoopConfig } from "../../../model/loop.ts";
import type { Run, Turn } from "../../../runtime/types.ts";

/** One loop as served to the UI. */
export interface LoopDto {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** The persisted, zod-validated loop config (display fields live here). */
  readonly config: LoopConfig;
  /**
   * Pre-resolved display names (the row never issues lookups — T-701
   * contract). Absent in v1 → the UI shows its single-user defaults.
   */
  readonly ownerName?: string | undefined;
  readonly teamName?: string | undefined;
}

/** loops.list {} → … */
export interface LoopsListResult {
  readonly loops: readonly LoopDto[];
}

/** loops.get { id } → … */
export interface LoopsGetResult {
  readonly loop: LoopDto;
}

/** loops.setEnabled { id, enabled } → the authoritative loop row. */
export interface LoopsSetEnabledParams {
  readonly id: string;
  readonly enabled: boolean;
}
export interface LoopsSetEnabledResult {
  readonly loop: LoopDto;
}

/** runs.list { loopId?, limit? } → newest-first runs (runtime Run records). */
export interface RunsListParams {
  readonly loopId?: string;
  readonly limit?: number;
}
export interface RunsListResult {
  readonly runs: readonly Run[];
}

/** runs.get { id } → the run plus its full turn history. */
export interface RunsGetParams {
  readonly id: string;
}
export interface RunsGetResult {
  readonly run: Run;
  readonly turns: readonly Turn[];
}

/** runs.steer / runs.continue { id, text }; runs.cancel { id }. */
export interface RunsTextParams {
  readonly id: string;
  readonly text: string;
}
export interface RunsIdParams {
  readonly id: string;
}

export const WIRE_METHODS = {
  loopsList: "loops.list",
  loopsGet: "loops.get",
  loopsSetEnabled: "loops.setEnabled",
  runsList: "runs.list",
  runsGet: "runs.get",
  runsSubscribe: "runs.subscribe",
  runsSteer: "runs.steer",
  runsCancel: "runs.cancel",
  runsContinue: "runs.continue",
} as const;
