import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultAutomationSchedule,
  validateLoopConfig,
  type LoopConfig,
} from "./loop.ts";

function validConfig(): LoopConfig {
  return {
    name: "Triage sweep",
    triggerType: "schedule",
    conditions: [],
    enabled: false,
    applyToSubTeams: false,
    activities: [],
    trustedSourceKeys: [],
    codeAccess: "none",
    editAccess: "everyone",
    subscriberIds: [],
  };
}

test("defaultAutomationSchedule: next full hour, daily, interval 1 (corpus behavior)", () => {
  const s = defaultAutomationSchedule(new Date("2026-09-27T15:23:45Z"), "America/Toronto");
  assert.equal(s.startAt, "2026-09-27");
  assert.equal(s.hour, 16);
  assert.equal(s.type, "days");
  assert.equal(s.interval, 1);
  assert.equal(s.timezone, "America/Toronto");
  assert.equal(s.lastRecurredAt, undefined);

  const roll = defaultAutomationSchedule(new Date("2026-09-27T23:59:00Z"));
  assert.equal(roll.startAt, "2026-09-28");
  assert.equal(roll.hour, 0);
});

test("valid config passes with zero errors", () => {
  assert.deepEqual(validateLoopConfig(validConfig()), []);
});

test("name and triggerType are required; enums are exact", () => {
  const c = validConfig();
  c.name = "  ";
  assert.ok(validateLoopConfig(c).some((e) => e.path === "name"));

  const bad = { ...validConfig(), triggerType: "webhook" };
  assert.ok(validateLoopConfig(bad).some((e) => e.path === "triggerType"));

  const badMode = { ...validConfig(), activationMode: "onChange" };
  assert.ok(validateLoopConfig(badMode).some((e) => e.path === "activationMode"));
});

test("schedule rules mirror the corpus (weekly days, interval, hour/minute)", () => {
  const base = validConfig();
  const schedule = {
    startAt: "2026-09-28",
    type: "days",
    interval: 1,
    hour: 9,
  };
  assert.deepEqual(validateLoopConfig({ ...base, schedule }), []);

  // daysOfWeek on a non-weekly schedule: corpus refine message.
  const daysOnDaily = { ...base, schedule: { ...schedule, daysOfWeek: ["monday"] } };
  assert.ok(
    validateLoopConfig(daysOnDaily).some((e) => e.message === "Selected days require a weekly schedule."),
  );

  // Duplicate days: corpus refine message.
  const dupDays = {
    ...base,
    schedule: { ...schedule, type: "weeks", daysOfWeek: ["monday", "monday"] },
  };
  assert.ok(validateLoopConfig(dupDays).some((e) => e.message === "Days of the week must be unique."));

  // Empty days / bad interval / bad hour.
  const empty = { ...base, schedule: { ...schedule, type: "weeks", daysOfWeek: [] } };
  assert.ok(validateLoopConfig(empty).some((e) => e.path === "schedule.daysOfWeek"));
  const badInterval = { ...base, schedule: { ...schedule, interval: 0 } };
  assert.ok(validateLoopConfig(badInterval).some((e) => e.path === "schedule.interval"));
  const badHour = { ...base, schedule: { ...schedule, hour: 24 } };
  assert.ok(validateLoopConfig(badHour).some((e) => e.path === "schedule.hour"));
});

test("commentMatch: first condition only, and only on a comment trigger (corpus rules)", () => {
  const base = { ...validConfig(), triggerType: "issue", trigger: "commentAdded" };

  const ok = { ...base, conditions: [{ commentMatch: "bug" }, { watchedProperties: ["state"] }] };
  assert.deepEqual(validateLoopConfig(ok), []);

  const secondCondition = {
    ...base,
    conditions: [{ watchedProperties: ["state"] }, { commentMatch: "bug" }],
  };
  assert.ok(
    validateLoopConfig(secondCondition).some(
      (e) => e.message === "Comment matching can only be set on the first condition.",
    ),
  );

  const wrongTrigger = { ...base, trigger: "entityCreated", conditions: [{ commentMatch: "bug" }] };
  assert.ok(
    validateLoopConfig(wrongTrigger).some((e) => e.message === "Comment matching requires a comment trigger."),
  );
});

test("collectionChange needs property + added|removed (corpus shape)", () => {
  const base = { ...validConfig(), triggerType: "issue", activationMode: "collectionChanged" };
  const ok = { ...base, conditions: [{ collectionChange: { property: "labels", operation: "added" } }] };
  assert.deepEqual(validateLoopConfig(ok), []);

  const bad = { ...base, conditions: [{ collectionChange: { property: "labels", operation: "touched" } }] };
  assert.ok(validateLoopConfig(bad).some((e) => e.path === "conditions.0.collectionChange"));
});

test("chat triggers accept only chatMessagePosted | chatReactionAdded (corpus chat schema)", () => {
  const base = { ...validConfig(), triggerType: "chat" };
  assert.deepEqual(validateLoopConfig({ ...base, trigger: "chatMessagePosted" }), []);
  assert.ok(validateLoopConfig({ ...base, trigger: "commentAdded" }).some((e) => e.path === "trigger"));
});
