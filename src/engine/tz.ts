/**
 * Wall-clock ↔ UTC conversion for IANA timezones, built on `Intl` only
 * (no tz-data dependency). The scheduler thinks in *wall time* ("9am in
 * America/New_York") and stores/fires *UTC instants*.
 *
 * Behavior notes (original implementation):
 * - A wall time that never exists (spring-forward gap, e.g. 02:30 on the US
 *   spring-forward day) converts to `null` — the caller skips that occurrence.
 * - A wall time that exists twice (fall-back) converts to the EARLIEST UTC
 *   instant — the first occurrence, matching user expectation for cron-ish
 *   schedules ("fire at the first 01:30").
 */

export interface WallParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  hour: number; // 0–23
  minute: number; // 0–59
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(zone, f);
  }
  return f;
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of a UTC instant in `zone`. */
export function utcToWall(instant: Date, zone: string): WallParts {
  const out: Record<string, number> = {};
  for (const p of formatter(zone).formatToParts(instant)) {
    if (p.type !== "literal") out[p.type] = Number.parseInt(p.value, 10);
  }
  return {
    year: out["year"]!,
    month: out["month"]!,
    day: out["day"]!,
    hour: out["hour"]! % 24,
    minute: out["minute"]!,
  };
}

/** Days since 1970-01-01 for a civil date (Howard Hinnant's algorithm). */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400; // [0, 399]
  const mp = m > 2 ? m - 3 : m + 9; // [0, 11] (Mar=0)
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Civil date for a day count since 1970-01-01. */
export function civilFromDays(z: number): { year: number; month: number; day: number } {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097; // [0, 146096]
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153); // [0, 11] (Mar=0)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return { year: m <= 2 ? y + 1 : y, month: m, day: d };
}

/** Absolute wall-clock minutes for arithmetic (day number * 1440 + time). */
export function wallMinutes(p: WallParts): number {
  return daysFromCivil(p.year, p.month, p.day) * 1440 + p.hour * 60 + p.minute;
}

/** Wall parts from an absolute wall-minute count. */
export function wallFromMinutes(mins: number): WallParts {
  const days = Math.floor(mins / 1440);
  const rem = mins - days * 1440;
  const { year, month, day } = civilFromDays(days);
  return { year, month, day, hour: Math.floor(rem / 60), minute: rem % 60 };
}

/** Weekday of a civil date: 0 = Monday … 6 = Sunday (RFC 5545 BYDAY order). */
export function weekdayMon0(year: number, month: number, day: number): number {
  const z = daysFromCivil(year, month, day); // 1970-01-01 was a Thursday
  return (((z % 7) + 7) % 7 + 3) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return daysFromCivil(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) -
    daysFromCivil(year, month, 1);
}

function sameWall(a: WallParts, b: WallParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day &&
    a.hour === b.hour && a.minute === b.minute;
}

/**
 * Convert wall-clock parts in `zone` to a UTC instant.
 * Returns `null` when the wall time never occurs (spring-forward gap).
 * Ambiguous (fall-back) wall times resolve to the earliest UTC instant.
 */
export function wallToUtc(p: WallParts, zone: string): Date | null {
  // Iterate: guess = wall-as-UTC, then correct by the wall-space difference.
  // Converges in ≤2 steps for real offsets; a spring-forward gap oscillates
  // and is caught by the final verification.
  let guess = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const target = wallMinutes(p);
  for (let i = 0; i < 4; i++) {
    const diff = target - wallMinutes(utcToWall(new Date(guess), zone));
    if (diff === 0) break;
    guess += diff * 60_000;
  }
  if (!sameWall(utcToWall(new Date(guess), zone), p)) return null; // nonexistent
  // Fall-back ambiguity: the same wall time occurs at guess-Δt for the offset
  // change Δt (≤ 1.5h anywhere). Prefer the earliest matching instant.
  let best = guess;
  for (const offSec of [1800, 3600, 5400]) {
    const earlier = guess - offSec * 1000;
    if (sameWall(utcToWall(new Date(earlier), zone), p)) best = earlier;
  }
  return new Date(best);
}
