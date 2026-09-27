/**
 * T-702 — schedule builder core. Pure; strip-types safe.
 *
 * Emits EXACTLY the RRULE subset the engine (T-401, src/engine/rrule.ts)
 * parses: FREQ (MINUTELY|HOURLY|DAILY|WEEKLY|MONTHLY), INTERVAL≥1,
 * BYDAY (MO..SU), BYHOUR (0–23), BYMINUTE (0–59), COUNT, UNTIL.
 *
 * The builder models a deliberate subset of that subset:
 *   MINUTELY → FREQ[, INTERVAL]
 *   HOURLY   → FREQ[, INTERVAL][, BYMINUTE]          (minute past the hour)
 *   DAILY    → FREQ[, INTERVAL], BYHOUR, BYMINUTE
 *   WEEKLY   → FREQ[, INTERVAL][, BYDAY], BYHOUR, BYMINUTE
 *   MONTHLY  → FREQ[, INTERVAL], BYHOUR, BYMINUTE    (engine rejects BYDAY here)
 *
 * Raw fallback: any rule outside the builder's model (BYSETPOS, BYMONTH,
 * COUNT, UNTIL, BYDAY on non-weekly, multi-value BYHOUR, …) opens in
 * "raw rule" mode and round-trips BYTE-IDENTICAL — the builder never
 * rewrites a rule it doesn't understand (settled on hub #21). Editing a
 * representable rule normalizes it; that is an explicit user edit, not a
 * silent rewrite.
 */

export const BUILDER_FREQS = ["MINUTELY", "HOURLY", "DAILY", "WEEKLY", "MONTHLY"] as const;
export type BuilderFreq = (typeof BUILDER_FREQS)[number];

export const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export const WEEKDAY_LABELS: Record<WeekdayCode, string> = {
  MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
};

export interface BuilderState {
  readonly freq: BuilderFreq;
  /** ≥ 1. */
  readonly interval: number;
  /** Weekly only. Empty = the anchor weekday (engine semantics). */
  readonly byDay: readonly WeekdayCode[];
  /** 0–23. Meaningful for DAILY/WEEKLY/MONTHLY. */
  readonly hour: number;
  /** 0–59. Meaningful for HOURLY and DAILY/WEEKLY/MONTHLY. */
  readonly minute: number;
}

export const DEFAULT_BUILDER_STATE: BuilderState = {
  freq: "HOURLY",
  interval: 1,
  byDay: [],
  hour: 9,
  minute: 0,
};

/** A parsed rule is either builder-representable or raw (opaque). */
export type ParsedRule =
  | { mode: "builder"; state: BuilderState }
  | { mode: "raw"; rrule: string };

const SUPPORTED_KEYS = new Set(["FREQ", "INTERVAL", "BYDAY", "BYHOUR", "BYMINUTE", "COUNT", "UNTIL"]);

const isInt = (s: string): boolean => /^-?\d+$/.test(s);

/** Which keys the builder can represent for a given frequency. */
function keyAllowed(key: string, freq: BuilderFreq): boolean {
  switch (key) {
    case "FREQ":
      return true;
    case "INTERVAL":
      return true;
    case "BYDAY":
      return freq === "WEEKLY";
    case "BYHOUR":
      return freq === "DAILY" || freq === "WEEKLY" || freq === "MONTHLY";
    case "BYMINUTE":
      return freq !== "MINUTELY";
    default:
      return false; // COUNT/UNTIL and anything else → raw
  }
}

/**
 * Parse an RRULE string for the builder. Returns raw mode when the rule uses
 * anything outside the builder's model so it is preserved untouched.
 */
export function parseForBuilder(rrule: string): ParsedRule {
  const parts = new Map<string, string>();
  for (const kv of rrule.split(";")) {
    const eq = kv.indexOf("=");
    if (eq <= 0) return { mode: "raw", rrule };
    const key = kv.slice(0, eq).toUpperCase();
    if (!SUPPORTED_KEYS.has(key) || parts.has(key)) return { mode: "raw", rrule };
    parts.set(key, kv.slice(eq + 1).toUpperCase());
  }
  const freqRaw = parts.get("FREQ");
  if (!freqRaw || !(BUILDER_FREQS as readonly string[]).includes(freqRaw)) {
    return { mode: "raw", rrule };
  }
  const freq = freqRaw as BuilderFreq;
  for (const key of parts.keys()) {
    if (!keyAllowed(key, freq)) return { mode: "raw", rrule };
  }

  let interval = 1;
  if (parts.has("INTERVAL")) {
    const raw = parts.get("INTERVAL")!;
    if (!isInt(raw) || Number(raw) < 1) return { mode: "raw", rrule };
    interval = Number(raw);
  }

  const readSingle = (key: string, min: number, max: number): number | null | "raw" => {
    const raw = parts.get(key);
    if (raw === undefined) return null;
    if (!isInt(raw)) return "raw";
    const n = Number(raw);
    if (n < min || n > max) return "raw";
    return n;
  };
  const hour = readSingle("BYHOUR", 0, 23);
  const minute = readSingle("BYMINUTE", 0, 59);
  if (hour === "raw" || minute === "raw") return { mode: "raw", rrule };

  let byDay: WeekdayCode[] = [];
  const rawDays = parts.get("BYDAY");
  if (rawDays !== undefined) {
    const codes = rawDays.split(",");
    for (const c of codes) {
      if (!(WEEKDAY_CODES as readonly string[]).includes(c)) return { mode: "raw", rrule };
    }
    byDay = codes as WeekdayCode[];
  }

  return {
    mode: "builder",
    state: { freq, interval, byDay, hour: hour ?? 9, minute: minute ?? 0 },
  };
}

/** Serialize builder state → canonical RRULE (only engine-supported keys). */
export function buildRRule(state: BuilderState): string {
  const parts = [`FREQ=${state.freq}`];
  if (state.interval > 1) parts.push(`INTERVAL=${state.interval}`);
  if (state.freq === "WEEKLY" && state.byDay.length > 0) {
    const ordered = [...state.byDay].sort(
      (a, b) =>
        (WEEKDAY_CODES as readonly string[]).indexOf(a) -
        (WEEKDAY_CODES as readonly string[]).indexOf(b),
    );
    parts.push(`BYDAY=${ordered.join(",")}`);
  }
  if (state.freq === "DAILY" || state.freq === "WEEKLY" || state.freq === "MONTHLY") {
    parts.push(`BYHOUR=${state.hour}`);
    parts.push(`BYMINUTE=${state.minute}`);
  } else if (state.freq === "HOURLY" && state.minute !== 0) {
    parts.push(`BYMINUTE=${state.minute}`);
  }
  return parts.join(";");
}

/**
 * Round-trip guarantee: a builder-representable rule parses back to the same
 * state. (Raw rules never reach this — they bypass the builder entirely.)
 */
export function builderRoundTrip(state: BuilderState): BuilderState {
  const parsed = parseForBuilder(buildRRule(state));
  if (parsed.mode !== "builder") throw new Error("builder emitted an unrepresentable rule");
  return parsed.state;
}
