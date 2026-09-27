/**
 * createLoopsServer — the composition root. Owns the store, the Runner, the
 * connect channel, and the HTTP server; the engine (R4) and inference (R6)
 * attach to what it returns.
 *
 * Wiring contract:
 * - engine (R4) fires runs: `store.claimRunKey(hash(loopId, eventId), runId)`
 *   first (idempotency rail); then `runner.start({...})` + `persistRun`.
 * - connect (R9): the channel is created HERE (T-1103) and attached to the
 *   HTTP server's upgrade event; the environment descriptor stays mountable
 *   via the constructor's `environmentHandler`. The domain RPCs
 *   (loops.*, runs.list/get) are registered on it from the Store, and every
 *   loop write re-phases the engine through the orchestrator's reloadLoops.
 * - orchestrator (T-1102): created when a `brainFor` is supplied (R6's
 *   binding — T-1105 exposes one on this very object). Its run-event fan-out
 *   is the channel (publish + `runs.created` broadcast).
 * - inference (R6) provides the Brain passed to `runner.start`; usage
 *   counters arrive via `runner.recordUsage`.
 *
 * Original code.
 */

import type { Server } from "node:http";
import { ChannelServer } from "../connect/channel.ts";
import type { RunRegistry, RuntimeCommands } from "../connect/channel.ts";
import type { EnvironmentDescriptor } from "../connect/descriptor.ts";
import { RPC_ERRORS, RpcError } from "../connect/rpc.ts";
import { TokenStore } from "../connect/tokens.ts";
import { RunQueue } from "../engine/queue.ts";
import { ScheduleRegistry } from "../engine/registry.ts";
import { IllegalRunTransitionError } from "../runtime/run-machine.ts";
import { Runner, RunNotFoundError } from "../runtime/runner.ts";
import type { Brain } from "../runtime/brain.ts";
import { openDatabase } from "./db.ts";
import type { Database } from "./db.ts";
import { createHttpServer } from "./http.ts";
import type { HttpOptions } from "./http.ts";
import { createOrchestrator, definitionFor } from "./orchestrator.ts";
import type { Orchestrator, OrchestratorDeps } from "./orchestrator.ts";
import { restoreRuns } from "./persistence.ts";
import { channelRunEventSink, registerDomainRpcs } from "./rpc.ts";
import { Store } from "./store.ts";

export interface LoopsServerOptions extends HttpOptions {
  /** SQLite file path, or ":memory:" (tests). Defaults to ./loops.db. */
  dbPath?: string;
  /**
   * R6 brain seam (T-1105): per-loop Brain factory. When present the
   * orchestrator is created (and reloadLoops runs at boot); when absent the
   * RPC surface still works and `orchestrator` is null — runs.continue and
   * answering an elicitation on a restored run then report UNAVAILABLE,
   * since both need a brain.
   */
  brainFor?: OrchestratorDeps["brainFor"] | undefined;
  /** Runtime EntityReader seam (T-304 over the real dataplane). */
  entityReader?: OrchestratorDeps["reader"];
  /** Linear write-back seam (comments on completed runs). */
  writeBack?: OrchestratorDeps["writeBack"];
  /**
   * Connect channel auth store. Default: in-memory (tokens die at restart —
   * the SQLite TokenPersistence seam the tokens.ts header names is the
   * follow-up; the schema bump rides with it).
   */
  tokens?: TokenStore | undefined;
  /** Registers the channel's built-in env.describe when present. */
  channelDescriptor?: EnvironmentDescriptor | undefined;
}

export interface LoopsServer {
  server: Server;
  db: Database;
  store: Store;
  runner: Runner;
  /** The connect channel, attached to `server`'s upgrade event (T-1103). */
  channel: ChannelServer;
  /** The channel's token store (the pairing flow mints through it). */
  tokens: TokenStore;
  /** The M5 orchestrator — null until a brainFor is supplied (T-1105). */
  orchestrator: Orchestrator | null;
  /** Number of runs restored from snapshots at boot. */
  restoredRuns: number;
  listen(port: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export function createLoopsServer(options: LoopsServerOptions = {}): LoopsServer {
  const db = openDatabase(options.dbPath ?? "./loops.db");
  const store = new Store(db);
  const runner = new Runner();
  const restoredRuns = restoreRuns(runner, store);
  const server = createHttpServer(options);

  // ---- connect channel (T-1103) ------------------------------------------
  const tokens = options.tokens ?? new TokenStore();
  const registry: RunRegistry = {
    has: (runId) => runner.has(runId),
    activeRunIds: () => runner.activeRunIds(),
  };
  const brainForLoop = (runId: string): Brain => {
    if (options.brainFor === undefined) {
      throw new RpcError(RPC_ERRORS.UNAVAILABLE, "no brain bound (T-1105 brain binding pending)");
    }
    const run = runner.getRun(runId);
    const row = store.getLoop(run.loopId);
    const def = row === null ? null : definitionFor(row);
    if (def === null) throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown loop: ${run.loopId}`);
    return options.brainFor(def);
  };
  const runtime: RuntimeCommands = {
    steer: (runId, text) => {
      try {
        // The UI's one "send" box serves both runtime verbs: mid-exchange
        // guidance (steer) and the parked elicitation's answer (respond).
        if (runner.getRun(runId).status === "awaitingInput") {
          // A restored run carries no brain — rebind one when R6 is wired.
          if (options.brainFor !== undefined) runner.respond(runId, text, brainForLoop(runId));
          else runner.respond(runId, text);
        } else {
          runner.steer(runId, text);
        }
      } catch (error) {
        throw mapRuntimeError(error);
      }
    },
    cancel: (runId) => {
      try {
        runner.cancel(runId);
      } catch (error) {
        throw mapRuntimeError(error);
      }
    },
    continue: (runId, text) => {
      try {
        runner.continueRun(runId, text, brainForLoop(runId));
      } catch (error) {
        throw mapRuntimeError(error);
      }
    },
  };
  const channel = new ChannelServer({
    tokens,
    registry,
    runtime,
    ...(options.channelDescriptor !== undefined ? { descriptor: options.channelDescriptor } : {}),
  });
  channel.attach(server);

  // ---- orchestrator (T-1102) + domain RPCs (T-1103) -----------------------
  let orchestrator: Orchestrator | null = null;
  if (options.brainFor !== undefined) {
    orchestrator = createOrchestrator({
      store,
      runner,
      queue: new RunQueue(),
      registry: new ScheduleRegistry(),
      brainFor: options.brainFor,
      ...(options.entityReader !== undefined ? { reader: options.entityReader } : {}),
      ...(options.writeBack !== undefined ? { writeBack: options.writeBack } : {}),
      publish: channelRunEventSink(channel),
    });
    // Boot re-phase: scheduled loops land in the registry from the rows.
    orchestrator.reloadLoops();
  }
  const orch = orchestrator;
  registerDomainRpcs(channel, {
    store,
    ...(orch !== null ? { reloadLoops: () => orch.reloadLoops() } : {}),
  });

  return {
    server,
    db,
    store,
    runner,
    channel,
    tokens,
    orchestrator,
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
        channel.closeAll();
        db.close();
        server.close(() => resolve());
      });
    },
  };
}

/** Wire-code mapping for runtime seams the channel delegates to us. */
function mapRuntimeError(error: unknown): Error {
  if (error instanceof RpcError) return error;
  if (error instanceof RunNotFoundError) return new RpcError(RPC_ERRORS.NOT_FOUND, error.message);
  if (error instanceof IllegalRunTransitionError) {
    return new RpcError(RPC_ERRORS.INVALID_REQUEST, error.message);
  }
  return error instanceof Error ? error : new Error(String(error));
}
