/**
 * T-1103 — the live composition root. Builds on T-1101's createLoopsServer
 * (untouched) and attaches everything the M5 end-to-end path needs:
 *
 *   TokenStore (T-901) → ChannelServer (T-902, attached to the http upgrade)
 *   → registerLoopsRpc (this package — loops.* + runs.list/get handlers)
 *   → runtimeCommandsFor (steer/cancel/continue over the real Runner)
 *   → createOrchestrator (merged #81: engine → queue → store → runtime
 *     → brain → write-back) with the channel as its publish sink
 *   → reloadLoops() at boot (stored loops enter the schedule registry).
 *
 * The engine's tick is NOT started here — driving it (cron interval,
 * webhook/poll delivery into handleEvent) is the deployment's choice
 * (start.ts ticks every 30s; tests drive tick/handleEvent explicitly).
 *
 * Original code.
 */

import { ChannelServer } from "../connect/channel.ts";
import { TokenStore } from "../connect/tokens.ts";
import type { EnvironmentDescriptor } from "../connect/descriptor.ts";
import { RunQueue } from "../engine/queue.ts";
import { ScheduleRegistry } from "../engine/registry.ts";
import type { ScheduleStore } from "../engine/registry.ts";
import type { Brain } from "../runtime/brain.ts";
import type { EntityReader } from "../runtime/context.ts";
import type { WorkflowDefinition } from "../model/loop.ts";
import { createOrchestrator } from "./orchestrator.ts";
import type { Orchestrator, WriteBackSink } from "./orchestrator.ts";
import { registerLoopsRpc, runnerRegistryView, runtimeCommandsFor } from "./rpc.ts";
import { createLoopsServer } from "./index.ts";
import type { LoopsServer, LoopsServerOptions } from "./index.ts";

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
  channel.attach(base.server);

  const orchestrator = createOrchestrator({
    store: base.store,
    runner: base.runner,
    queue,
    registry,
    brainFor,
    reader: options.reader,
    writeBack: options.writeBack,
    publish: (runId, event) => channel.publishRunEvent(runId, event),
  });

  registerLoopsRpc({ channel, store: base.store, runner: base.runner, orchestrator });
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
