/**
 * Run snapshots — resume-from-store for the runtime.
 *
 * The server (T-1101) persists one JSON snapshot per event batch. On restart
 * it hands the snapshot back: finished runs restore verbatim; a run caught
 * MID-EXCHANGE (status `active` — its brain stream died with the process)
 * restores as a first-class failed run: status `error`, error `"interrupted"`,
 * endedAt = the snapshot time. Failed runs are the engine's (R4) retry
 * signal — "interrupted" is the retryable kind, as opposed to a brain or
 * dataplane failure.
 *
 * A run parked in `awaitingInput` restores still parked — the user's answer
 * is the resume mechanism, and `Runner.respond` drives the next exchange.
 *
 * Format is versioned (`SNAPSHOT_VERSION`); `fromSnapshot` validates the
 * shape and throws SnapshotError on junk rather than resurrecting a
 * half-broken run.
 *
 * Original code.
 */

import { RUN_STATUSES, TURN_ROLES } from "../model/enums.ts";
import type { RunStatus } from "../model/enums.ts";
import type { ISODateTime } from "../model/loop.ts";
import type { Run, Turn } from "./types.ts";
import { TURN_STATUSES } from "./types.ts";
import type { TurnStatus } from "./types.ts";

export const SNAPSHOT_VERSION = 1;

export interface RunSnapshot {
  version: typeof SNAPSHOT_VERSION;
  savedAt: ISODateTime;
  run: Run;
  turns: Turn[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

/** Serialize a run + its turns. The Runner emits; the server persists. */
export function toSnapshot(run: Run, turns: readonly Turn[], savedAt: ISODateTime): RunSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    savedAt,
    run: structuredClone(run),
    turns: structuredClone(turns) as Turn[],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(rec: Record<string, unknown>, key: string, where: string): string {
  const value = rec[key];
  if (typeof value !== "string" || value === "") {
    throw new SnapshotError(`${where}.${key}: expected non-empty string`);
  }
  return value;
}

function validateStatus(value: unknown, allowed: readonly string[], where: string): string {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new SnapshotError(`${where}: expected one of ${allowed.join("|")}, got ${String(value)}`);
  }
  return value;
}

/**
 * Parse + validate a stored snapshot, applying the resume rules:
 * - `active` at snapshot time → `error` / `"interrupted"` (retryable).
 * - a turn left `streaming` → closed as `error` at the snapshot time.
 * - everything else restores verbatim.
 */
export function fromSnapshot(json: unknown): { run: Run; turns: Turn[] } {
  if (!isRecord(json)) throw new SnapshotError("snapshot: not an object");
  if (json["version"] !== SNAPSHOT_VERSION) {
    throw new SnapshotError(`snapshot.version: expected ${SNAPSHOT_VERSION}, got ${String(json["version"])}`);
  }
  const savedAt = requireString(json, "savedAt", "snapshot");
  if (!isRecord(json["run"])) throw new SnapshotError("snapshot.run: not an object");
  if (!Array.isArray(json["turns"])) throw new SnapshotError("snapshot.turns: not an array");

  const runRec = json["run"];
  const status = validateStatus(runRec["status"], RUN_STATUSES, "run.status") as RunStatus;
  const run = structuredClone(runRec) as unknown as Run;
  run.status = status;

  const turns: Turn[] = json["turns"].map((raw: unknown, i: number) => {
    if (!isRecord(raw)) throw new SnapshotError(`turns[${i}]: not an object`);
    validateStatus(raw["role"], TURN_ROLES, `turns[${i}].role`);
    validateStatus(raw["status"], TURN_STATUSES, `turns[${i}].status`);
    if (!Array.isArray(raw["parts"])) throw new SnapshotError(`turns[${i}].parts: not an array`);
    return structuredClone(raw) as unknown as Turn;
  });

  // Resume rules.
  for (const turn of turns) {
    if (turn.status === "streaming") {
      turn.status = "error" as TurnStatus;
      turn.endedAt = savedAt;
    }
  }
  if (run.status === "awaitingInput" && run.pendingElicitation === undefined) {
    throw new SnapshotError("run awaitingInput without pendingElicitation");
  }
  if (run.status === "active") {
    run.status = "error";
    run.error = "interrupted";
    run.endedAt = savedAt;
    run.pendingElicitation = undefined;
  }
  return { run, turns };
}
