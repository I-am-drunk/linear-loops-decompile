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
import { demoEditorConfig } from "../features/loops/editor/fixtures.ts";
import {
  demoRunDetail,
  demoRunDetailDone,
  demoRunDetailLive,
  demoRuns,
} from "../features/loops/runs/fixtures.ts";
import type { RunEvent } from "../../../runtime/types.ts";
import {
  RPC,
  type LoopsGetResult,
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
  isWireRunEvent,
  wireLoopToSummary,
  wireRunToDetail,
  wireRunToSummary,
} from "./mappers.ts";

/** Run events cross the channel opaque (channel.ts's own payload type); the
 *  source validates + casts at this one boundary — the server publishes
 *  runtime RunEvents. */
export type WireEventPayload = Record<string, unknown> & { type: string };

/**
 * The slice of ChannelClient the sources use (structural — tests fake it).
 * `onEvent` is the client's global `runs.event` sink: it fires for every
 * notification, subscribed or not, so ONE live watch owns it at a time (the
 * run-detail route — multiplexing is M6 if a second view ever needs it).
 */
export interface ChannelRpc {
  request(method: string, params?: unknown): Promise<unknown>;
  onEvent: ((runId: string, seq: number, event: WireEventPayload) => void) | undefined;
  /** Socket lifecycle — the watch re-subscribes on re-open (the client's own
   *  #subs resume only covers its subscribeRuns path, not a direct request). */
  onStateChange: ((state: "connecting" | "open" | "closed") => void) | undefined;
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
  /** T-805: one loop's editable record — the editor container's draft source. */
  getLoop(id: string): Promise<EditorLoopRecord>;
}

/** The editor's draft source: config + the published version it bases on. */
export interface EditorLoopRecord {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly config: LoopConfig;
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

  async getLoop(id: string): Promise<EditorLoopRecord> {
    const result = (await this.#rpc.request(RPC.loopsGet, { id })) as LoopsGetResult;
    const loop = result.loop;
    return { id: loop.id, name: loop.name || loop.config.name, version: loop.version, config: loop.config };
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

  /**
   * Snapshot + incremental tail. `runs.get` carries the history AND the
   * log's `lastSeq`; the subscribe resumes from exactly there, so an event
   * emitted between the two RPCs arrives in the replay — never missed,
   * never doubled (replay and live events are both seq-filtered at maxSeq).
   */
  async watchRun(runId: string, onUpdate: (detail: RunDetail) => void): Promise<() => void> {
    const [names, result] = await Promise.all([
      this.#loopNames(),
      this.#rpc.request(RPC.runsGet, { id: runId }) as Promise<RunsGetResult>,
    ]);
    if (typeof result.lastSeq !== "number") {
      throw new Error("runs.get: missing lastSeq — the T-1103 server handlers must send it (contract.ts)");
    }
    const reducer = createRunDetailReducer(
      wireRunToDetail(result.run, result.turns, names.get(result.run.loopId) ?? result.run.loopId),
    );
    onUpdate(reducer.detail);

    let maxSeq = result.lastSeq;
    const handler = (eventRunId: string, seq: number, raw: WireEventPayload): void => {
      if (eventRunId !== runId || seq <= maxSeq) return;
      maxSeq = seq;
      if (!isWireRunEvent(raw)) return; // malformed: skip, keep watching
      onUpdate(reducer.apply(raw as RunEvent));
    };
    this.#rpc.onEvent = handler;
    // Server-side subscriptions die with the connection: after a reconnect
    // re-subscribe from the last applied seq. The replay that follows is
    // seq-filtered at maxSeq, so catch-up never doubles.
    const onState = (state: "connecting" | "open" | "closed"): void => {
      if (state !== "open") return;
      void this.#rpc
        .request(RPC.runsSubscribe, { id: runId, sinceSeq: maxSeq })
        .catch(() => {
          // A failed re-subscribe surfaces on the next live event gap; the
          // route's reload is the user-visible recovery. Never throw here.
        });
    };
    this.#rpc.onStateChange = onState;
    try {
      await this.#rpc.request(RPC.runsSubscribe, { id: runId, sinceSeq: result.lastSeq });
    } catch (error) {
      if (this.#rpc.onEvent === handler) this.#rpc.onEvent = undefined;
      if (this.#rpc.onStateChange === onState) this.#rpc.onStateChange = undefined;
      throw error;
    }
    return () => {
      if (this.#rpc.onEvent === handler) this.#rpc.onEvent = undefined;
      if (this.#rpc.onStateChange === onState) this.#rpc.onStateChange = undefined;
      // Client-local unsubscribe (no server-side unsub RPC exists); the
      // server-side fan-out ends with the connection.
      this.#rpc.unsubscribe(runId);
    };
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

  getLoop(_id: string): Promise<EditorLoopRecord> {
    return Promise.resolve({ id: _id, name: demoEditorConfig.name, version: 3, config: demoEditorConfig });
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
