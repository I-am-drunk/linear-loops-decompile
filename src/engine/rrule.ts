/**
 * Minimal RFC 5545 recurrence rules — parse + iterate.
 *
 * Scope decision (YAGNI, and mirrors what loop schedules actually need):
 * - FREQ (required): MINUTELY | HOURLY | DAILY | WEEKLY | MONTHLY
 * - INTERVAL ≥ 1 — phase-locked to the caller-provided anchor (like DTSTART),
 *   so a restart never shifts the schedule.
 * - BYDAY (MO..SU): expands the week for WEEKLY, filters days otherwise.
 *   Rejected for MONTHLY (ordinal semantics like "1st Monday" need BYSETPOS,
 *   which we deliberately do not build).
 * - BYHOUR (0–23) / BYMINUTE (0–59): expand times within the stepped unit.
 * - COUNT (total occurrences from the anchor) and UNTIL (inclusive end).
 * - Anything else (BYSETPOS, BYMONTH, WKST, RDATE, …) throws `RRuleError` —
 *   unknown parts fail loudly rather than silently mis-scheduling a loop.
 *
 * All iteration happens in the rule's timezone *wall clock*; candidates are
 * converted to UTC instants via ./tz.ts, and nonexistent wall times
 * (spring-forward gaps) are skipped.
 */

import {
  civilFromDays,
  daysFromCivil,
  daysInMonth,
  utcToWall,
  wallFromMinutes,
  wallMinutes,
  wallToUtc,
  weekdayMon0,
  type WallParts,
} from "./tz.ts";

export class RRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RRuleError";
  }
}

export const RRULE_FREQS = ["MINUTELY", "HOURLY", "DAILY", "WEEKLY", "MONTHLY"] as const;
export type RRuleFreq = (typeof RRULE_FREQS)[number];

export interface RRule {
  freq: RRuleFreq;
  interval: number;
  /** 0 = Monday … 6 = Sunday. */
  byDay?: number[] | undefined;
  byHour?: number[] | undefined; // 0–23
  byMinute?: number[] | undefined; // 0–59
  count?: number | undefined;
  /** Inclusive end instant (occurrences ≤ until fire). */
  until?: Date | undefined;
}

const BYDAY_CODES: Record<string, number> = {
  MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6,
};

function parseIntList(key: string, raw: string, min: number, max: number): number[] {
  const values = raw.split(",").map((s) => {
    const n = Number.parseInt(s, 10);
    if (!Number.isInteger(n) || String(n) !== s.trim() || n < min || n > max) {
      throw new RRuleError(`${key}: value "${s}" is not an integer in [${min}, ${max}]`);
    }
    return n;
  });
  return [...new Set(values)].sort((a, b) => a - b);
}

function parseUntil(raw: string): Date {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(raw);
  if (!m) throw new RRuleError(`UNTIL: "${raw}" is not YYYYMMDD[THHMMSS[Z]]`);
  const [, y, mo, d, h, mi, s] = m;
  // Date-only form ends the day (inclusive), per common cron usage.
  const ms = Date.UTC(
    Number(y), Number(mo) - 1, Number(d),
    h === undefined ? 23 : Number(h),
    mi === undefined ? 59 : Number(mi),
    s === undefined ? 59 : Number(s),
  );
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) throw new RRuleError(`UNTIL: "${raw}" is not a real date`);
  return date;
}

/** Parse an RRULE value string (`FREQ=WEEKLY;BYDAY=MO;BYHOUR=9`). Throws RRuleError. */
export function parseRRule(input: string): RRule {
  const rule: {
    freq?: RRuleFreq; interval: number;
    byDay?: number[]; byHour?: number[]; byMinute?: number[];
    count?: number; until?: Date;
  } = { interval: 1 };
  const seen = new Set<string>();
  for (const part of input.split(";")) {
    const eq = part.indexOf("=");
    const key = (eq === -1 ? part : part.slice(0, eq)).trim().toUpperCase();
    const value = eq === -1 ? "" : part.slice(eq + 1).trim();
    if (!key) throw new RRuleError(`empty rule part in "${input}"`);
    if (seen.has(key)) throw new RRuleError(`duplicate rule part: ${key}`);
    seen.add(key);
    switch (key) {
      case "FREQ": {
        if (!RRULE_FREQS.includes(value.toUpperCase() as RRuleFreq)) {
          throw new RRuleError(`FREQ: unsupported value "${value}"`);
        }
        rule.freq = value.toUpperCase() as RRuleFreq;
        break;
      }
      case "INTERVAL": {
        const n = Number.parseInt(value, 10);
        if (!Number.isInteger(n) || String(n) !== value || n < 1) {
          throw new RRuleError(`INTERVAL: "${value}" is not an integer ≥ 1`);
        }
        rule.interval = n;
        break;
      }
      case "BYDAY": {
        const days = value.split(",").map((s) => {
          const code = BYDAY_CODES[s.trim().toUpperCase()];
          if (code === undefined) throw new RRuleError(`BYDAY: unknown day code "${s}"`);
          return code;
        });
        rule.byDay = [...new Set(days)].sort((a, b) => a - b);
        break;
      }
      case "BYHOUR":
        rule.byHour = parseIntList("BYHOUR", value, 0, 23);
        break;
      case "BYMINUTE":
        rule.byMinute = parseIntList("BYMINUTE", value, 0, 59);
        break;
      case "COUNT": {
        const n = Number.parseInt(value, 10);
        if (!Number.isInteger(n) || String(n) !== value || n < 1) {
          throw new RRuleError(`COUNT: "${value}" is not an integer ≥ 1`);
        }
        rule.count = n;
        break;
      }
      case "UNTIL":
        rule.until = parseUntil(value);
        break;
      default:
        throw new RRuleError(`unsupported rule part: ${key} (fail-loud: we never silently mis-schedule)`);
    }
  }
  if (!rule.freq) throw new RRuleError("RRULE must declare FREQ");
  if (rule.byDay && rule.freq === "MONTHLY") {
    throw new RRuleError("BYDAY with MONTHLY needs ordinal (BYSETPOS) semantics we do not build");
  }
  return rule as RRule;
}

const MAX_ITERATIONS = 1_000_000; // safety: never hang on a pathological rule

interface Ctx {
  zone: string;
  anchorUtcMs: number;
  anchorWallMin: number;
  aHour: number;
  aMinute: number;
  aWeekday: number;
  aDom: number; // anchor day-of-month
  aDayNum: number; // anchor day number
  aWeekStart: number; // day number of the Monday of the anchor's week
  aMonthIdx: number; // year*12 + (month-1)
}

function makeCtx(zone: string, anchor: Date): Ctx {
  const aw = utcToWall(anchor, zone);
  const anchorWallMin = wallMinutes(aw);
  const aDayNum = daysFromCivil(aw.year, aw.month, aw.day);
  return {
    zone,
    anchorUtcMs: anchor.getTime(),
    anchorWallMin,
    aHour: aw.hour,
    aMinute: aw.minute,
    aWeekday: weekdayMon0(aw.year, aw.month, aw.day),
    aDom: aw.day,
    aDayNum,
    aWeekStart: aDayNum - weekdayMon0(aw.year, aw.month, aw.day),
    aMonthIdx: aw.year * 12 + (aw.month - 1),
  };
}

/**
 * Generate candidate wall-clock minute values in ascending order, starting at
 * the anchor occurrence (index 0 = the anchor itself, where representable).
 * `fromIndex` fast-forwards the grid phase without walking every step.
 */
function* candidates(rule: RRule, ctx: Ctx, fromIndex: number): Generator<number> {
  const times = (dayMinOf: number): number[] => {
    const hours = rule.byHour ?? [ctx.aHour];
    const minutes = rule.byMinute ?? [ctx.aMinute];
    const out: number[] = [];
    for (const h of hours) for (const mi of minutes) out.push(dayMinOf + h * 60 + mi);
    return out.sort((a, b) => a - b);
  };
  if (rule.freq === "MINUTELY") {
    for (let k = fromIndex; ; k++) {
      const m = ctx.anchorWallMin + k * rule.interval;
      const p = wallFromMinutes(m);
      if (rule.byHour && !rule.byHour.includes(p.hour)) continue;
      if (rule.byMinute && !rule.byMinute.includes(p.minute)) continue;
      if (rule.byDay && !rule.byDay.includes(weekdayMon0(p.year, p.month, p.day))) continue;
      yield m;
    }
  } else if (rule.freq === "HOURLY") {
    const aHourAbs = Math.floor(ctx.anchorWallMin / 60);
    for (let k = fromIndex; ; k++) {
      const hAbs = aHourAbs + k * rule.interval;
      const dayNum = Math.floor(hAbs / 24);
      const hour = hAbs - dayNum * 24;
      if (rule.byHour && !rule.byHour.includes(hour)) continue;
      const { year, month, day } = civilFromDays(dayNum);
      if (rule.byDay && !rule.byDay.includes(weekdayMon0(year, month, day))) continue;
      for (const mi of rule.byMinute ?? [ctx.aMinute]) {
        const m = dayNum * 1440 + hour * 60 + mi;
        if (m >= ctx.anchorWallMin) yield m;
      }
    }
  } else if (rule.freq === "DAILY") {
    for (let k = fromIndex; ; k++) {
      const dayNum = ctx.aDayNum + k * rule.interval;
      const { year, month, day } = civilFromDays(dayNum);
      if (rule.byDay && !rule.byDay.includes(weekdayMon0(year, month, day))) continue;
      for (const m of times(dayNum * 1440)) {
        if (m >= ctx.anchorWallMin) yield m;
      }
    }
  } else if (rule.freq === "WEEKLY") {
    const days = rule.byDay ?? [ctx.aWeekday];
    for (let k = fromIndex; ; k++) {
      const weekStart = ctx.aWeekStart + k * 7 * rule.interval;
      for (const wd of days) {
        const dayNum = weekStart + wd;
        for (const m of times(dayNum * 1440)) {
          if (m >= ctx.anchorWallMin) yield m;
        }
      }
    }
  } else {
    // MONTHLY
    for (let k = fromIndex; ; k++) {
      const idx = ctx.aMonthIdx + k * rule.interval;
      const year = Math.floor(idx / 12);
      const month = (idx % 12) + 1;
      if (ctx.aDom > daysInMonth(year, month)) continue; // e.g. 31st → skip short months
      const dayNum = daysFromCivil(year, month, ctx.aDom);
      for (const m of times(dayNum * 1440)) {
        if (m >= ctx.anchorWallMin) yield m;
      }
    }
  }
}

/** Rough grid index to start from so candidates begin near `afterMin` (wall). */
function startIndex(rule: RRule, ctx: Ctx, afterWallMin: number): number {
  const span = afterWallMin - ctx.anchorWallMin;
  if (span <= 0) return 0;
  switch (rule.freq) {
    case "MINUTELY":
      return Math.max(0, Math.floor(span / rule.interval) - 1);
    case "HOURLY":
      return Math.max(0, Math.floor(span / 60 / rule.interval) - 1);
    case "DAILY":
      return Math.max(0, Math.floor(span / 1440 / rule.interval) - 1);
    case "WEEKLY":
      return Math.max(0, Math.floor(span / (1440 * 7) / rule.interval) - 1);
    case "MONTHLY": {
      const after = wallFromMinutes(afterWallMin);
      const afterIdx = after.year * 12 + (after.month - 1);
      return Math.max(0, Math.floor((afterIdx - ctx.aMonthIdx) / rule.interval) - 1);
    }
  }
}

/**
 * The first occurrence strictly after `after` (UTC instant), or null when the
 * rule is exhausted (COUNT/UNTIL). `anchor` is the phase reference (the loop's
 * creation/publish time — see ./adapters.ts); occurrences never precede it.
 */
export function nextOccurrence(rule: RRule, zone: string, anchor: Date, after: Date): Date | null {
  const ctx = makeCtx(zone, anchor);
  // COUNT needs a global occurrence count, so walk from the anchor and count;
  // otherwise fast-forward the grid to just before `after`.
  const afterWallMin = wallMinutes(utcToWall(after, zone));
  const start = rule.count === undefined ? startIndex(rule, ctx, afterWallMin) : 0;
  let seen = 0;
  let iterations = 0;
  for (const wallMin of candidates(rule, ctx, start)) {
    if (++iterations > MAX_ITERATIONS) {
      throw new RRuleError("iteration cap exceeded — rule is too dense to evaluate safely");
    }
    const utc = wallToUtc(wallFromMinutes(wallMin), zone);
    if (utc === null) continue; // spring-forward gap: the occurrence never happens
    if (rule.count !== undefined) {
      seen++;
      if (seen > rule.count) return null;
    }
    if (rule.until && utc.getTime() > rule.until.getTime()) return null;
    if (utc.getTime() > after.getTime()) return utc;
  }
  return null; // unreachable (generators are infinite) — satisfies TS
}

export type { WallParts };
