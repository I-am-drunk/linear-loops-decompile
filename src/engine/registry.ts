/**
 * ScheduleRegistry — the ticking surface the server drives.
 *
 * In-memory entries + an injectable store for the fire waterline
 * (`lastFiredAt` per entry). The server (T-1101) persists waterlines in
 * SQLite so restarts don't shift or replay schedules; the run queue (T-403)
 * consumes `tick()` output.
 */

import { compile, evaluate, type DueDecision, type ScheduleEntry } from "./schedule.ts";

export interface ScheduleStore {
  getLastFired(entryId: string): Date | null;
  setLastFired(entryId: string, at: Date): void;
}

/** Volatile store — tests and the pre-persistence skeleton. */
export class MemoryScheduleStore implements ScheduleStore {
  private readonly water = new Map<string, Date>();
  getLastFired(entryId: string): Date | null {
    return this.water.get(entryId) ?? null;
  }
  setLastFired(entryId: string, at: Date): void {
    this.water.set(entryId, at);
  }
}

export class ScheduleRegistry {
  private readonly entries = new Map<string, ScheduleEntry>();
  private readonly store: ScheduleStore;

  constructor(store: ScheduleStore = new MemoryScheduleStore()) {
    this.store = store;
  }

  /** Insert or replace. Parse/zone errors throw here (fail at write time, not at 3am). */
  upsert(entry: ScheduleEntry): void {
    compile(entry); // validates rrule + timezone
    this.entries.set(entry.id, entry);
  }

  remove(entryId: string): void {
    this.entries.delete(entryId);
  }

  get(entryId: string): ScheduleEntry | null {
    return this.entries.get(entryId) ?? null;
  }

  list(): ScheduleEntry[] {
    return [...this.entries.values()];
  }

  /**
   * Evaluate every entry at `now`; returns the fires due, and records them
   * (waterline advances to each fire's scheduledAt, or past collapsed misses
   * for the skip policy). Idempotent: re-ticking the same `now` fires nothing
   * twice.
   */
  tick(now: Date): DueDecision[] {
    const due: DueDecision[] = [];
    for (const entry of this.entries.values()) {
      const ev = evaluate(entry, now, this.store.getLastFired(entry.id));
      if (ev.due) {
        this.store.setLastFired(entry.id, ev.due.scheduledAt);
        due.push(ev.due);
      } else if (ev.advanceTo) {
        this.store.setLastFired(entry.id, ev.advanceTo);
      }
    }
    return due;
  }

  /** When this entry next fires (for UI "next run" hints); null if never/exhausted. */
  nextDue(entryId: string, now: Date): Date | null {
    const entry = this.entries.get(entryId);
    if (!entry) return null;
    const ev = evaluate(entry, now, this.store.getLastFired(entryId));
    if (ev.due) return ev.due.scheduledAt;
    return ev.nextAt;
  }
}
