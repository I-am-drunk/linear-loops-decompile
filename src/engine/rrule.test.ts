/** T-401 recurrence tests — node:test, no network, fixed anchors. */
import assert from "node:assert/strict";
import test from "node:test";
import { nextOccurrence, parseRRule, RRuleError } from "./rrule.ts";
import { utcToWall, wallToUtc } from "./tz.ts";

const T = (iso: string) => new Date(iso);
const next = (rrule: string, zone: string, anchor: string, after: string) =>
  nextOccurrence(parseRRule(rrule), zone, T(anchor), T(after));

test("hourly: phase follows the anchor's wall minute", () => {
  assert.equal(
    next("FREQ=HOURLY", "UTC", "2026-01-05T09:30:00Z", "2026-01-05T10:00:00Z")?.toISOString(),
    "2026-01-05T10:30:00.000Z",
  );
});

test("minutely: INTERVAL=15 keeps the anchor's phase (:07/:22/:37/:52)", () => {
  assert.equal(
    next("FREQ=MINUTELY;INTERVAL=15", "UTC", "2026-01-01T00:07:00Z", "2026-01-01T00:22:00Z")?.toISOString(),
    "2026-01-01T00:37:00.000Z",
  );
});

test("daily: next day, same wall time", () => {
  assert.equal(
    next("FREQ=DAILY", "UTC", "2026-01-05T09:00:00Z", "2026-01-05T09:00:00Z")?.toISOString(),
    "2026-01-06T09:00:00.000Z",
  );
});

test("daily INTERVAL=3: phase is anchor-locked (restart-stable)", () => {
  // Anchor Jan 1 → Jan 4, Jan 7 — not Jan 3/6/9 from some absolute epoch.
  assert.equal(
    next("FREQ=DAILY;INTERVAL=3", "UTC", "2026-01-01T09:00:00Z", "2026-01-02T00:00:00Z")?.toISOString(),
    "2026-01-04T09:00:00.000Z",
  );
  assert.equal(
    next("FREQ=DAILY;INTERVAL=3", "UTC", "2026-01-01T09:00:00Z", "2026-01-04T09:00:00Z")?.toISOString(),
    "2026-01-07T09:00:00.000Z",
  );
});

test("weekly BYDAY=MO,WE expands within the week", () => {
  // 2026-01-05 is a Monday.
  assert.equal(
    next("FREQ=WEEKLY;BYDAY=MO,WE", "UTC", "2026-01-05T09:00:00Z", "2026-01-05T09:00:00Z")?.toISOString(),
    "2026-01-07T09:00:00.000Z",
  );
  assert.equal(
    next("FREQ=WEEKLY;BYDAY=MO,WE", "UTC", "2026-01-05T09:00:00Z", "2026-01-07T09:00:00Z")?.toISOString(),
    "2026-01-12T09:00:00.000Z",
  );
});

test("weekly without BYDAY defaults to the anchor's weekday", () => {
  assert.equal(
    next("FREQ=WEEKLY", "UTC", "2026-01-07T09:00:00Z", "2026-01-07T09:00:00Z")?.toISOString(), // Wed
    "2026-01-14T09:00:00.000Z",
  );
});

test("monthly on the 31st skips short months", () => {
  assert.equal(
    next("FREQ=MONTHLY", "UTC", "2026-01-31T09:00:00Z", "2026-01-31T09:00:00Z")?.toISOString(),
    "2026-03-31T09:00:00.000Z", // February has no 31st
  );
});

test("BYHOUR×BYMINUTE expand in ascending order", () => {
  assert.equal(
    next("FREQ=DAILY;BYHOUR=9,17;BYMINUTE=0,30", "UTC", "2026-01-01T00:00:00Z", "2026-01-01T09:00:00Z")?.toISOString(),
    "2026-01-01T09:30:00.000Z",
  );
  assert.equal(
    next("FREQ=DAILY;BYHOUR=9,17;BYMINUTE=0,30", "UTC", "2026-01-01T00:00:00Z", "2026-01-01T17:30:00Z")?.toISOString(),
    "2026-01-02T09:00:00.000Z",
  );
});

test("COUNT stops the rule after N occurrences", () => {
  assert.equal(
    next("FREQ=DAILY;COUNT=3", "UTC", "2026-01-01T09:00:00Z", "2026-01-02T09:00:00Z")?.toISOString(),
    "2026-01-03T09:00:00.000Z",
  );
  assert.equal(
    next("FREQ=DAILY;COUNT=3", "UTC", "2026-01-01T09:00:00Z", "2026-01-03T09:00:00Z"),
    null,
  );
});

test("UNTIL is an inclusive end", () => {
  assert.equal(
    next("FREQ=DAILY;UNTIL=20260103T000000Z", "UTC", "2026-01-01T09:00:00Z", "2026-01-01T09:00:00Z")?.toISOString(),
    "2026-01-02T09:00:00.000Z",
  );
  assert.equal(
    next("FREQ=DAILY;UNTIL=20260103T000000Z", "UTC", "2026-01-01T09:00:00Z", "2026-01-02T09:00:00Z"),
    null,
  );
});

test("IANA zone: 9am America/New_York is 14:00 UTC in winter (EST)", () => {
  assert.equal(
    next("FREQ=DAILY;BYHOUR=9;BYMINUTE=0", "America/New_York", "2026-01-05T14:00:00Z", "2026-01-05T14:00:00Z")?.toISOString(),
    "2026-01-06T14:00:00.000Z",
  );
});

test("DST spring-forward: a nonexistent 02:30 is skipped, not shifted", () => {
  // US spring forward: 2026-03-08, 02:00→03:00. 02:30 never happens that day.
  const rule = "FREQ=DAILY;BYHOUR=2;BYMINUTE=30";
  const anchor = "2026-03-01T07:30:00Z"; // = 02:30 EST
  assert.equal(
    next(rule, "America/New_York", anchor, "2026-03-07T07:30:00Z")?.toISOString(),
    "2026-03-09T06:30:00.000Z", // Mar 8 02:30 skipped; Mar 9 02:30 EDT = 06:30 UTC
  );
});

test("DST: wall-clock stays 9am across the EST→EDT shift", () => {
  const rule = "FREQ=DAILY;BYHOUR=9;BYMINUTE=0";
  const zone = "America/New_York";
  const anchor = "2026-03-01T14:00:00Z"; // 09:00 EST
  assert.equal(next(rule, zone, anchor, "2026-03-06T14:00:00Z")?.toISOString(), "2026-03-07T14:00:00.000Z"); // EST
  assert.equal(next(rule, zone, anchor, "2026-03-08T14:00:00Z")?.toISOString(), "2026-03-09T13:00:00.000Z"); // EDT
});

test("DST fall-back: ambiguous 01:30 resolves to the FIRST occurrence", () => {
  // US fall back: 2026-11-01, 02:00 EDT → 01:00 EST. 01:30 happens twice.
  const wall = { year: 2026, month: 11, day: 1, hour: 1, minute: 30 };
  assert.equal(wallToUtc(wall, "America/New_York")?.toISOString(), "2026-11-01T05:30:00.000Z"); // EDT instance
});

test("wallToUtc round-trips ordinary times", () => {
  const wall = { year: 2026, month: 6, day: 15, hour: 12, minute: 0 };
  const utc = wallToUtc(wall, "Europe/Berlin");
  assert.ok(utc);
  assert.deepEqual(utcToWall(utc, "Europe/Berlin"), wall);
});

test("parse errors fail loud", () => {
  assert.throws(() => parseRRule("INTERVAL=2"), RRuleError); // no FREQ
  assert.throws(() => parseRRule("FREQ=DAILY;BYSETPOS=1"), RRuleError); // unknown part
  assert.throws(() => parseRRule("FREQ=DAILY;INTERVAL=0"), RRuleError);
  assert.throws(() => parseRRule("FREQ=WEEKLY;BYDAY=XX"), RRuleError);
  assert.throws(() => parseRRule("FREQ=MONTHLY;BYDAY=MO"), RRuleError); // ordinal semantics not built
  assert.throws(() => parseRRule("FREQ=DAILY;UNTIL=yesterday"), RRuleError);
  assert.throws(() => parseRRule("FREQ=YEARLY"), RRuleError);
  assert.throws(() => parseRRule("FREQ=DAILY;FREQ=WEEKLY"), RRuleError); // duplicate part
});

test("fast-forward: a far-future query is cheap and correct", () => {
  // Minutely rule, queried 8 months out — must not walk every minute.
  const t0 = Date.now();
  const r = next("FREQ=MINUTELY;INTERVAL=7", "UTC", "2026-01-01T00:00:00Z", "2026-09-01T12:00:00Z");
  const elapsed = Date.now() - t0;
  assert.ok(r && r.toISOString() > "2026-09-01T12:00:00.000Z");
  const mins = (r!.getTime() - T("2026-09-01T12:00:00Z").getTime()) / 60000;
  assert.ok(mins > 0 && mins <= 7, `next minutely fire within one interval (${mins}min)`);
  assert.ok(elapsed < 2000, `fast enough (${elapsed}ms)`);
});
