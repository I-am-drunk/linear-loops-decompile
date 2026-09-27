/**
 * T-1104 — data sources for the loops/runs pages.
 *
 * A source is the container's whole world: list/get/watch + intents. Two
 * implementations behind one interface:
 *   - live    — the T3 connect channel (contract.ts shapes), and
 *   - fixture — the demo fixtures (offline/no-server mode, today's behavior).
 *
 * The structural `ChannelRpc` seam is what tests fake — sources never touch
 * ChannelClient directly, so `node --experimental-strip-types --test` covers
 * the full mapping/flow without a socket.
 */
import type { ChannelClient } from "../../../connect/client.ts";
import type { LoopSummary } from "../features/loops/types.ts";
import type { RunDetail, RunSummary } from "../features/loops/runs/types.ts";
import { demoLoops } from "../features/loops/fixtures.ts";
import {
  demoRunDetail,
  demoRunDetailDone,
  demoRunDetailLive,
  demoRuns,
} from "../features/loops/runs/fixtures.ts";
import type { RunEvent } from "../../../runtime/types.ts";
import {
  RPC,
  type LoopsListResult,
  type LoopsUpsertResult,
  type RunsGetResult,
  type RunsListResult,
  type WireLoop,
  type WireRun,
} from "./contract.ts";
import type { LoopConfig } from "../../../model/index.ts";
import {
  createRunDetailReducer,
  wireLoopToSummary,
  wireRunToDetail,
  wireRunToSummary,
} from "./mappers.ts";

/** Run events cross the channel opaque (channel.ts's own payload type); the
 *  source casts at this one boundary — the server publishes runtime RunEvents. */
export type WireEventPayload = Record<string, unknown> & { type: string };

/** The slice of ChannelClient the sources use (structural — tests fake it). */
export interface ChannelRpc {
  request(method: string, params?: unknown): Promise<unknown>;
  subscribeRuns(
    runId: string,
    onEvent?: (event: WireEventPayload, seq: number) => void,
  ): Promise<unknown>;
  unsubscribe(runId: string): void;
}

export interface LoopsSource {
  readonly kind: "live" | "fixture";
  /** Synchronously known rows (fixtures), null when a fetch is required.
   *  Lets SSR and first paint render offline data without an effect turn. */
  peekLoops?(): readonly LoopSummary[] | null;
  listLoops(): Promise<readonly LoopSummary[]>;
  /** Server-authoritative: resolves after the server confirms; no local flip. */
  setEnabled(id: string, enabled: boolean): Promise<void>;
  /** Draft save + publish; returns the loop id (create when id is null). The
   *  editor container (R8's wiring delta) calls this. */
  saveLoop(id: string | null, config: LoopConfig): Promise<string>;
}

export interface RunsSource {
  readonly kind: "live" | "fixture";
  peekRuns?(loopId?: string): readonly RunSummary[] | null;
  peekRun?(runId: string): RunDetail | null;
  listRuns(loopId?: string): Promise<readonly RunSummary[]>;
  getRun(runId: string): Promise<RunDetail>;
  /** Initial detail + live tail until the returned unsubscribe runs. */
  watchRun(runId: string, onUpdate: (detail: RunDetail) => void): Promise<() => void>;
  steer(runId: string, text: string): Promise<void>;
  cancel(runId: string): Promise<void>;
  continueRun(runId: string, text: string): Promise<void>;
}

// ---- live -----------------------------------------------------------------

export class LiveLoopsSource implements LoopsSource {
  readonly kind = "live" as const;
  readonly #rpc: ChannelRpc;

  constructor(rpc: ChannelRpc) {
    this.#rpc = rpc;
  }

  async listLoops(): Promise<readonly LoopSummary[]> {
    const [loopsResult, runsResult] = await Promise.all([
      this.#rpc.request(RPC.loopsList) as Promise<LoopsListResult>,
      this.#rpc.request(RPC.runsList, { limit: 200 }) as Promise<RunsListResult>,
    ]);
    const lastByLoop = new Map<string, WireRun>();
    for (const run of runsResult.runs) {
      const prev = lastByLoop.get(run.loopId);
      if (prev === undefined || run.createdAt > prev.createdAt) lastByLoop.set(run.loopId, run);
    }
    return loopsResult.loops.map((loop: WireLoop) => wireLoopToSummary(loop, lastByLoop.get(loop.id)));
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.#rpc.request(RPC.loopsSetEnabled, { id, enabled });
  }

  async saveLoop(id: string | null, config: LoopConfig): Promise<string> {
    const upserted = (await this.#rpc.request(RPC.loopsUpsert, {
      ...(id !== null ? { id } : {}),
      config,
    })) as LoopsUpsertResult;
    const published = (await this.#rpc.request(RPC.loopsPublish, {
      id: upserted.loop.id,
    })) as LoopsUpsertResult;
    return published.loop.id;
  }
}

export class LiveRunsSource implements RunsSource {
  readonly kind = "live" as const;
  readonly #rpc: ChannelRpc;

  constructor(rpc: ChannelRpc) {
    this.#rpc = rpc;
  }

  async #loopNames(): Promise<ReadonlyMap<string, string>> {
    const result = (await this.#rpc.request(RPC.loopsList)) as LoopsListResult;
    return new Map(result.loops.map((loop) => [loop.id, loop.name || loop.config.name]));
  }

  async listRuns(loopId?: string): Promise<readonly RunSummary[]> {
    const [names, result] = await Promise.all([
      this.#loopNames(),
      this.#rpc.request(RPC.runsList, {
        ...(loopId !== undefined ? { loopId } : {}),
        limit: 200,
      }) as Promise<RunsListResult>,
    ]);
    return result.runs.map((run) => wireRunToSummary(run, names.get(run.loopId) ?? run.loopId));
  }

  async getRun(runId: string): Promise<RunDetail> {
    const [names, result] = await Promise.all([
      this.#loopNames(),
      this.#rpc.request(RPC.runsGet, { id: runId }) as Promise<RunsGetResult>,
    ]);
    return wireRunToDetail(result.run, result.turns, names.get(result.run.loopId) ?? result.run.loopId);
  }

  async watchRun(runId: string, onUpdate: (detail: RunDetail) => void): Promise<() => void> {
    const initial = await this.getRun(runId);
    const reducer = createRunDetailReducer(initial);
    onUpdate(reducer.detail);
    await this.#rpc.subscribeRuns(runId, (raw: WireEventPayload) => {
      onUpdate(reducer.apply(raw as RunEvent));
    });
    return () => this.#rpc.unsubscribe(runId);
  }

  async steer(runId: string, text: string): Promise<void> {
    await this.#rpc.request(RPC.runsSteer, { id: runId, text });
  }

  async cancel(runId: string): Promise<void> {
    await this.#rpc.request(RPC.runsCancel, { id: runId });
  }

  async continueRun(runId: string, text: string): Promise<void> {
    await this.#rpc.request(RPC.runsContinue, { id: runId, text });
  }
}

// ---- fixture (offline/demo mode — the pre-T-1104 behavior) -----------------

export class FixtureLoopsSource implements LoopsSource {
  readonly kind = "fixture" as const;

  peekLoops(): readonly LoopSummary[] {
    return demoLoops;
  }

  listLoops(): Promise<readonly LoopSummary[]> {
    return Promise.resolve(demoLoops);
  }

  setEnabled(_id: string, _enabled: boolean): Promise<void> {
    return Promise.resolve(); // fixture toggle is a no-op by design
  }

  saveLoop(_id: string | null, _config: LoopConfig): Promise<string> {
    return Promise.reject(new Error("loop writes need a connected server"));
  }
}

const FIXTURE_DETAILS: readonly RunDetail[] = [demoRunDetail, demoRunDetailDone, demoRunDetailLive];

export class FixtureRunsSource implements RunsSource {
  readonly kind = "fixture" as const;

  peekRuns(loopId?: string): readonly RunSummary[] {
    return loopId === undefined ? demoRuns : demoRuns.filter((r) => r.loopId === loopId);
  }

  peekRun(runId: string): RunDetail | null {
    return FIXTURE_DETAILS.find((d) => d.id === runId) ?? null;
  }

  listRuns(loopId?: string): Promise<readonly RunSummary[]> {
    return Promise.resolve(this.peekRuns(loopId));
  }

  getRun(runId: string): Promise<RunDetail> {
    const found = this.peekRun(runId);
    return found !== null
      ? Promise.resolve(found)
      : Promise.reject(new Error(`run ${runId} is not in the offline fixture set`));
  }

  watchRun(runId: string, onUpdate: (detail: RunDetail) => void): Promise<() => void> {
    return this.getRun(runId).then((detail) => {
      onUpdate(detail);
      return () => {};
    });
  }

  steer(_runId: string, _text: string): Promise<void> {
    return Promise.resolve();
  }

  cancel(_runId: string): Promise<void> {
    return Promise.resolve();
  }

  continueRun(_runId: string, _text: string): Promise<void> {
    return Promise.resolve();
  }
}

// ---- selection --------------------------------------------------------------

export interface Sources {
  readonly loops: LoopsSource;
  readonly runs: RunsSource;
}

/** Fixture when unconfigured/offline — the app behaves exactly as before. */
export function selectSources(client: ChannelClient | null): Sources {
  if (client === null) {
    return { loops: new FixtureLoopsSource(), runs: new FixtureRunsSource() };
  }
  return { loops: new LiveLoopsSource(client), runs: new LiveRunsSource(client) };
}
