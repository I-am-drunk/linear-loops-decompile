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
import type { HarnessSettingsStore, SecretStore } from "../inference/src/index.ts";
import { openDatabase } from "./db.ts";
import type { Database } from "./db.ts";
import { createHttpServer } from "./http.ts";
import type { HttpOptions } from "./http.ts";
import { Store } from "./store.ts";
import { restoreRuns } from "./persistence.ts";
import { createBrainFor, createInferenceStores } from "./brain.ts";
import { registerDomainRpcs } from "./rpcs.ts";
import type { DomainChannel, OrchestratorReload } from "./rpcs.ts";

export { registerDomainRpcs, createRunEventPublisher, toWireLoop } from "./rpcs.ts";
export type { DomainChannel, DomainRpcDeps, OrchestratorReload, RunEventChannel, WireLoop } from "./rpcs.ts";

export interface LoopsServerOptions extends HttpOptions {
  /** SQLite file path, or ":memory:" (tests). Defaults to ./loops.db. */
  dbPath?: string;
  /**
   * T-1103: the T3 connect channel (structural — the real ChannelServer
   * satisfies this). When present, the loops + runs domain RPCs register
   * on it at construction, before any socket attaches.
   */
  channel?: DomainChannel | undefined;
  /** M5 orchestrator — the loop write RPCs hook its reloadLoops(). */
  orchestrator?: OrchestratorReload | undefined;
  /** Loop id minting for loops.upsert creates (tests: deterministic ids). */
  idgen?: (() => string) | undefined;
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
  /** The encrypted secret store (T-1106: Linear PAT persistence shares it). */
  secretStore: SecretStore;
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
  const { harnessStore, secretStore } = createInferenceStores(db, dbPath);
  const brainFor = createBrainFor({ harnessStore, runner });

  if (options.channel !== undefined) {
    registerDomainRpcs(options.channel, {
      store,
      runner,
      ...(options.orchestrator !== undefined ? { orchestrator: options.orchestrator } : {}),
      ...(options.idgen !== undefined ? { idgen: options.idgen } : {}),
    });
  }

  return {
    server,
    db,
    store,
    runner,
    brainFor,
    harnessStore,
    secretStore,
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
