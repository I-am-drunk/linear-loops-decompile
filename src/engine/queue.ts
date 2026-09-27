/**
 * Run queue (T-403) — concurrency limits, budgets, idempotency.
 *
 * Consumes scheduler fires (T-401) and trigger decisions (T-402); hands runs
 * to the runtime (R5) when capacity allows. The queue's `waiting` state maps
 * to the model's RunStatus "waiting" (queue-held, not yet picked up).
 *
 * Idempotency (SPECS/target-architecture.md §safety-rails; LoopExecution's
 * key is hash(loopId, triggerEventId)):
 * - event runs:      `evt:{loopId}:{triggerEventId}` — a duplicated webhook
 *                    delivery or poll re-observation never double-runs.
 * - scheduled runs:  `sched:{loopId}:{scheduledAt}` — a tick replayed after a
 *                    restart never double-enqueues the same occurrence.
 * - manual/continuation runs: caller may pass a key; otherwise minted fresh.
 *
 * Scope note: the queue dedups IN-FLIGHT runs. Durable dedup across restarts
 * and completed runs belongs to the executions table (the server rejects a
 * triggerEventId that already has a LoopExecution row, T-1101) — the queue's
 * key is exactly the value to store there.
 *
 * Budgets: per-loop runs-per-hour and USD-per-day (UTC day buckets) gates
 * sit at START time, not enqueue time — a queued run waits rather than dies
 * when its loop is over budget.
 */

import type { EntityId, LoopRunTarget } from "../model/index.ts";
import { createHash, randomUUID } from "node:crypto";

export type RunKind = "scheduled" | "event" | "manual" | "continuation";

export interface RunRequest {
  loopId: EntityId;
  kind: RunKind;
  requestedAt: string; // ISO
  /** From the trigger decision (event runs). */
  triggerEventId?: string | undefined;
  /** From the scheduler fire (scheduled runs). */
  scheduledAt?: string | undefined;
  target?: LoopRunTarget | undefined;
  /** Continuation: the execution this run follows up on. */
  continuedFromExecutionId?: EntityId | undefined;
  /** Optional caller-supplied idempotency key (overrides the computed one). */
  idempotencyKey?: string | undefined;
}

export type QueuedRunState = "waiting" | "active";

export interface QueuedRun extends RunRequest {
  id: EntityId;
  idempotencyKey: string;
  state: QueuedRunState;
  startedAt?: string | undefined;
}

export interface RunQueueOptions {
  /** Max simultaneously active runs of one loop. Default 1. */
  maxConcurrentPerLoop?: number | undefined;
  /** Max simultaneously active runs across all loops. Default 8. */
  maxConcurrentTotal?: number | undefined;
  /** Max starts per loop per trailing hour. Default 60. */
  maxRunsPerLoopPerHour?: number | undefined;
  /** Max spend per loop per UTC day; runs wait when exceeded. Undefined = no cap. */
  maxCostPerLoopPerDayUsd?: number | undefined;
}

export type EnqueueResult =
  | { outcome: "queued"; run: QueuedRun }
  | { outcome: "duplicate"; existingRunId: EntityId };

/** Restart-safety seam — the server (T-1101) implements this over SQLite. */
export interface RunQueueStore {
  getByKey(key: string): QueuedRun | null;
  put(run: QueuedRun): void;
  update(run: QueuedRun): void;
  /** Finished/canceled runs leave the queue; their terminal state is the
   *  runtime's run record (R5/T-1101), not queue state. */
  remove(runId: EntityId): void;
  all(): QueuedRun[];
}

export class MemoryRunQueueStore implements RunQueueStore {
  private readonly runs = new Map<EntityId, QueuedRun>();
  private readonly byKey = new Map<string, EntityId>();
  getByKey(key: string): QueuedRun | null {
    const id = this.byKey.get(key);
    return id ? this.runs.get(id) ?? null : null;
  }
  put(run: QueuedRun): void {
    this.runs.set(run.id, run);
    this.byKey.set(run.idempotencyKey, run.id);
  }
  update(run: QueuedRun): void {
    this.runs.set(run.id, run);
  }
  remove(runId: EntityId): void {
    const run = this.runs.get(runId);
    if (!run) return;
    this.byKey.delete(run.idempotencyKey);
    this.runs.delete(runId);
  }
  all(): QueuedRun[] {
    return [...this.runs.values()];
  }
}

export function idempotencyKeyFor(req: RunRequest): string {
  if (req.idempotencyKey) return req.idempotencyKey;
  const raw = req.kind === "event" && req.triggerEventId
    ? `evt:${req.loopId}:${req.triggerEventId}`
    : req.kind === "scheduled" && req.scheduledAt
      ? `sched:${req.loopId}:${req.scheduledAt}`
      : `gen:${req.loopId}:${randomUUID()}`;
  // Readable prefix + short hash keeps keys debuggable and bounded in length.
  const digest = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return `${raw.split(":").slice(0, 2).join(":")}:${digest}`;
}

export class RunQueue {
  private readonly maxPerLoop: number;
  private readonly maxTotal: number;
  private readonly maxStartsPerHour: number;
  private readonly maxCostPerDay: number | undefined;
  private readonly starts = new Map<EntityId, number[]>(); // loopId → start timestamps (ms)
  private readonly costByDay = new Map<string, number>(); // `${loopId}:${yyyy-mm-dd}` → usd
  private readonly store: RunQueueStore;
  private readonly newId: () => string;
  private accepting = true;

  constructor(
    store: RunQueueStore = new MemoryRunQueueStore(),
    options: RunQueueOptions = {},
    newId: () => string = () => randomUUID(),
  ) {
    this.store = store;
    this.newId = newId;
    this.maxPerLoop = options.maxConcurrentPerLoop ?? 1;
    this.maxTotal = options.maxConcurrentTotal ?? 8;
    this.maxStartsPerHour = options.maxRunsPerLoopPerHour ?? 60;
    this.maxCostPerDay = options.maxCostPerLoopPerDayUsd;
  }

  /** Stop starting new runs (shutdown drain). Waiting runs stay queued. */
  drain(): void {
    this.accepting = false;
  }
  resume(): void {
    this.accepting = true;
  }

  enqueue(req: RunRequest): EnqueueResult {
    const idempotencyKey = idempotencyKeyFor(req);
    const existing = this.store.getByKey(idempotencyKey);
    if (existing) return { outcome: "duplicate", existingRunId: existing.id };
    const run: QueuedRun = { ...req, id: this.newId(), idempotencyKey, state: "waiting" };
    this.store.put(run);
    return { outcome: "queued", run };
  }

  /**
   * Start as many waiting runs as capacity allows (FIFO per loop, then by
   * request time). Returns the runs to hand to the runtime — each moves to
   * `active`. Over-budget loops are skipped, not dropped.
   */
  startNext(now: Date): QueuedRun[] {
    if (!this.accepting) return [];
    const waiting = this.store.all()
      .filter((r) => r.state === "waiting")
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
    const started: QueuedRun[] = [];
    for (const run of waiting) {
      if (this.activeCount() >= this.maxTotal) break;
      if (this.activeCountFor(run.loopId) >= this.maxPerLoop) continue;
      if (!this.withinBudget(run.loopId, now)) continue;
      const active: QueuedRun = { ...run, state: "active", startedAt: now.toISOString() };
      this.store.update(active);
      this.recordStart(run.loopId, now);
      started.push(active);
    }
    return started;
  }

  /** The runtime reports a terminal state — the run leaves the queue, freeing its slot. */
  markFinished(runId: EntityId): void {
    this.store.remove(runId);
  }

  /** Cancel a waiting run. Active runs are the runtime's business (cooperative cancel). */
  cancel(runId: EntityId): boolean {
    const run = this.store.all().find((r) => r.id === runId);
    if (!run || run.state !== "waiting") return false;
    this.store.remove(runId);
    return true;
  }

  /** R6's usage counters feed loop spend here. */
  recordCost(loopId: EntityId, costUsd: number, at: Date): void {
    const key = `${loopId}:${at.toISOString().slice(0, 10)}`;
    this.costByDay.set(key, (this.costByDay.get(key) ?? 0) + costUsd);
  }

  list(): QueuedRun[] {
    return this.store.all();
  }

  private activeCount(): number {
    return this.store.all().filter((r) => r.state === "active").length;
  }
  private activeCountFor(loopId: EntityId): number {
    return this.store.all().filter((r) => r.state === "active" && r.loopId === loopId).length;
  }
  private recordStart(loopId: EntityId, now: Date): void {
    const arr = this.starts.get(loopId) ?? [];
    arr.push(now.getTime());
    this.starts.set(loopId, arr);
  }
  private withinBudget(loopId: EntityId, now: Date): boolean {
    const hourAgo = now.getTime() - 3_600_000;
    const recent = (this.starts.get(loopId) ?? []).filter((t) => t > hourAgo);
    this.starts.set(loopId, recent);
    if (recent.length >= this.maxStartsPerHour) return false;
    if (this.maxCostPerDay !== undefined) {
      const key = `${loopId}:${now.toISOString().slice(0, 10)}`;
      if ((this.costByDay.get(key) ?? 0) >= this.maxCostPerDay) return false;
    }
    return true;
  }
}
