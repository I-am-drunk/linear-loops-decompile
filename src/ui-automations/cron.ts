/**
 * Cron validation (AU3, docs/plan/automations.md).
 *
 * Built from the public specification — POSIX crontab plus the Vixie
 * extensions everyone actually uses: five fields, `*`, lists, ranges, steps,
 * `@daily`-style macros. Nothing here derives from any vendor's scheduler.
 *
 * Validation only. Computing the next fire time is the scheduler's job and
 * a later slice; here we answer "is this a schedule at all, and what does
 * it mean" so the editor can refuse garbage before it is saved.
 */

/** The five fields, in crontab order, with their inclusive bounds. */
const FIELDS = [
  { name: `minute`, min: 0, max: 59 },
  { name: `hour`, min: 0, max: 23 },
  { name: `dayOfMonth`, min: 1, max: 31 },
  { name: `month`, min: 1, max: 12 },
  { name: `dayOfWeek`, min: 0, max: 7 }, // 7 is Sunday too (Vixie)
] as const;

/** Vixie macros, each the five-field expression it stands for. */
export const MACROS: Record<string, string> = {
  "@yearly": `0 0 1 1 *`,
  "@annually": `0 0 1 1 *`,
  "@monthly": `0 0 1 * *`,
  "@weekly": `0 0 * * 0`,
  "@daily": `0 0 * * *`,
  "@midnight": `0 0 * * *`,
  "@hourly": `0 * * * *`,
};

export type CronVerdict =
  | { ok: true; fields: string; macro?: string }
  | { ok: false; detail: string };

/** Does one field expression parse within [min, max]? Returns the fault. */
function checkField(expr: string, min: number, max: number, name: string): string | undefined {
  // A field is a comma list; each item is `*`, `N`, `A-B`, optionally `/step`.
  for (const item of expr.split(`,`)) {
    const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(item);
    if (!m) return `${name}: cannot parse "${item}"`;
    const [, base, lo, hi, step] = m;
    if (step !== undefined && Number(step) === 0) return `${name}: step of 0 in "${item}"`;
    if (base === `*`) continue;
    const a = Number(lo);
    const b = hi === undefined ? a : Number(hi);
    if (a < min || a > max) return `${name}: ${a} outside ${min}-${max}`;
    if (b < min || b > max) return `${name}: ${b} outside ${min}-${max}`;
    if (b < a) return `${name}: range "${item}" runs backwards`;
  }
  return undefined;
}

/**
 * Validate a crontab expression or macro.
 *
 * Returns the normalized five-field form so callers can compare schedules
 * by meaning: `@daily` and `0 0 * * *` validate to the same `fields`, and
 * runs of whitespace collapse to one space.
 */
export function validateCron(input: string): CronVerdict {
  const raw = input.trim().replace(/\s+/g, ` `);
  if (raw === ``) return { ok: false, detail: `empty schedule` };

  if (raw.startsWith(`@`)) {
    const expanded = MACROS[raw.toLowerCase()];
    return expanded
      ? { ok: true, fields: expanded, macro: raw.toLowerCase() }
      : { ok: false, detail: `unknown macro "${raw}"` };
  }

  const parts = raw.split(` `);
  if (parts.length !== 5) {
    return { ok: false, detail: `expected 5 fields, got ${parts.length}` };
  }

  // Iterate the tuple directly: indexing FIELDS[i] under
  // noUncheckedIndexedAccess types as possibly-undefined, which is noise
  // for a 5-element literal. parts.length === 5 was checked above.
  for (const [i, f] of FIELDS.entries()) {
    const fault = checkField(parts[i] ?? ``, f.min, f.max, f.name);
    if (fault) return { ok: false, detail: fault };
  }
  return { ok: true, fields: raw };
}

/**
 * The DOM/DOW OR rule, stated so the scheduler slice does not forget it:
 * when BOTH day-of-month and day-of-week are restricted (neither is `*`),
 * POSIX says a job runs when EITHER matches, not both. `0 9 13 * 5` is
 * "the 13th, and also every Friday" — not "Friday the 13th". Exposed for
 * tests now and for the scheduler later.
 */
export function daysAreUnion(fields: string): boolean {
  const [, , dom, , dow] = fields.split(` `);
  return dom !== `*` && dow !== `*`;
}
