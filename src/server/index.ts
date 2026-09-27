/**
 * createLoopsServer — the composition root. Owns the store, the Runner, and
 * the HTTP server; the engine (R4) and connect channel (R9) attach to what
 * it returns.
 *
 * Wiring contract:
 * - engine (R4) fires runs: `store.claimRunKey(hash(loopId, eventId), runId)`
 *   first (idempotency rail); then `runner.start({...})` + `persistRun`.
 * - connect (R9) attaches its WS `upgrade` listener to `server` and mounts
 *   its environment descriptor via the constructor's `environmentHandler`.
 * - inference (R6) provides the Brain passed to `runner.start`; usage
 *   counters arrive via `runner.recordUsage`.
 *
 * Original code.
 */

import type { Server } from "node:http";
import { Runner } from "../runtime/runner.ts";
import type { Brain } from "../runtime/brain.ts";
import type { WorkflowDefinition } from "../model/loop.ts";
import type { HarnessSettingsStore } from "../inference/src/index.ts";
import { openDatabase } from "./db.ts";
import type { Database } from "./db.ts";
import { createHttpServer } from "./http.ts";
import type { HttpOptions } from "./http.ts";
import { Store } from "./store.ts";
import { restoreRuns } from "./persistence.ts";
import { createBrainFor, createInferenceStores } from "./brain.ts";

export interface LoopsServerOptions extends HttpOptions {
  /** SQLite file path, or ":memory:" (tests). Defaults to ./loops.db. */
  dbPath?: string;
}

export interface LoopsServer {
  server: Server;
  db: Database;
  store: Store;
  runner: Runner;
  /**
   * R6 brain seam (T-1105): per-loop Brain factory bound to the persisted
   * harness settings — the orchestrator's `brainFor` dependency.
   */
  brainFor: (loop: WorkflowDefinition) => Brain;
  /** Inference harness settings (write-only secrets) — the settings-RPC seam. */
  harnessStore: HarnessSettingsStore;
  /** Number of runs restored from snapshots at boot. */
  restoredRuns: number;
  listen(port: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export function createLoopsServer(options: LoopsServerOptions = {}): LoopsServer {
  const dbPath = options.dbPath ?? "./loops.db";
  const db = openDatabase(dbPath);
  const store = new Store(db);
  const runner = new Runner();
  const restoredRuns = restoreRuns(runner, store);
  const server = createHttpServer(options);
  const { harnessStore } = createInferenceStores(db, dbPath);
  const brainFor = createBrainFor({ harnessStore, runner });

  return {
    server,
    db,
    store,
    runner,
    brainFor,
    harnessStore,
    restoredRuns,
    listen(port, host) {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          const address = server.address();
          resolve(typeof address === "object" && address !== null ? address.port : port);
        });
      });
    },
    close() {
      return new Promise((resolve) => {
        db.close();
        server.close(() => resolve());
      });
    },
  };
}
