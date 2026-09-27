/**
 * Orchestrator — the M5 run seam. Wires the landed packages into one loop
 * on the T-1101 composition root:
 *
 *   engine (R4): registry tick / evaluateTrigger → RunRequest
 *   → queue (R4): capacity, budgets, in-flight idempotency
 *   → store (T-1101): claimRunKey — the durable idempotency rail
 *   → runtime (R5): assembleContext → runner.start with a brain
 *   → brain (R6): injected per loop (HarnessBrain over the user's harness)
 *   → write-back (R3): a completed run's response becomes a Linear comment
 *   → connect (R9): every run event is republished to UI subscribers
 *
 * Everything cross-package is an injected seam (structural, zero new deps):
 * - `brainFor`   — the composition root binds R6 (see HarnessBrain, T-1201);
 * - `reader`     — the runtime's EntityReader; T-304's DataplaneEntityReader
 *                  satisfies it, a fixture does in tests;
 * - `writeBack`  — a comment sink; `commentWriteBack` below adapts the
 *                  dataplane's createComment without importing it;
 * - `publish`    — ChannelServer.publishRunEvent (R9), optional.
 *
 * Failure rules (settled across the landed packages, honored here):
 * - EntityReader errors PROPAGATE out of assembleContext — the run is
 *   dropped BEFORE creation, the failure lands in the audit log
 *   (`run.status` / phase "assemble"), and the pump continues with the next
 *   run. One broken loop never stalls the batch.
 * - Write-back failures never un-complete a run: the run stays `complete`,
 *   the failure is audited (`linear.write`, ok:false). M6 owns richer
 *   surfaces; the append-only audit log is the M5 source of truth.
 * - Idempotency is two rails, both honored: the queue dedups in-flight
 *   runs; `store.claimRunKey` dedups durably across restarts. A lost claim
 *   leaves the queue slot freed and an audit row behind.
 *
 * Original code. PLAN.md M5 + SPECS/agent.md §runtime-contract are the
 * behavior sources.
 */

import type { Store, LoopRow } from "./store.ts";
import { persistRun } from "./persistence.ts";
import type { Runner } from "../runtime/runner.ts";
import type { Brain } from "../runtime/brain.ts";
import { assembleContext, type EntityReader } from "../runtime/context.ts";
import type { EntityId, Run, RunEvent, RunStatus, RunTarget, Turn } from "../runtime/types.ts";
import type { RunQueue, QueuedRun, RunRequest } from "../engine/queue.ts";
import type { ScheduleRegistry } from "../engine/registry.ts";
import { loopToEntry } from "../engine/adapters.ts";
import { evaluateTrigger, type EntityEvent } from "../engine/trigger.ts";
import type { LoopConfig, WorkflowDefinition } from "../model/loop.ts";

// ---------------------------------------------------------------------------
// Seams
// ---------------------------------------------------------------------------

/** What the orchestrator needs from a loop's config + row, engine-ready. */
export function definitionFor(row: LoopRow): WorkflowDefinition | null {
  let config: LoopConfig;
  try {
    // Zod-validated at write time (Store.saveLoop) — the cast is honest.
    config = JSON.parse(row.configJson) as LoopConfig;
  } catch {
    return null;
  }
  return {
    ...config,
    id: row.id,
    slugId: row.id,
    ownerId: "",
    stats: { totalRuns: 0, completedRuns: 0, failedRuns: 0, totalCostUsd: 0 },
    // The ROW toggle is the live one (Store.setLoopEnabled touches only the
    // row); the config's own `enabled` is the value at last publish.
    enabled: row.enabled,
    version: row.version,
    // saveLoop bumps updatedAt on every publish — that is the re-phasing
    // anchor loopToEntry expects from publishedAt.
    publishedAt: row.updatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface WriteBackInput {
  run: Run;
  loop: WorkflowDefinition;
  /** Concatenated `response` parts of the run's agent turns (summary fallback). */
  responseText: string;
  /** Always an issue target — checked before the sink is called. */
  target: RunTarget;
}

export interface WriteBackResult {
  commentId: string;
  url?: string | null | undefined;
  deduplicated: boolean;
}

/** The dataplane write seam. Injected; see `commentWriteBack` for the adapter. */
export type WriteBackSink = (input: WriteBackInput) => Promise<WriteBackResult>;

/**
 * Structural mirror of the dataplane's keyed createComment (T-303,
 * src/dataplane/writes.ts) — the composition root binds the real one with a
 * one-line closure; zero imports from src/dataplane here.
 */
export interface CommentWriter {
  createComment(input: {
    issueId: string;
    body: string;
    idempotencyKey: string;
  }): Promise<{ id: string; url?: string | null | undefined; deduplicated: boolean }>;
}

/**
 * Adapt a keyed comment writer into the WriteBackSink. The idempotency key
 * is `run:<runId>:comment` — a re-driven (restored, then re-completed) run
 * dedupes against the marker the dataplane embeds, never double-posting.
 */
export function commentWriteBack(writer: CommentWriter): WriteBackSink {
  return async ({ run, responseText, target }) => {
    const result = await writer.createComment({
      issueId: target.id,
      body: responseText,
      idempotencyKey: `run:${run.id}:comment`,
    });
    return { commentId: result.id, url: result.url, deduplicated: result.deduplicated };
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface OrchestratorDeps {
  store: Store;
  runner: Runner;
  queue: RunQueue;
  registry: ScheduleRegistry;
  /** Per-loop brain factory — the composition root binds R6's harness here. */
  brainFor: (loop: WorkflowDefinition) => Brain;
  /** Runtime EntityReader seam (T-304 over the real dataplane). */
  reader?: EntityReader | undefined;
  /** Linear write-back seam (comments on completed runs). */
  writeBack?: WriteBackSink | undefined;
  /** UI fan-out — ChannelServer.publishRunEvent. */
  publish?: ((runId: string, event: RunEvent) => void) | undefined;
  now?: (() => Date) | undefined;
}

export interface ReloadResult {
  scheduled: number;
  event: number;
  chat: number;
}

export interface TickResult {
  /** Scheduler fires observed this tick. */
  fired: number;
  /** Newly enqueued requests (fires minus in-flight duplicates). */
  enqueued: number;
  /** Run ids actually started (runner.start returned). */
  started: EntityId[];
}

export interface EventResult {
  /** Enabled event/chat loops the event was evaluated against. */
  evaluated: number;
  /** Loop ids whose trigger fired. */
  fired: EntityId[];
  /** Per-loop reasons from the trigger evaluator (fired or not). */
  reasons: Record<string, string[]>;
  started: EntityId[];
}

export interface RequestResult {
  outcome: "started" | "queued" | "duplicate" | "dropped";
  runId?: EntityId | undefined;
}

export interface Orchestrator {
  /**
   * (Re)load loops from the store into the schedule registry. Call at boot
   * and after every loop write (the channel's loop RPCs hook this). Event
   * and chat triggers are re-read from the store per handleEvent call, so
   * they need no registry maintenance.
   */
  reloadLoops(): ReloadResult;
  /** Drive the scheduler once. */
  tick(now?: Date): Promise<TickResult>;
  /** Evaluate one dataplane event (webhook delivery or poll diff) against
   *  every enabled event/chat loop. */
  handleEvent(event: EntityEvent): Promise<EventResult>;
  /** Manual / chat entry point (UI "run now", chat wakes). */
  requestRun(req: RunRequest): Promise<RequestResult>;
  /** Start as many waiting runs as capacity allows; returns started ids. */
  pump(): Promise<EntityId[]>;
  /** Await every in-flight start/write-back (tests + shutdown drain). */
  flush(): Promise<void>;
}

const TERMINAL: ReadonlySet<RunStatus> = new Set(["complete", "error", "canceled", "stale"]);

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  const { store, runner, queue, registry, brainFor } = deps;
  const now = deps.now ?? (() => new Date());
  const pending = new Set<Promise<void>>();

  function track(p: Promise<void>): void {
    pending.add(p);
    void p.finally(() => pending.delete(p));
  }

  function enabledDefinitions(): WorkflowDefinition[] {
    const defs: WorkflowDefinition[] = [];
    for (const row of store.listLoops()) {
      const def = definitionFor(row);
      if (def !== null && def.enabled) defs.push(def);
    }
    return defs;
  }

  /** Runs already recorded for a loop (durable, restart-safe) → next iteration. */
  function nextIteration(loopId: EntityId): number {
    return store.listAudit({ loopId }).filter((row) => row["kind"] === "run.created").length + 1;
  }

  function attachRunWatch(runId: EntityId, loop: WorkflowDefinition): void {
    // The watch lives for the run's whole lifetime — `complete` is
    // CONTINUABLE (SPECS/agent.md §continuation), and an off()-at-terminal
    // watch silently drops every event of a continued run (found by the
    // T-1103 acceptance test: runs.continue over the channel streamed
    // nothing). Cost is recorded as a DELTA so a re-completed run never
    // double-counts its cumulative usage against the budget.
    let recordedCost = 0;
    runner.subscribe(runId, (event: RunEvent) => {
      deps.publish?.(runId, event);
      if (event.type === "runStatus" && TERMINAL.has(event.status)) {
        queue.markFinished(runId);
        const cost = event.run.usage.costUsd;
        queue.recordCost(loop.id, Math.max(0, cost - recordedCost), now());
        recordedCost = cost;
        if (event.status === "complete") track(writeBackFor(runId, loop));
      }
    });
  }

  async function writeBackFor(runId: EntityId, loop: WorkflowDefinition): Promise<void> {
    if (deps.writeBack === undefined) return;
    if (!loop.activities.includes("comment")) return;
    const run = runner.getRun(runId);
    const target = run.target;
    // Comments land on issues; other targets keep their output in the run record.
    if (target === undefined || target.entity !== "issue") return;
    const text = responseText(runner.getTurns(runId)) ?? run.summary ?? "";
    if (text.trim() === "") {
      store.appendAudit("linear.write", {
        loopId: loop.id,
        runId,
        detail: { ok: false, skipped: true, error: "run produced no response text" },
      });
      return;
    }
    try {
      const result = await deps.writeBack({ run, loop, responseText: text, target });
      store.appendAudit("linear.write", {
        loopId: loop.id,
        runId,
        detail: { ok: true, commentId: result.commentId, url: result.url ?? null, deduplicated: result.deduplicated },
      });
    } catch (error) {
      store.appendAudit("linear.write", {
        loopId: loop.id,
        runId,
        detail: { ok: false, error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /** One queued run's journey to the runtime. Never throws (per-run isolation). */
  async function startQueued(qr: QueuedRun): Promise<EntityId | null> {
    const row = store.getLoop(qr.loopId);
    const def = row === null ? null : definitionFor(row);
    if (def === null || !def.enabled) {
      queue.markFinished(qr.id);
      store.appendAudit("run.status", {
        loopId: qr.loopId,
        runId: qr.id,
        detail: { status: "dropped", reason: "loop missing or disabled at start time" },
      });
      return null;
    }
    // The durable idempotency rail — second rail after the queue's in-flight dedupe.
    if (!store.claimRunKey(qr.idempotencyKey, qr.id)) {
      queue.markFinished(qr.id);
      store.appendAudit("run.status", {
        loopId: def.id,
        runId: qr.id,
        detail: { status: "dropped", reason: "duplicate trigger (durable idempotency rail)" },
      });
      return null;
    }
    const target: RunTarget | undefined =
      qr.target === undefined ? undefined : { entity: qr.target.entityType, id: qr.target.entityId };
    try {
      const { message } = await assembleContext({
        prompt: def.prompt,
        target,
        reader: deps.reader,
        loopName: def.name,
      });
      const run = runner.start({
        loopId: def.id,
        message,
        brain: brainFor(def),
        target,
        runId: qr.id,
        iteration: nextIteration(def.id),
      });
      persistRun(runner, store, run.id);
      attachRunWatch(run.id, def);
      return run.id;
    } catch (error) {
      // EntityReader contract: dataplane errors fail the run VISIBLY. The run
      // never existed here, so the audit log is the visible surface.
      queue.markFinished(qr.id);
      store.appendAudit("run.status", {
        loopId: def.id,
        runId: qr.id,
        detail: {
          status: "error",
          phase: "assemble",
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return null;
    }
  }

  async function pump(): Promise<EntityId[]> {
    const started: EntityId[] = [];
    for (const qr of queue.startNext(now())) {
      const runId = await startQueued(qr);
      if (runId !== null) started.push(runId);
    }
    return started;
  }

  function enqueueRequest(req: RunRequest): { enqueued: boolean; runId?: EntityId | undefined } {
    const result = queue.enqueue(req);
    if (result.outcome === "duplicate") return { enqueued: false, runId: result.existingRunId };
    return { enqueued: true, runId: result.run.id };
  }

  return {
    reloadLoops(): ReloadResult {
      const counts: ReloadResult = { scheduled: 0, event: 0, chat: 0 };
      const liveEntryIds = new Set<string>();
      for (const row of store.listLoops()) {
        const def = definitionFor(row);
        if (def === null || !def.enabled) continue;
        const entry = loopToEntry(def);
        if (entry !== null) {
          registry.upsert(entry);
          liveEntryIds.add(entry.id);
          counts.scheduled += 1;
        } else if (def.trigger.type === "event") {
          counts.event += 1;
        } else if (def.trigger.type === "chat") {
          counts.chat += 1;
        }
      }
      // Disabled/removed loops leave the registry (their waterline survives
      // in the registry's store — re-enabling resumes, never replays).
      for (const entry of registry.list()) {
        if (entry.id.startsWith("loop:") && !liveEntryIds.has(entry.id)) registry.remove(entry.id);
      }
      return counts;
    },

    async tick(at?: Date): Promise<TickResult> {
      const moment = at ?? now();
      const due = registry.tick(moment);
      let enqueued = 0;
      for (const fire of due) {
        if (!fire.entryId.startsWith("loop:")) continue;
        const { enqueued: ok } = enqueueRequest({
          loopId: fire.entryId.slice("loop:".length),
          kind: "scheduled",
          requestedAt: moment.toISOString(),
          scheduledAt: fire.scheduledAt.toISOString(),
        });
        if (ok) enqueued += 1;
      }
      const started = await pump();
      return { fired: due.length, enqueued, started };
    },

    async handleEvent(event: EntityEvent): Promise<EventResult> {
      const fired: EntityId[] = [];
      const reasons: Record<string, string[]> = {};
      let evaluated = 0;
      for (const def of enabledDefinitions()) {
        if (def.trigger.type === "schedule") continue;
        evaluated += 1;
        const decision = evaluateTrigger(def, event);
        reasons[def.id] = decision.reasons;
        if (!decision.fire || decision.execution === undefined) continue;
        fired.push(def.id);
        enqueueRequest({
          loopId: def.id,
          kind: "event",
          requestedAt: now().toISOString(),
          triggerEventId: decision.execution.triggerEventId,
          target: decision.execution.target,
        });
      }
      const started = await pump();
      return { evaluated, fired, reasons, started };
    },

    async requestRun(req: RunRequest): Promise<RequestResult> {
      const { enqueued, runId } = enqueueRequest(req);
      if (!enqueued) return { outcome: "duplicate", runId };
      const started = await pump();
      if (runId !== undefined && started.includes(runId)) return { outcome: "started", runId };
      // Waiting behind capacity, or dropped by a start-time gate (audit has why).
      const waiting = runId !== undefined && queue.list().some((q) => q.id === runId);
      return { outcome: waiting ? "queued" : "dropped", runId };
    },

    pump,

    async flush(): Promise<void> {
      while (pending.size > 0) await Promise.all([...pending]);
    },
  };
}

/** Concatenated `response` parts across the run's agent turns, oldest first. */
export function responseText(turns: readonly Turn[]): string | null {
  const chunks: string[] = [];
  for (const turn of turns) {
    if (turn.role !== "agent") continue;
    for (const part of turn.parts) {
      if (part.kind === "response" && part.text.trim() !== "") chunks.push(part.text.trim());
    }
  }
  return chunks.length === 0 ? null : chunks.join("\n\n");
}
