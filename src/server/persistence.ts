/**
 * Persistence bridge — subscribes to a Runner's events and mirrors them
 * into the store. This is THE write path for run state (the runtime itself
 * is in-memory; SPECS/agent.md keeps it that way).
 *
 * Per event batch we: upsert the run row on status changes, upsert the turn
 * row on turn/part events, fold usage, and store a fresh snapshot (so a
 * crash mid-exchange restores as `error: interrupted` per snapshot.ts).
 *
 * Original code.
 */

import type { Runner } from "../runtime/runner.ts";
import { toSnapshot } from "../runtime/snapshot.ts";
import type { RunEvent } from "../runtime/types.ts";
import type { Store } from "./store.ts";

/**
 * Attach persistence for ONE run. Returns the unsubscribe function.
 * Call it right after `runner.start(...)` (or restore) — events replay from
 * seq 0 for late attachment, so nothing is lost.
 */
export function persistRun(runner: Runner, store: Store, runId: string): () => void {
  return runner.subscribe(runId, (event: RunEvent) => {
    switch (event.type) {
      case "runStatus": {
        const run = event.run;
        if (event.status === "pending") {
          store.insertRun(run);
          store.appendAudit("run.created", { loopId: run.loopId, runId: run.id });
        } else {
          store.updateRun(run);
          store.appendAudit("run.status", { loopId: run.loopId, runId: run.id, detail: { status: run.status, error: run.error } });
        }
        store.saveSnapshot(run.id, event.at, JSON.stringify(toSnapshot(run, runner.getTurns(runId), event.at)));
        break;
      }
      case "turnStarted": {
        store.upsertTurn(event.turn);
        store.saveSnapshot(runId, event.at, JSON.stringify(toSnapshot(runner.getRun(runId), runner.getTurns(runId), event.at)));
        break;
      }
      case "turnCompleted": {
        const turn = runner.getTurns(runId).find((t) => t.id === event.turnId);
        if (turn !== undefined) store.upsertTurn(turn);
        store.saveSnapshot(runId, event.at, JSON.stringify(toSnapshot(runner.getRun(runId), runner.getTurns(runId), event.at)));
        break;
      }
      case "partAppended": {
        const turn = runner.getTurns(runId).find((t) => t.id === event.turnId);
        if (turn !== undefined) store.upsertTurn(turn);
        break;
      }
      case "usage": {
        store.updateRun(runner.getRun(runId));
        store.appendAudit("run.usage", { runId, detail: event.usage });
        break;
      }
    }
  });
}

/**
 * Boot restore: load every stored snapshot into a fresh Runner. Runs caught
 * mid-exchange come back as `error: interrupted` (fromSnapshot's rule);
 * parked runs come back parked awaiting their answer.
 */
export function restoreRuns(runner: Runner, store: Store): number {
  let restored = 0;
  for (const row of store.listSnapshots()) {
    const snapshot = JSON.parse(row.json) as Parameters<typeof runner.restore>[0];
    runner.restore(snapshot);
    persistRun(runner, store, row.runId);
    restored += 1;
  }
  return restored;
}
