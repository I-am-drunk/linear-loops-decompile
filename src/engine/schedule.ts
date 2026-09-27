/**
 * Schedule evaluation: when a loop (or standalone cron job) fires.
 *
 * Linear's verified behavior (agent-04@E1 corpus extract, hub #21 23:12:40Z):
 * missed runs COLLAPSE — after downtime the schedule jumps forward
 * (ceil(diff/interval)); the missed occurrences are never replayed one by one.
 * We expose that as two misfire policies:
 * - `skip` (default, matches Linear): missed occurrences never fire; the
 *   schedule jumps to the first future occurrence.
 * - `catchUp`: exactly ONE make-up run fires immediately for the LATEST missed
 *   occurrence; earlier misses still collapse (no replay storm).
 */

import { nextOccurrence, parseRRule, type RRule } from "./rrule.ts";
import { isValidTimeZone } from "./tz.ts";

export type MisfirePolicy = "skip" | "catchUp";

/**
 * One schedulable entry (a schedule-triggered loop or a WorkflowCronJob).
 * `anchor` is the phase reference for INTERVAL grids — the loop's
 * publishedAt/createdAt — so schedules are restart-stable.
 */
export interface ScheduleEntry {
  id: string;
  rrule: string;
  timezone: string;
  anchor: Date;
  enabled: boolean;
  misfire?: MisfirePolicy | undefined;
}

export type FireKind = "onTime" | "catchUp";

export interface DueDecision {
  entryId: string;
  /** The occurrence this fire is for (== now-ish for onTime, the latest missed one for catchUp). */
  scheduledAt: Date;
  kind: FireKind;
}

export interface Evaluation {
  /** Set when the entry should fire at `now`. */
  due: DueDecision | null;
  /** First occurrence strictly after the decision point; null when exhausted. */
  nextAt: Date | null;
  /**
   * When a misfire is skipped, the waterline to persist as lastFired so the
   * misses are never reconsidered (the "catch-up jump"). Null otherwise.
   */
  advanceTo: Date | null;
}

const ruleCache = new Map<string, RRule>();

export function compile(entry: Pick<ScheduleEntry, "rrule" | "timezone">): RRule {
  const key = `${entry.timezone}	${entry.rrule}`;
  let rule = ruleCache.get(key);
  if (!rule) {
    if (!isValidTimeZone(entry.timezone)) {
      throw new Error(`unknown IANA timezone: "${entry.timezone}"`);
    }
    rule = parseRRule(entry.rrule);
    ruleCache.set(key, rule);
  }
  return rule;
}

/** First fire time strictly after `after`; null when the rule is exhausted. */
export function nextFireAfter(entry: ScheduleEntry, after: Date): Date | null {
  if (!entry.enabled) return null;
  return nextOccurrence(compile(entry), entry.timezone, entry.anchor, after);
}

/**
 * Evaluate one entry at `now`, given the last occurrence it fired for
 * (null = never fired). Pure — persistence lives with the caller
 * (ScheduleRegistry + a store; the server owns the table).
 */
export function evaluate(entry: ScheduleEntry, now: Date, lastFired: Date | null): Evaluation {
  const none: Evaluation = { due: null, nextAt: null, advanceTo: null };
  if (!entry.enabled) return none;
  const rule = compile(entry);
  const base = lastFired ?? new Date(entry.anchor.getTime() - 1);
  const next = nextOccurrence(rule, entry.timezone, entry.anchor, base);
  if (next === null) return none; // exhausted (COUNT/UNTIL)
  if (next.getTime() > now.getTime()) return { due: null, nextAt: next, advanceTo: null };

  // `next` is due. Did we also miss further occurrences between next and now?
  const latest = latestOccurrenceUpTo(rule, entry, now, next);
  if (latest.getTime() === next.getTime()) {
    return {
      due: { entryId: entry.id, scheduledAt: next, kind: "onTime" },
      nextAt: nextOccurrence(rule, entry.timezone, entry.anchor, next),
      advanceTo: null,
    };
  }
  // Misfire (server was down for ≥1 interval).
  if ((entry.misfire ?? "skip") === "catchUp") {
    return {
      due: { entryId: entry.id, scheduledAt: latest, kind: "catchUp" },
      nextAt: nextOccurrence(rule, entry.timezone, entry.anchor, latest),
      advanceTo: null,
    };
  }
  // skip (Linear's collapse): fire nothing, jump the waterline past the misses.
  return {
    due: null,
    nextAt: nextOccurrence(rule, entry.timezone, entry.anchor, latest),
    advanceTo: latest,
  };
}

/** The latest occurrence at-or-before `now`, walking forward from `startFrom`. */
function latestOccurrenceUpTo(rule: RRule, entry: ScheduleEntry, now: Date, startFrom: Date): Date {
  let latest = startFrom;
  for (let i = 0; i < 200_000; i++) {
    const n = nextOccurrence(rule, entry.timezone, entry.anchor, latest);
    if (n === null || n.getTime() > now.getTime()) return latest;
    latest = n;
  }
  throw new Error("misfire gap too large to collapse safely");
}
