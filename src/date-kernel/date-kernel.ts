/**
 * The ambient date kernel — clean reimplementation of the plain-Date branch
 * of the boot-installed date library from the corpus chunk
 * `core.PJIFv7xf.js`, function `fe` (pretty L297–344, exported as `$`;
 * installed at boot by `html.CjyPLfH8.js` `b()`'s second call — html is the
 * ONLY importer of `$` in all 1,550 chunks, so these methods are ambient:
 * imported by nobody, assumed by everybody; merged R-BOOT §2,
 * docs/remap/sections/boot-config.md).
 *
 * Scope of this slice (declared, not silent): every method's PLAIN branch —
 * the arithmetic that runs when no timezone argument is passed, which is the
 * branch the schedule kernel's recurrence math executes on (SCHED-1
 * interlock). Each method also has a spacetime-backed tz branch in the
 * corpus, and two methods (`beginningOfWeek`, `nextWeekDay`) are
 * spacetime-only (they call `g(this, e)` even with no zone argument, corpus
 * L298–303). Those tz branches and the two spacetime-only methods are a
 * follow-up row (they need spacetime semantics), tracked in the R-BOOT
 * section file — NOT covered here, and `installDateKernel` deliberately does
 * not install the two spacetime-only names.
 *
 * Original code; behavior verified byte-for-byte against the committed
 * corpus-executed golden (`golden/date-kernel.cases.expected.json`), which
 * drives the REAL `fe` install from the corpus with zero stubs (all 14
 * closure chunks execute real, spacetime included).
 *
 * Value facts pinned by the golden (merged R-BOOT §2 row):
 *   - `offsetByDays` ≠ `offsetByHours(24)` across a DST boundary:
 *     offsetByDays is calendar arithmetic (`setDate`, corpus L316–320 —
 *     25 wall hours across a fall-back day), offsetByHours is epoch-ms
 *     arithmetic (L324).
 *   - `toLocalDate`'s invalid-date self-recursion strips ONE trailing
 *     character at a time until the string parses; the empty string yields
 *     `new Date` (now) (L338–339).
 *   - `daysTo` is date-fns differenceInCalendarDays over LOCAL calendar
 *     days (local midnights compared through the UTC-projection correction,
 *     `differenceInCalendarDays.DT1l52ZM.js` `h`/`f`/`m`).
 *   - `offsetByBusinessDays` validates workdays (1–7 entries, each 0–6) and
 *     |offset| ≤ 1e7 with exact throw strings, skips whole weeks first,
 *     then day-walks (corpus L380–397).
 */

/** Exact throw strings (corpus L381–382; `A = 1e7` L379 — the template
 * `>${A}` renders the number in JS default notation). */
export const INVALID_WORK_DAYS_MESSAGE = `Invalid work days specified`;
export const BUSINESS_DAY_OFFSET_LIMIT = 1e7;
export const BUSINESS_DAY_OUT_OF_BOUNDS_MESSAGE = `Business day offset out of bounds (>${BUSINESS_DAY_OFFSET_LIMIT} offset)`;

/* ------------------------------------------------------------------ *
 * date-fns internals the kernel bundles (differenceInCalendarDays     *
 * chunk `DT1l52ZM`, addDays chunk `BDe0ZOzk`) — transcribed exactly,  *
 * specialized to plain Date inputs (the kernel always passes Dates).  *
 * ------------------------------------------------------------------ */

/** dfns `m`: local midnight copy (`startOfDay`). */
function startOfDayLocal(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

/** dfns `f`: getTimezoneOffsetInMilliseconds — the UTC-projection
 * correction that makes calendar-day differences DST-safe. */
function timezoneOffsetMs(date: Date): number {
  const utcProjected = new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds(),
    ),
  );
  utcProjected.setUTCFullYear(date.getFullYear());
  return date.getTime() - utcProjected.getTime();
}

/** dfns `h`: differenceInCalendarDays(laterDate, earlierDate) — signed
 * count of local calendar-day boundaries. */
export function differenceInCalendarDays(laterDate: Date, earlierDate: Date): number {
  const a = startOfDayLocal(laterDate);
  const b = startOfDayLocal(earlierDate);
  const aMs = a.getTime() - timezoneOffsetMs(a);
  const bMs = b.getTime() - timezoneOffsetMs(b);
  return Math.round((aMs - bMs) / 864e5);
}

/** dfns addDays `n` (plain-Date specialization): calendar day offset via
 * `setDate`; a zero offset still returns a fresh copy. */
function addDaysLocal(date: Date, amount: number): Date {
  const d = new Date(date.getTime());
  if (Number.isNaN(amount)) return new Date(NaN);
  if (amount) d.setDate(d.getDate() + amount);
  return d;
}

/* ------------------------------------------------------------------ *
 * The kernel methods (plain branch of corpus `fe`, L304–344).         *
 * ------------------------------------------------------------------ */

/** `Date#midnight()` no-tz branch (L308–311): local midnight, field-wise. */
export function midnight(date: Date): Date {
  const d = new Date(date.getTime());
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d;
}

/** `Date#nearestMidnight()` no-tz branch (L315): the corpus fork is
 * literally `offsetByHours(12).midnight()` — 12 epoch-hours forward, then
 * local midnight. NOT "round to nearer midnight" in wall-clock terms on
 * DST days; the golden pins the fork as written. */
export function nearestMidnight(date: Date): Date {
  return midnight(offsetByHours(date, 12));
}

/** `Date#offsetByDays(n)` no-tz branch (L316–320): calendar arithmetic via
 * `setDate` — crosses DST boundaries at fixed wall-clock time. */
export function offsetByDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** `Date#offsetByHours(n)` (L324): epoch-ms arithmetic — a "day" of 24
 * hours shifts wall-clock time across DST. */
export function offsetByHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1e3);
}

/** `Date#offsetBySeconds(n)` (L326): epoch-ms arithmetic. */
export function offsetBySeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1e3);
}

/** `Date#toUTCDate()` (L328): shifts the instant by the local offset so
 * local field reads show the UTC fields. */
export function toUTCDate(date: Date): Date {
  return new Date(date.getTime() + date.getTimezoneOffset() * 6e4);
}

/** `Date#daysTo(e)` (L330): `differenceInCalendarDays(e, this)`. */
export function daysTo(date: Date, to: Date): number {
  return differenceInCalendarDays(to, date);
}

/** `Date#toTimelessDate()` (L332–335): `YYYY-MM-DD` from LOCAL fields,
 * zero-padded via padStart. */
export function toTimelessDate(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, `0`);
  const day = date.getDate().toString().padStart(2, `0`);
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `Date#offsetByBusinessDays(offset, workDays)` no-tz branch (corpus `j`,
 * L380–397): validate, skip whole weeks, then day-walk counting only
 * workdays. `workDays` are JS `getDay()` numbers (0 = Sunday). */
export function offsetByBusinessDays(date: Date, offset: number, workDays: number[]): Date {
  // Corpus-exact validation (L381): `NaN` workday entries and an Invalid
  // Date input pass this check in the corpus too (NaN comparisons are
  // false), and the corpus then walks forever / propagates NaN identically.
  // Reproduced as-is per the exactness bar — tightening the guard here
  // would diverge from first-party behavior (PR #303 review thread,
  // declined with this cite). Callers pass zod-validated day lists.
  if (workDays.length === 0 || workDays.length > 7 || workDays.some((d) => d < 0 || d > 6)) {
    throw Error(INVALID_WORK_DAYS_MESSAGE);
  }
  if (Math.abs(offset) > BUSINESS_DAY_OFFSET_LIMIT) {
    throw Error(BUSINESS_DAY_OUT_OF_BOUNDS_MESSAGE);
  }
  if (offset === 0) return date;
  let cursor = new Date(date.getTime());
  const direction = Math.sign(offset);
  const wholeWeeks = Math.max(0, Math.abs(Math.trunc(offset / workDays.length)) - 1);
  cursor = addDaysLocal(cursor, direction * wholeWeeks * 7);
  let remaining = Math.abs(offset) - wholeWeeks * workDays.length;
  while (remaining > 0) {
    cursor = addDaysLocal(cursor, direction);
    if (workDays.includes(cursor.getDay())) remaining--;
  }
  return cursor;
}

/** `String#toLocalDate()` no-tz branch (L336–341): parse; on Invalid Date
 * recurse on the string minus its LAST character (empty → `new Date`, i.e.
 * now); on success reconstruct a LOCAL date from the parsed UTC fields
 * (local midnight of the UTC calendar day). */
export function toLocalDate(text: string): Date {
  // The corpus implements the strip as self-recursion; a loop preserves the
  // pinned one-char-per-step strip order without letting input length
  // consume call-stack depth (CodeRabbit thread on PR #303 — the recursion
  // depth limit is an engine parameter, not a corpus value).
  let remaining = text;
  for (;;) {
    const parsed = new Date(remaining);
    if (parsed.toString() !== `Invalid Date`) {
      return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    }
    if (remaining.length === 0) return new Date();
    remaining = remaining.substring(0, remaining.length - 1);
  }
}

/* ------------------------------------------------------------------ *
 * Ambient installation (corpus `D`, L280–287): non-enumerable,        *
 * writable, configurable — the descriptor shape first-party uses.     *
 * ------------------------------------------------------------------ */

declare global {
  interface Date {
    midnight(): Date;
    nearestMidnight(): Date;
    offsetByDays(days: number): Date;
    offsetByBusinessDays(offset: number, workDays: number[]): Date;
    offsetByHours(hours: number): Date;
    offsetBySeconds(seconds: number): Date;
    toUTCDate(): Date;
    daysTo(to: Date): number;
    toTimelessDate(): string;
  }
  interface String {
    toLocalDate(): Date;
  }
}

function define(target: object, name: string, value: unknown): void {
  Object.defineProperty(target, name, {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

/**
 * Install the plain-branch methods on `Date.prototype` /
 * `String.prototype`, mirroring the corpus's boot-time `fe()` install.
 * The tz-branch parameters and the two spacetime-only methods
 * (`beginningOfWeek`, `nextWeekDay`) are NOT installed — a transcribed
 * chunk that needs them fails loudly instead of running wrong arithmetic
 * (see the module header's scope declaration).
 */
export function installDateKernel(): void {
  const rejectZone = (method: string, zone: unknown): void => {
    if (zone !== undefined) {
      throw Error(`date-kernel: Date#${method} timezone branch not implemented in this slice (got ${String(zone)}) — see src/date-kernel/date-kernel.ts scope declaration`);
    }
  };
  define(Date.prototype, `midnight`, function (this: Date, zone?: unknown) {
    rejectZone(`midnight`, zone);
    return midnight(this);
  });
  define(Date.prototype, `nearestMidnight`, function (this: Date, zone?: unknown) {
    rejectZone(`nearestMidnight`, zone);
    return nearestMidnight(this);
  });
  define(Date.prototype, `offsetByDays`, function (this: Date, days: number, zone?: unknown) {
    rejectZone(`offsetByDays`, zone);
    return offsetByDays(this, days);
  });
  define(Date.prototype, `offsetByBusinessDays`, function (this: Date, offset: number, workDays: number[], zone?: unknown) {
    rejectZone(`offsetByBusinessDays`, zone);
    return offsetByBusinessDays(this, offset, workDays);
  });
  define(Date.prototype, `offsetByHours`, function (this: Date, hours: number) {
    return offsetByHours(this, hours);
  });
  define(Date.prototype, `offsetBySeconds`, function (this: Date, seconds: number) {
    return offsetBySeconds(this, seconds);
  });
  define(Date.prototype, `toUTCDate`, function (this: Date) {
    return toUTCDate(this);
  });
  define(Date.prototype, `daysTo`, function (this: Date, to: Date) {
    return daysTo(this, to);
  });
  define(Date.prototype, `toTimelessDate`, function (this: Date) {
    return toTimelessDate(this);
  });
  define(String.prototype, `toLocalDate`, function (this: string, zone?: unknown) {
    // The tz branch is declared out of this slice (module header). A caller
    // passing a zone (e.g. the picker's `toLocalDate('UTC')`) must fail
    // loudly instead of silently receiving plain-branch arithmetic.
    if (zone !== undefined) {
      throw Error(`date-kernel: String#toLocalDate timezone branch not implemented in this slice (got ${String(zone)}) — see src/date-kernel/date-kernel.ts scope declaration`);
    }
    return toLocalDate(String(this));
  });
}
