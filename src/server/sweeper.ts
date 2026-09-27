/**
 * M6 stale-sweeper — the consumer of T-504's `Runner.markStale` (PR #106).
 *
 * What it does: watches the orchestrator's publish rail (every run event
 * passes through it), remembers the last event time per run, and on each
 * `sweep()` marks `stale` every **active** run that has been silent longer
 * than `staleAfterMs` (default 5 minutes — a streaming brain that says
 * nothing for that long is hung, not thinking).
 *
 * Deliberate scope lines (official AgentSessionStatus semantics):
 * - Only `active` runs are sweepable. An `awaitingInput` run is parked on a
 *   USER answer and a `waiting` run is held by the QUEUE — silence there is
 *   by design, never unresponsiveness.
 * - A run first seen by the sweeper (e.g. right after boot) gets a full
 *   `staleAfterMs` grace period — the sweeper's clock starts at first
 *   sight, not at the run's birth.
 * - `markStale` itself (T-504) handles the rest: immediate terminal land,
 *   dangling turn closed, dead exchange epoch-fenced, `continueRun` revive
 *   available. The #119 lifetime watch does the terminal bookkeeping
 *   (queue slot freed, cost delta recorded, no write-back for stale).
 * - A run that reaches a terminal state between `activeRunIds()` and
 *   `markStale()` simply wins the race: the sweep catches the
 *   IllegalRunTransitionError and moves on.
 *
 * Wiring (compose.ts): `publish: sweeper.trackPublish(createRunEventPublisher(channel))`.
 * Driving (start.ts): the same 30s interval that ticks the scheduler.
 *
 * Original code.
 */

import { IllegalRunTransitionError } from "../runtime/run-machine.ts";
import type { Runner } from "../runtime/runner.ts";
import type { EntityId, RunEvent } from "../runtime/types.ts";

export interface RunSweeperOptions {
  runner: Runner;
  /** Silence threshold for an active run before it is marked stale. Default 300_000 (5 min). */
  staleAfterMs?: number | undefined;
  /** Clock — injectable for deterministic tests. Defaults to real time. */
  now?: (() => Date) | undefined;
  /** Audit hook, called once per run actually marked stale. */
  onMark?: ((runId: EntityId, silentMs: number) => void) | undefined;
}

export interface RunSweeper {
  /**
   * Wrap a publish sink so every run event also freshens the sweeper's
   * last-event clock for that run. Pass-through: the wrapped sink's
   * behavior is unchanged.
   */
  trackPublish(publish: (runId: EntityId, event: RunEvent) => void): (runId: EntityId, event: RunEvent) => void;
  /**
   * One sweep: mark every active run silent past the threshold stale.
   * Returns the ids it marked (empty when all is well). Never throws.
   */
  sweep(): EntityId[];
  /** Last time the sweeper saw an event for a run (test/diagnostic seam). */
  lastEventAt(runId: EntityId): Date | null;
}

const DEFAULT_STALE_AFTER_MS = 300_000;

export function createRunSweeper(options: RunSweeperOptions): RunSweeper {
  const runner = options.runner;
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const now = options.now ?? (() => new Date());
  const lastEvent = new Map<EntityId, number>();

  return {
    trackPublish(publish) {
      return (runId, event) => {
        lastEvent.set(runId, now().getTime());
        publish(runId, event);
      };
    },

    sweep() {
      const marked: EntityId[] = [];
      const moment = now().getTime();
      const live = new Set<EntityId>();
      for (const runId of runner.activeRunIds()) {
        live.add(runId);
        const run = runner.getRun(runId);
        if (run.status !== "active") continue; // parked/queued silence is by design
        let seen = lastEvent.get(runId);
        if (seen === undefined) {
          // First sight: grace, never an instant mark (e.g. sweeper boot).
          seen = moment;
          lastEvent.set(runId, seen);
          continue;
        }
        if (moment - seen <= staleAfterMs) continue;
        try {
          runner.markStale(runId);
          lastEvent.delete(runId);
          options.onMark?.(runId, moment - seen);
          marked.push(runId);
        } catch (error) {
          if (error instanceof IllegalRunTransitionError) continue; // the run finished first — good
          throw error;
        }
      }
      // Prune clock entries for runs that left the live set (terminal/restored away).
      for (const runId of [...lastEvent.keys()]) {
        if (!live.has(runId)) lastEvent.delete(runId);
      }
      return marked;
    },

    lastEventAt(runId) {
      const t = lastEvent.get(runId);
      return t === undefined ? null : new Date(t);
    },
  };
}
