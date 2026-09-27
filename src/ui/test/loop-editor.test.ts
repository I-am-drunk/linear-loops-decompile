/**
 * T-702 unit tests: the RRULE builder core and the validation mirror.
 * The mirror test runs the SAME configs through the UI's validate.ts and the
 * model's real zod gate (parseLoopConfig) and asserts identical verdicts —
 * the two implementations cannot silently drift. Strip-types safe.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRRule,
  builderRoundTrip,
  parseForBuilder,
  DEFAULT_BUILDER_STATE,
} from "../src/features/loops/editor/rruleBuilder.ts";
import type { BuilderState } from "../src/features/loops/editor/rruleBuilder.ts";
import { validateLoopConfig } from "../src/features/loops/editor/validate.ts";
import { parseLoopConfig, defaultLoopConfig } from "../../model/index.ts";
import type { LoopConfig } from "../../model/index.ts";

// ---------- rruleBuilder ----------

test("builder round-trips every preset shape", () => {
  const states: BuilderState[] = [
    { freq: "MINUTELY", interval: 15, byDay: [], hour: 9, minute: 0 },
    { freq: "HOURLY", interval: 1, byDay: [], hour: 9, minute: 0 },
    { freq: "HOURLY", interval: 2, byDay: [], hour: 9, minute: 30 },
    { freq: "DAILY", interval: 1, byDay: [], hour: 9, minute: 0 },
    { freq: "WEEKLY", interval: 1, byDay: ["FR", "MO"], hour: 9, minute: 0 },
    { freq: "MONTHLY", interval: 3, byDay: [], hour: 18, minute: 45 },
  ];
  for (const s of states) {
    const weekdayOrder = (a: string, b: string): number =>
      ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].indexOf(a) -
      ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].indexOf(b);
    assert.deepEqual(
      builderRoundTrip(s),
      { ...s, byDay: [...s.byDay].sort(weekdayOrder) },
      buildRRule(s),
    );
  }
  assert.equal(buildRRule(DEFAULT_BUILDER_STATE), "FREQ=HOURLY");
});

test("canonical emission order + defaults omitted", () => {
  assert.equal(
    buildRRule({ freq: "WEEKLY", interval: 2, byDay: ["FR", "MO"], hour: 9, minute: 5 }),
    "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR;BYHOUR=9;BYMINUTE=5",
  );
  assert.equal(
    buildRRule({ freq: "DAILY", interval: 1, byDay: [], hour: 0, minute: 0 }),
    "FREQ=DAILY;BYHOUR=0;BYMINUTE=0",
  );
});

test("raw fallback: unsupported parts, dup keys, no FREQ, BYDAY-on-monthly are preserved", () => {
  const raws = [
    "FREQ=WEEKLY;BYDAY=MO;BYSETPOS=1",
    "FREQ=MONTHLY;BYDAY=MO", // engine rejects BYDAY on MONTHLY — preserved, not "fixed"
    "FREQ=DAILY;COUNT=10",
    "FREQ=DAILY;UNTIL=20261231T000000Z",
    "FREQ=DAILY;BYHOUR=9;BYHOUR=17",
    "FREQ=DAILY;BYHOUR=9;FREQ=DAILY",
    "BYHOUR=9",
    "not a rule",
  ];
  for (const r of raws) {
    const p = parseForBuilder(r);
    assert.equal(p.mode, "raw", r);
    if (p.mode === "raw") assert.equal(p.rrule, r); // byte-identical
  }
});

test("parse: representable rules read back correctly", () => {
  const p = parseForBuilder("FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,MO;BYHOUR=8;BYMINUTE=30");
  assert.equal(p.mode, "builder");
  if (p.mode === "builder") {
    assert.deepEqual(p.state, { freq: "WEEKLY", interval: 2, byDay: ["WE", "MO"], hour: 8, minute: 30 });
  }
  assert.equal(parseForBuilder("FREQ=HOURLY").mode, "builder");
});

// ---------- validation mirror ----------

const base = (): LoopConfig => defaultLoopConfig();

test("mirror: valid configs pass both validators", () => {
  const good: LoopConfig[] = [
    base(),
    {
      ...base(),
      trigger: {
        type: "event",
        event: { entity: "issue", kind: "inTriage" },
        activationMode: "collectionChanged",
      },
    },
    {
      ...base(),
      trigger: {
        type: "event",
        event: { entity: "issue", kind: "updated" },
        activationMode: "watchedPropertyChanged",
      },
      conditions: [{ kind: "watchedProperties", properties: ["stateId"] }],
    },
    {
      ...base(),
      trigger: { type: "schedule", schedule: { rrule: "FREQ=WEEKLY;BYDAY=MO", timezone: "UTC" } },
      conditions: [{ kind: "commentMatch", pattern: "^ship.?it$", isRegex: true }],
      color: "#5e6ad2",
    },
  ];
  for (const c of good) {
    assert.deepEqual(validateLoopConfig(c), [], JSON.stringify(c));
    assert.equal(parseLoopConfig(c).ok, true, JSON.stringify(c));
  }
});

test("mirror: invalid configs fail both validators, named messages match", () => {
  const cases: ReadonlyArray<readonly [LoopConfig, string | null]> = [
    [{ ...base(), name: "  " }, null],
    [{ ...base(), prompt: { format: "markdown", markdown: "" } }, "a loop needs a prompt"],
    [{ ...base(), color: "red" }, "hex color like #5e6ad2"],
    [
      { ...base(), trigger: { type: "schedule", schedule: { rrule: "HOURLY", timezone: "UTC" } } },
      "rrule must declare FREQ (RFC 5545), e.g. FREQ=DAILY;BYHOUR=9",
    ],
    [
      {
        ...base(),
        trigger: {
          type: "event",
          event: { entity: "project", kind: "inTriage" },
          activationMode: "collectionChanged",
        },
      },
      "the inTriage event only applies to issues",
    ],
    [
      {
        ...base(),
        trigger: {
          type: "event",
          event: { entity: "issue", kind: "updated" },
          activationMode: "watchedPropertyChanged",
        },
      },
      "a watchedPropertyChanged trigger needs at least one watchedProperties condition",
    ],
    [
      { ...base(), conditions: [{ kind: "commentMatch", pattern: "([", isRegex: true }] },
      "pattern is not a valid regular expression",
    ],
    [{ ...base(), activities: [] }, null],
  ];
  for (const [config, namedMessage] of cases) {
    const client = validateLoopConfig(config);
    const server = parseLoopConfig(config);
    assert.ok(client.length > 0, `client should reject: ${JSON.stringify(config)}`);
    assert.equal(server.ok, false, `server should reject: ${JSON.stringify(config)}`);
    if (namedMessage !== null) {
      assert.ok(
        client.some((i) => i.message === namedMessage),
        `client names ${JSON.stringify(namedMessage)}`,
      );
      if (!server.ok) {
        assert.ok(
          server.issues.some((i) => i.message === namedMessage),
          `server names ${JSON.stringify(namedMessage)}`,
        );
      }
    }
  }
});
