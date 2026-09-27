/** T-401 scheduler/registry/adapter tests — node:test, in-memory store. */
import assert from "node:assert/strict";
import test from "node:test";
import { loopToEntry, cronJobToEntry } from "./adapters.ts";
import { MemoryScheduleStore, ScheduleRegistry } from "./registry.ts";
import { evaluate, type ScheduleEntry } from "./schedule.ts";
import type { WorkflowCronJobDefinition, WorkflowDefinition } from "../model/index.ts";

const T = (iso: string) => new Date(iso);

function entry(over: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: "loop:test",
    rrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
    timezone: "UTC",
    anchor: T("2026-01-01T08:00:00Z"),
    enabled: true,
    misfire: "skip",
    ...over,
  };
}

test("onTime fire, and a re-tick never double-fires", () => {
  const reg = new ScheduleRegistry(new MemoryScheduleStore());
  reg.upsert(entry());
  const t1 = reg.tick(T("2026-01-01T09:00:30Z"));
  assert.equal(t1.length, 1);
  assert.equal(t1[0]!.kind, "onTime");
  assert.equal(t1[0]!.scheduledAt.toISOString(), "2026-01-01T09:00:00.000Z");
  assert.deepEqual(reg.tick(T("2026-01-01T09:00:30Z")), []); // idempotent
  const t2 = reg.tick(T("2026-01-02T09:00:01Z"));
  assert.equal(t2.length, 1);
  assert.equal(t2[0]!.scheduledAt.toISOString(), "2026-01-02T09:00:00.000Z");
});

test("not due before the first occurrence", () => {
  const reg = new ScheduleRegistry(new MemoryScheduleStore());
  reg.upsert(entry());
  assert.deepEqual(reg.tick(T("2026-01-01T08:30:00Z")), []);
  assert.equal(reg.nextDue("loop:test", T("2026-01-01T08:30:00Z"))?.toISOString(), "2026-01-01T09:00:00.000Z");
});

test("misfire skip (Linear's collapse): no replay, waterline jumps", () => {
  const reg = new ScheduleRegistry(new MemoryScheduleStore());
  reg.upsert(entry()); // skip policy
  reg.tick(T("2026-01-01T09:00:10Z")); // fired Jan 1
  // server down until Jan 5 10:00 — occurrences Jan 2,3,4,5 09:00 missed
  const due = reg.tick(T("2026-01-05T10:00:00Z"));
  assert.deepEqual(due, []); // nothing replayed
  assert.deepEqual(reg.tick(T("2026-01-05T10:00:00Z")), []); // stable
  assert.equal(reg.nextDue("loop:test", T("2026-01-05T10:00:00Z"))?.toISOString(), "2026-01-06T09:00:00.000Z");
  // …and the next on-time fire works normally
  const t = reg.tick(T("2026-01-06T09:00:05Z"));
  assert.equal(t.length, 1);
  assert.equal(t[0]!.kind, "onTime");
});

test("misfire catchUp: exactly one collapsed make-up run for the latest miss", () => {
  const reg = new ScheduleRegistry(new MemoryScheduleStore());
  reg.upsert(entry({ misfire: "catchUp" }));
  reg.tick(T("2026-01-01T09:00:10Z")); // fired Jan 1
  const due = reg.tick(T("2026-01-05T10:00:00Z"));
  assert.equal(due.length, 1);
  assert.equal(due[0]!.kind, "catchUp");
  assert.equal(due[0]!.scheduledAt.toISOString(), "2026-01-05T09:00:00.000Z"); // latest missed only
  assert.deepEqual(reg.tick(T("2026-01-05T10:00:00Z")), []); // no second make-up
  assert.equal(reg.nextDue("loop:test", T("2026-01-05T10:00:00Z"))?.toISOString(), "2026-01-06T09:00:00.000Z");
});

test("exhausted rules (COUNT) stop firing and report nextDue null", () => {
  const reg = new ScheduleRegistry(new MemoryScheduleStore());
  reg.upsert(entry({ rrule: "FREQ=DAILY;BYHOUR=9;COUNT=2" }));
  assert.equal(reg.tick(T("2026-01-01T09:00:01Z")).length, 1);
  assert.equal(reg.tick(T("2026-01-02T09:00:01Z")).length, 1);
  assert.deepEqual(reg.tick(T("2026-01-03T09:00:01Z")), []);
  assert.equal(reg.nextDue("loop:test", T("2026-01-03T09:00:01Z")), null);
});

test("disabled entries never fire", () => {
  const reg = new ScheduleRegistry(new MemoryScheduleStore());
  reg.upsert(entry({ enabled: false }));
  assert.deepEqual(reg.tick(T("2026-01-01T09:00:01Z")), []);
});

test("upsert validates at write time (bad rrule / bad zone throw)", () => {
  const reg = new ScheduleRegistry(new MemoryScheduleStore());
  assert.throws(() => reg.upsert(entry({ rrule: "FREQ=SOMETIMES" })));
  assert.throws(() => reg.upsert(entry({ timezone: "Mars/Olympus_Mons" })));
});

test("evaluate is pure: store untouched until the registry records", () => {
  const store = new MemoryScheduleStore();
  const e = entry();
  const ev = evaluate(e, T("2026-01-01T09:00:30Z"), null);
  assert.equal(ev.due?.kind, "onTime");
  assert.equal(store.getLastFired(e.id), null); // evaluate() did not write
});

test("multi-entry tick returns every due fire", () => {
  const reg = new ScheduleRegistry(new MemoryScheduleStore());
  reg.upsert(entry({ id: "loop:a" }));
  reg.upsert(entry({ id: "cron:b", rrule: "FREQ=HOURLY", anchor: T("2026-01-01T09:00:00Z") }));
  const due = reg.tick(T("2026-01-01T09:30:00Z"));
  assert.deepEqual(due.map((d) => d.entryId).sort(), ["cron:b", "loop:a"]);
});

// --- adapters onto @loops/model ---

function loopFixture(over: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: "loop-1",
    slugId: "abc123",
    name: "Digest",
    prompt: { format: "markdown", markdown: "Summarize" },
    trigger: { type: "schedule", schedule: { rrule: "FREQ=DAILY;BYHOUR=9", timezone: "UTC" } },
    conditions: [],
    enabled: true,
    applyToSubTeams: false,
    activities: ["comment"],
    trustedSourceKeys: [],
    codeAccess: "none",
    editAccess: "owner",
    subscriberIds: [],
    ownerId: "user-1",
    stats: { totalRuns: 0, completedRuns: 0, failedRuns: 0, totalCostUsd: 0 },
    version: 1,
    createdAt: "2026-01-01T08:00:00Z",
    updatedAt: "2026-01-01T08:00:00Z",
    ...over,
  };
}

test("loopToEntry maps schedule loops; anchor prefers publishedAt", () => {
  const e = loopToEntry(loopFixture({ publishedAt: "2026-02-01T08:00:00Z" }));
  assert.ok(e);
  assert.equal(e.id, "loop:loop-1");
  assert.equal(e.rrule, "FREQ=DAILY;BYHOUR=9");
  assert.equal(e.timezone, "UTC");
  assert.equal(e.anchor.toISOString(), "2026-02-01T08:00:00.000Z");
  assert.equal(e.misfire, "skip");
});

test("loopToEntry skips disabled, archived, and non-schedule loops", () => {
  assert.equal(loopToEntry(loopFixture({ enabled: false })), null);
  assert.equal(loopToEntry(loopFixture({ archivedAt: "2026-03-01T00:00:00Z" })), null);
  assert.equal(loopToEntry(loopFixture({ trigger: { type: "chat" } })), null);
});

test("cronJobToEntry maps standalone cron definitions", () => {
  const cron: WorkflowCronJobDefinition = {
    id: "cron-1",
    name: "Nightly",
    enabled: true,
    activities: [],
    schedule: { rrule: "FREQ=WEEKLY;BYDAY=FR;BYHOUR=17", timezone: "Europe/Berlin" },
    creatorId: "user-1",
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  const e = cronJobToEntry(cron);
  assert.ok(e);
  assert.equal(e.id, "cron:cron-1");
  assert.equal(e.timezone, "Europe/Berlin");
  assert.equal(cronJobToEntry({ ...cron, enabled: false }), null);
});

test("end-to-end: adapted loop ticks through the registry", () => {
  const reg = new ScheduleRegistry(new MemoryScheduleStore());
  const e = loopToEntry(loopFixture());
  assert.ok(e);
  reg.upsert(e);
  // Jan 1 09:00 fires on time…
  const d1 = reg.tick(T("2026-01-01T09:00:01Z"));
  assert.equal(d1.length, 1);
  assert.equal(d1[0]!.scheduledAt.toISOString(), "2026-01-01T09:00:00.000Z");
  // …and with the waterline kept, Jan 2 fires on time too (no collapse).
  const d2 = reg.tick(T("2026-01-02T09:00:01Z"));
  assert.equal(d2.length, 1);
  assert.equal(d2[0]!.scheduledAt.toISOString(), "2026-01-02T09:00:00.000Z");
});
