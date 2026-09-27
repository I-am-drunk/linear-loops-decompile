/**
 * T-1103 follow-up — the live composition root. Builds on T-1101's
 * createLoopsServer (untouched) and attaches everything the M5 end-to-end
 * path needs, using the merged #111 seams:
 *
 *   TokenStore (T-901) → ChannelServer (T-902) → createOrchestrator (#81,
 *   publish sink = createRunEventPublisher → runs.event fan-out + the
 *   scope-gated runs.created broadcast) → registerDomainRpcs (#111:
 *   loops.* + runs.list/get) → channel.attach → boot reloadLoops().
 *
 * This module also supplies the two small bindings the channel's design
 * leaves to the composition root (src/connect README §Method ownership):
 * - runtimeCommandsFor — runs.steer on a parked (awaitingInput) run IS the
 *   elicitation answer (the v1 wire has no runs.respond; the UI's
 *   FollowUpBox "Send answer" maps to steer — settled copy, hub #21
 *   00:14:52Z); runs.continue resolves the loop's brain via brainFor.
 * - runnerRegistryView — the channel's RunRegistry liveness gate over the
 *   live Runner (T-1103's has()/activeRunIds() accessors).
 *
 * The engine's tick is NOT started here — driving it (cron interval,
 * webhook/poll delivery into handleEvent) is the deployment's choice
 * (start.ts ticks every 30s; tests drive tick/handleEvent explicitly).
 *
 * Original code.
 */

import { ChannelServer } from "../connect/channel.ts";
import type { RuntimeCommands } from "../connect/channel.ts";
import { RPC_ERRORS, RpcError } from "../connect/rpc.ts";
import { TokenStore } from "../connect/tokens.ts";
import type { EnvironmentDescriptor } from "../connect/descriptor.ts";
import { RunQueue } from "../engine/queue.ts";
import { ScheduleRegistry } from "../engine/registry.ts";
import type { ScheduleStore } from "../engine/registry.ts";
import type { Brain } from "../runtime/brain.ts";
import type { EntityReader } from "../runtime/context.ts";
import type { Runner } from "../runtime/runner.ts";
import type { WorkflowDefinition } from "../model/loop.ts";
import { createOrchestrator, definitionFor } from "./orchestrator.ts";
import type { Orchestrator, WriteBackSink } from "./orchestrator.ts";
import { createRunEventPublisher, registerDomainRpcs } from "./rpcs.ts";
import { createLoopsServer } from "./index.ts";
import type { LoopsServer, LoopsServerOptions } from "./index.ts";
import type { Store } from "./store.ts";

/** The channel's RuntimeCommands over the real Runner (binding doc above). */
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

export interface LiveLoopsServerOptions extends LoopsServerOptions {
  /** Inject for tests or to share a persisted store; default in-memory. */
  tokens?: TokenStore | undefined;
  /** Engine stores; default in-memory (v1 — waterlines reset on restart). */
  queue?: RunQueue | undefined;
  scheduleStore?: ScheduleStore | undefined;
  /** Brain seam override (tests); defaults to T-1105's harness binding. */
  brainFor?: ((loop: WorkflowDefinition) => Brain) | undefined;
  /** Dataplane seams; absent = context-free prompts and no write-back. */
  reader?: EntityReader | undefined;
  writeBack?: WriteBackSink | undefined;
  /** Channel tuning (tests). */
  authTimeoutMs?: number | undefined;
  descriptor?: Partial<EnvironmentDescriptor> | undefined;
  /** Loop id minting for loops.upsert creates (tests: deterministic ids). */
  idgen?: (() => string) | undefined;
}

export interface LiveLoopsServer extends LoopsServer {
  readonly channel: ChannelServer;
  readonly orchestrator: Orchestrator;
  readonly tokens: TokenStore;
  readonly queue: RunQueue;
  readonly registry: ScheduleRegistry;
  /** Boot reloadLoops() result (scheduled/event/chat counts). */
  readonly bootLoops: { scheduled: number; event: number; chat: number };
}

export function createLiveLoopsServer(options: LiveLoopsServerOptions = {}): LiveLoopsServer {
  const base = createLoopsServer(options);
  const tokens = options.tokens ?? new TokenStore();
  const queue = options.queue ?? new RunQueue();
  const registry = new ScheduleRegistry(options.scheduleStore);
  const brainFor = options.brainFor ?? base.brainFor;

  const descriptor: EnvironmentDescriptor = {
    id: "env-loops",
    label: "loops-server",
    platform: process.platform,
    capabilities: ["loops", "runs", "settings"],
    protocol: 1,
    product: "loops-server",
    version: "0.1.0",
    ...(options.descriptor ?? {}),
  } as EnvironmentDescriptor;

  const channel = new ChannelServer({
    tokens,
    registry: runnerRegistryView(base.runner),
    runtime: runtimeCommandsFor({ runner: base.runner, store: base.store, brainFor }),
    descriptor,
    ...(options.authTimeoutMs !== undefined ? { authTimeoutMs: options.authTimeoutMs } : {}),
  });

  const orchestrator = createOrchestrator({
    store: base.store,
    runner: base.runner,
    queue,
    registry,
    brainFor,
    reader: options.reader,
    writeBack: options.writeBack,
    publish: createRunEventPublisher(channel),
  });

  registerDomainRpcs(channel, {
    store: base.store,
    runner: base.runner,
    orchestrator,
    ...(options.idgen !== undefined ? { idgen: options.idgen } : {}),
  });
  channel.attach(base.server);
  const bootLoops = orchestrator.reloadLoops();

  return {
    ...base,
    channel,
    orchestrator,
    tokens,
    queue,
    registry,
    bootLoops,
    close() {
      channel.closeAll();
      return base.close();
    },
  };
}
