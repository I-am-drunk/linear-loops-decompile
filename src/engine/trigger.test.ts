/** T-402 trigger/condition evaluator tests — node:test, fixture events. */
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTrigger, type EntityEvent } from "./trigger.ts";
import type { WorkflowDefinition } from "../model/index.ts";

const T = (iso: string) => new Date(iso);

function loopFixture(over: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: "loop-1",
    slugId: "abc123",
    name: "Triage watcher",
    prompt: { format: "markdown", markdown: "Handle it" },
    trigger: {
      type: "event",
      event: { entity: "issue", kind: "updated" },
      activationMode: "watchedPropertyChanged",
    },
    conditions: [{ kind: "watchedProperties", properties: ["stateId", "assigneeId"] }],
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
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function eventFixture(over: Partial<EntityEvent> = {}): EntityEvent {
  return {
    id: "evt-1",
    entity: "issue",
    kind: "updated",
    entityId: "issue-1",
    changedProperties: ["stateId"],
    ...over,
  };
}

test("watched property changed → fires with an execution context", () => {
  const d = evaluateTrigger(loopFixture(), eventFixture());
  assert.equal(d.fire, true);
  assert.equal(d.execution?.loopId, "loop-1");
  assert.equal(d.execution?.triggerEventId, "evt-1");
  assert.deepEqual(d.execution?.target, { entityType: "issue", entityId: "issue-1" });
});

test("no watched property changed → no fire, reason says why", () => {
  const d = evaluateTrigger(loopFixture(), eventFixture({ changedProperties: ["title"] }));
  assert.equal(d.fire, false);
  assert.ok(d.reasons.some((r) => r.includes("no watched property changed")));
});

test("missing property diff fails closed", () => {
  const d = evaluateTrigger(loopFixture(), eventFixture({ changedProperties: undefined }));
  assert.equal(d.fire, false);
  assert.ok(d.reasons.some((r) => r.includes("fail closed")));
});

test("wrong entity/kind → no fire", () => {
  const d = evaluateTrigger(loopFixture(), eventFixture({ kind: "created" }));
  assert.equal(d.fire, false);
  assert.ok(d.reasons.some((r) => r.includes("does not match trigger")));
});

test("disabled / archived loops never fire", () => {
  assert.equal(evaluateTrigger(loopFixture({ enabled: false }), eventFixture()).fire, false);
  assert.equal(evaluateTrigger(loopFixture({ archivedAt: "2026-02-01T00:00:00Z" }), eventFixture()).fire, false);
});

test("schedule triggers ignore entity events", () => {
  const loop = loopFixture({
    trigger: { type: "schedule", schedule: { rrule: "FREQ=DAILY", timezone: "UTC" } },
  });
  assert.equal(evaluateTrigger(loop, eventFixture()).fire, false);
});

test("collectionChanged: membership gain/loss with operation matching", () => {
  const loop = loopFixture({
    trigger: { type: "event", event: { entity: "issue", kind: "updated" }, activationMode: "collectionChanged" },
    conditions: [{ kind: "collectionChange", property: "labels", operation: "added" }],
  });
  assert.equal(evaluateTrigger(loop, eventFixture({
    collectionChange: { property: "labels", operation: "added" },
  })).fire, true);
  // wrong operation
  assert.equal(evaluateTrigger(loop, eventFixture({
    collectionChange: { property: "labels", operation: "removed" },
  })).fire, false);
  // addedOrRemoved matches both
  const either = loopFixture({
    trigger: { type: "event", event: { entity: "issue", kind: "updated" }, activationMode: "collectionChanged" },
    conditions: [{ kind: "collectionChange", property: "labels", operation: "addedOrRemoved" }],
  });
  assert.equal(evaluateTrigger(either, eventFixture({
    collectionChange: { property: "labels", operation: "removed" },
  })).fire, true);
});

test("commentMatch: first-condition-only + comment-created events (corpus rule)", () => {
  const onComment = loopFixture({
    trigger: { type: "event", event: { entity: "comment", kind: "created" }, activationMode: "collectionChanged" },
    conditions: [{ kind: "commentMatch", pattern: "urgent", isRegex: false }],
  });
  const commentEvent = eventFixture({
    entity: "comment", kind: "created", entityId: "comment-1",
    comment: { body: "this is urgent, please" },
  });
  assert.equal(evaluateTrigger(onComment, commentEvent).fire, true);
  // not first condition → never fires
  const notFirst = loopFixture({
    trigger: { type: "event", event: { entity: "comment", kind: "created" }, activationMode: "collectionChanged" },
    conditions: [
      { kind: "propertyFilter", property: "priority", op: "eq", value: 1 },
      { kind: "commentMatch", pattern: "urgent", isRegex: false },
    ],
  });
  const withProps = { ...commentEvent, properties: { priority: 1 } };
  assert.equal(evaluateTrigger(notFirst, withProps).fire, false);
  // regex variant
  const re = loopFixture({
    trigger: { type: "event", event: { entity: "comment", kind: "created" }, activationMode: "collectionChanged" },
    conditions: [{ kind: "commentMatch", pattern: "\\bp0\\b", isRegex: true }],
  });
  assert.equal(evaluateTrigger(re, { ...commentEvent, comment: { body: "p0 incident" } }).fire, true);
  assert.equal(evaluateTrigger(re, { ...commentEvent, comment: { body: "p10 ticket" } }).fire, false);
});

test("propertyFilter: eq/neq/in/contains against the event snapshot", () => {
  const mk = (op: "eq" | "neq" | "in" | "contains", value: string | number | string[]) =>
    loopFixture({
      conditions: [{ kind: "propertyFilter", property: "priority", op, value }],
    });
  const ev = eventFixture({ properties: { priority: 2 } });
  assert.equal(evaluateTrigger(mk("eq", 2), ev).fire, true);
  assert.equal(evaluateTrigger(mk("eq", 1), ev).fire, false);
  assert.equal(evaluateTrigger(mk("neq", 1), ev).fire, true);
  // the model's `in` expects a string array — use string priorities there
  const evStr = eventFixture({ properties: { priority: "high" } });
  assert.equal(evaluateTrigger(mk("in", ["high", "urgent"]), evStr).fire, true);
  assert.equal(evaluateTrigger(mk("in", ["low"]), evStr).fire, false);
  // contains on a string property
  const title = loopFixture({
    conditions: [{ kind: "propertyFilter", property: "title", op: "contains", value: "bug" }],
  });
  assert.equal(evaluateTrigger(title, eventFixture({ properties: { title: "nasty bug report" } })).fire, true);
  // unknown property → fails
  assert.equal(evaluateTrigger(mk("eq", 2), eventFixture()).fire, false);
});

test("all conditions must pass (AND semantics)", () => {
  const loop = loopFixture({
    conditions: [
      { kind: "watchedProperties", properties: ["stateId"] },
      { kind: "propertyFilter", property: "priority", op: "eq", value: 1 },
    ],
  });
  assert.equal(evaluateTrigger(loop, eventFixture({ properties: { priority: 0 } })).fire, false);
  assert.equal(evaluateTrigger(loop, eventFixture({ properties: { priority: 1 } })).fire, true);
});

test("trusted sources: external events must be allowlisted", () => {
  const open = loopFixture({ trustedSourceKeys: ["github"] });
  assert.equal(evaluateTrigger(open, eventFixture({ sourceKey: "github" })).fire, true);
  assert.equal(evaluateTrigger(open, eventFixture({ sourceKey: "zapier" })).fire, false);
  // first-party events (no sourceKey) always pass the gate
  assert.equal(evaluateTrigger(open, eventFixture()).fire, true);
});

test("team scoping + applyToSubTeams", () => {
  const scoped = loopFixture({ teamId: "team-eng" });
  assert.equal(evaluateTrigger(scoped, eventFixture({ teamId: "team-design" })).fire, false);
  assert.equal(evaluateTrigger(scoped, eventFixture({ teamId: "team-eng" })).fire, true);
  const wide = loopFixture({ teamId: "team-eng", applyToSubTeams: true });
  assert.equal(evaluateTrigger(wide, eventFixture({ teamId: "team-eng-android", teamAncestorIds: ["team-eng"] })).fire, true);
  assert.equal(evaluateTrigger(wide, eventFixture({ teamId: "team-design", teamAncestorIds: [] })).fire, false);
});

test("inTriage events match the triage variant (issue-only per the write-gate)", () => {
  const triage = loopFixture({
    trigger: { type: "event", event: { entity: "issue", kind: "inTriage" }, activationMode: "collectionChanged" },
    conditions: [],
  });
  assert.equal(evaluateTrigger(triage, eventFixture({ kind: "inTriage" })).fire, true);
  assert.equal(evaluateTrigger(triage, eventFixture({ kind: "updated" })).fire, false);
});

test("chat trigger wakes on chat/mention events only", () => {
  const chat = loopFixture({ trigger: { type: "chat" }, conditions: [] });
  assert.equal(evaluateTrigger(chat, eventFixture({ chatMessage: { body: "@loops daily summary" } })).fire, true);
  assert.equal(evaluateTrigger(chat, eventFixture()).fire, false);
});
