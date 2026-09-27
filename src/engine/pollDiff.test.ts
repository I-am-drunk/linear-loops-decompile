/**
 * M5 poll-diff bridge tests — node:test, in-memory fixtures, no network.
 * Covers the diff semantics (pollDiff.ts header) and the diff → evaluateTrigger
 * integration that the T-1102 orchestrator wires into its event path.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  PollTracker,
  diffIssueSnapshots,
  flattenIssue,
  type PollIssue,
} from "./pollDiff.ts";
import { evaluateTrigger, type EntityEvent } from "./trigger.ts";
import type { WorkflowDefinition } from "../model/index.ts";

// --- fixtures ---------------------------------------------------------------

function issue(over: Partial<PollIssue> = {}): PollIssue {
  return {
    id: "iss-1",
    identifier: "ENG-1",
    title: "Set up CI",
    description: "We need CI",
    priority: 2,
    estimate: 3,
    dueDate: "2026-10-01",
    url: "https://linear.app/demo/issue/ENG-1",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-25T15:30:00.000Z",
    state: { id: "st-1", name: "In Progress", type: "started" },
    team: { id: "team-1", key: "ENG" },
    assignee: { id: "u-1", displayName: "Ada" },
    labels: [{ id: "lb-1", name: "bug" }],
    ...over,
  };
}

function loopFixture(over: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: "loop-1",
    slugId: "abc123",
    name: "State watcher",
    prompt: { format: "markdown", markdown: "Handle it" },
    trigger: {
      type: "event",
      event: { entity: "issue", kind: "updated" },
      activationMode: "watchedPropertyChanged",
    },
    conditions: [{ kind: "watchedProperties", properties: ["stateId"] }],
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

const W0 = "2026-09-25T00:00:00.000Z"; // baseline window watermark

// --- PollTracker: baseline, watermark, persistence --------------------------

test("baseline: the first observed window emits NOTHING (never fire on backlog)", () => {
  const t = new PollTracker();
  const events = t.observe({ issues: [issue(), issue({ id: "iss-2", identifier: "ENG-2" })], watermark: W0 });
  assert.deepEqual(events, []);
  assert.equal(t.primed, true);
  assert.equal(t.watermark, W0);
});

test("watermark advances to the newest window and never moves backward", () => {
  const t = new PollTracker();
  t.observe({ issues: [], watermark: "2026-09-25T01:00:00.000Z" });
  t.observe({ issues: [], watermark: "2026-09-25T02:00:00.000Z" });
  assert.equal(t.watermark, "2026-09-25T02:00:00.000Z");
  t.observe({ issues: [], watermark: "2026-09-25T01:30:00.000Z" }); // a stale reply
  assert.equal(t.watermark, "2026-09-25T02:00:00.000Z");
});

test("toJSON/fromJSON round-trip: a restored tracker diffs exactly like the original", () => {
  const t = new PollTracker();
  t.observe({ issues: [issue()], watermark: W0 });
  const restored = PollTracker.fromJSON(JSON.parse(JSON.stringify(t.toJSON())));
  assert.equal(restored.primed, true);
  const window = {
    issues: [issue({ title: "CI is live", updatedAt: "2026-09-26T09:00:00.000Z" })],
    watermark: "2026-09-26T09:00:00.000Z",
  };
  const expected = t.observe(window);
  assert.equal(expected.length, 1);
  assert.deepEqual(restored.observe(window), expected);
});

test("a fresh (state-lost) tracker re-baselines instead of double-firing", () => {
  const t = new PollTracker();
  const events = t.observe({ issues: [issue({ title: "Changed while we were down" })], watermark: W0 });
  assert.deepEqual(events, []); // window skipped — the fail-safe direction
});

// --- diff semantics ----------------------------------------------------------

test("new issue (createdAt newer than the previous watermark) → created event", () => {
  const prev = new Map<string, PollIssue>();
  const fresh = issue({ id: "iss-9", createdAt: "2026-09-26T08:00:00.000Z", updatedAt: "2026-09-26T08:00:00.000Z" });
  const [e] = diffIssueSnapshots(prev, [fresh], { prevWatermark: W0 });
  assert.equal(e?.kind, "created");
  assert.equal(e?.entity, "issue");
  assert.equal(e?.entityId, "iss-9");
  assert.equal(e?.id, "poll:issue:iss-9:2026-09-26T08:00:00.000Z");
  assert.equal(e?.teamId, "team-1");
  assert.deepEqual(e?.changedProperties, []);
  assert.equal(e?.properties?.["stateName"], "In Progress");
});

test("first-seen OLD issue → updated with changedProperties undefined (fails closed)", () => {
  const prev = new Map<string, PollIssue>();
  const old = issue({ id: "iss-old", createdAt: "2026-09-01T08:00:00.000Z" }); // predates W0
  const [e] = diffIssueSnapshots(prev, [old], { prevWatermark: W0 });
  assert.equal(e?.kind, "updated");
  assert.equal(e?.changedProperties, undefined);
});

test("field diffs → updated event with the exact flattened changedProperties", () => {
  const prev = new Map([[issue().id, issue()]]);
  const next = issue({
    title: "CI is live",
    state: { id: "st-2", name: "Done", type: "completed" },
    assignee: null,
    updatedAt: "2026-09-26T10:00:00.000Z",
  });
  const events = diffIssueSnapshots(prev, [next], { prevWatermark: W0 });
  assert.equal(events.length, 1);
  const e = events[0]!;
  assert.equal(e.kind, "updated");
  assert.deepEqual([...(e.changedProperties ?? [])].sort(), ["assigneeId", "stateId", "title"]);
  assert.equal(e.properties?.["stateName"], "Done");
  assert.equal(e.properties?.["assigneeId"], undefined); // absent, not null
  assert.equal(e.teamId, "team-1");
  assert.equal(e.id, "poll:issue:iss-1:2026-09-26T10:00:00.000Z");
});

test("null-vs-value and value-vs-null transitions on optional fields count as changes", () => {
  const prev = new Map([[issue().id, issue({ description: null, estimate: null })]]);
  const next = issue({ description: "now documented", estimate: 5, updatedAt: "2026-09-26T10:00:00.000Z" });
  const [e] = diffIssueSnapshots(prev, [next], { prevWatermark: W0 });
  assert.deepEqual([...(e?.changedProperties ?? [])].sort(), ["description", "estimate"]);
});

test("label gain → collectionChange added event; loss → removed; both → two events", () => {
  const before = issue({ labels: [{ id: "lb-1", name: "bug" }, { id: "lb-2", name: "ux" }] });
  const after = issue({
    labels: [{ id: "lb-1", name: "bug" }, { id: "lb-3", name: "urgent" }],
    updatedAt: "2026-09-26T10:00:00.000Z",
  });
  const events = diffIssueSnapshots(new Map([[before.id, before]]), [after], { prevWatermark: W0 });
  assert.deepEqual(
    events.map((e) => `${e.collectionChange?.property}:${e.collectionChange?.operation}`).sort(),
    ["labels:added", "labels:removed"],
  );
  assert.deepEqual(events.map((e) => e.id).sort(), [
    "poll:issue:iss-1:2026-09-26T10:00:00.000Z:labels-added",
    "poll:issue:iss-1:2026-09-26T10:00:00.000Z:labels-removed",
  ]);
  // label-only change: no plain field-diff event
  assert.ok(events.every((e) => e.changedProperties === undefined));
});

test("label NAME edits with stable ids are not membership changes (no event)", () => {
  const before = issue();
  const after = issue({ labels: [{ id: "lb-1", name: "bugfix" }], updatedAt: "2026-09-26T10:00:00.000Z" });
  const events = diffIssueSnapshots(new Map([[before.id, before]]), [after], { prevWatermark: W0 });
  // only the activity-touch event fires (membership by id is unchanged)
  assert.equal(events.length, 1);
  assert.deepEqual(events[0]?.changedProperties, []);
});

test("activity touch (updatedAt bump, no diffed change) → updated with an empty diff", () => {
  const before = issue();
  const after = issue({ updatedAt: "2026-09-26T10:00:00.000Z" }); // e.g. a comment
  const events = diffIssueSnapshots(new Map([[before.id, before]]), [after], { prevWatermark: W0 });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.kind, "updated");
  assert.deepEqual(events[0]?.changedProperties, []);
});

test("state.type → triage emits a dedicated inTriage event, once", () => {
  const before = issue({ state: { id: "st-0", name: "Backlog", type: "backlog" } });
  const triaged = issue({ state: { id: "st-9", name: "Triage", type: "triage" }, updatedAt: "2026-09-26T10:00:00.000Z" });
  const events = diffIssueSnapshots(new Map([[before.id, before]]), [triaged], { prevWatermark: W0 });
  assert.ok(events.some((e) => e.kind === "inTriage" && e.id === "poll:issue:iss-1:2026-09-26T10:00:00.000Z:inTriage"));
  assert.ok(events.some((e) => e.kind === "updated" && e.changedProperties?.includes("stateId")));
  // staying in triage: no repeat event
  const again = diffIssueSnapshots(new Map([[triaged.id, triaged]]), [
    issue({ state: { id: "st-9", name: "Triage", type: "triage" }, title: "renamed", updatedAt: "2026-09-26T11:00:00.000Z" }),
  ]);
  assert.ok(!again.some((e) => e.kind === "inTriage"));
});

test("event ids are stable across replays of the same poll window (queue dedups)", () => {
  const before = issue();
  const after = issue({ title: "CI is live", updatedAt: "2026-09-26T10:00:00.000Z" });
  const a = diffIssueSnapshots(new Map([[before.id, before]]), [after], { prevWatermark: W0 });
  const b = diffIssueSnapshots(new Map([[before.id, before]]), [after], { prevWatermark: W0 });
  assert.deepEqual(a.map((e) => e.id), b.map((e) => e.id));
});

test("flattenIssue: watched ids + display fields, nulls omitted", () => {
  const flat = flattenIssue(issue({ description: null, estimate: null, assignee: null }));
  assert.equal(flat["stateId"], "st-1");
  assert.equal(flat["stateType"], "started");
  assert.equal(flat["teamKey"], "ENG");
  assert.deepEqual(flat["labels"], ["bug"]);
  assert.equal(flat["description"], undefined);
  assert.equal(flat["estimate"], undefined);
  assert.equal(flat["assigneeId"], undefined);
});

// --- integration: diff → evaluateTrigger -------------------------------------

function fireLoopOn(loop: WorkflowDefinition, events: EntityEvent[]) {
  return events.map((e) => ({ event: e, decision: evaluateTrigger(loop, e) }));
}

test("watchedPropertyChanged loop: fires iff a watched property changed", () => {
  const before = issue();
  const after = issue({ state: { id: "st-2", name: "Done", type: "completed" }, updatedAt: "2026-09-26T10:00:00.000Z" });
  const events = diffIssueSnapshots(new Map([[before.id, before]]), [after], { prevWatermark: W0 });
  const [hit] = fireLoopOn(loopFixture(), events);
  assert.equal(hit?.decision.fire, true);
  assert.equal(hit?.decision.execution?.loopId, "loop-1");
  assert.equal(hit?.decision.execution?.triggerEventId, hit?.event.id);
  assert.deepEqual(hit?.decision.execution?.target, { entityType: "issue", entityId: "iss-1" });

  // an unwatched change alone does not fire
  const titleOnly = diffIssueSnapshots(new Map([[before.id, before]]), [
    issue({ title: "renamed", updatedAt: "2026-09-26T10:00:00.000Z" }),
  ], { prevWatermark: W0 });
  const [miss] = fireLoopOn(loopFixture(), titleOnly);
  assert.equal(miss?.decision.fire, false);
});

test("first-seen-old events never fire watchedPropertyChanged loops (fail closed)", () => {
  const events = diffIssueSnapshots(new Map(), [issue({ createdAt: "2026-09-01T00:00:00.000Z" })], { prevWatermark: W0 });
  const [hit] = fireLoopOn(loopFixture(), events);
  assert.equal(hit?.decision.fire, false);
  assert.ok(hit?.decision.reasons.some((r) => r.includes("fail closed")));
});

test("collectionChanged loop on labels: fires on membership gain, not on field diffs", () => {
  const loop = loopFixture({
    trigger: { type: "event", event: { entity: "issue", kind: "updated" }, activationMode: "collectionChanged" },
    conditions: [{ kind: "collectionChange", property: "labels", operation: "added" }],
  });
  const before = issue({ labels: [] });
  const after = issue({ labels: [{ id: "lb-1", name: "bug" }], title: "renamed too", updatedAt: "2026-09-26T10:00:00.000Z" });
  const events = diffIssueSnapshots(new Map([[before.id, before]]), [after], { prevWatermark: W0 });
  const results = fireLoopOn(loop, events);
  // exactly one fire: the labels-added event (the title field-diff event does not carry a collection change)
  assert.equal(results.filter((r) => r.decision.fire).length, 1);
  assert.equal(results.find((r) => r.decision.fire)?.event.collectionChange?.operation, "added");
});

test("propertyFilter loop: evaluates the snapshot on activity-touch events too", () => {
  const loop = loopFixture({
    conditions: [{ kind: "propertyFilter", property: "stateName", op: "eq", value: "Done" }],
  });
  const before = issue({ state: { id: "st-2", name: "Done", type: "completed" } });
  const after = issue({ state: { id: "st-2", name: "Done", type: "completed" }, updatedAt: "2026-09-26T10:00:00.000Z" });
  const events = diffIssueSnapshots(new Map([[before.id, before]]), [after], { prevWatermark: W0 });
  const [hit] = fireLoopOn(loop, events);
  assert.equal(hit?.decision.fire, true); // comment-bumped a Done issue: condition still true
});

test("created events feed issue.created loops; schedule loops ignore events", () => {
  const loop = loopFixture({
    trigger: { type: "event", event: { entity: "issue", kind: "created" }, activationMode: "watchedPropertyChanged" },
    conditions: [],
  });
  const fresh = issue({ id: "iss-9", createdAt: "2026-09-26T08:00:00.000Z", updatedAt: "2026-09-26T08:00:00.000Z" });
  const events = diffIssueSnapshots(new Map(), [fresh], { prevWatermark: W0 });
  const [hit] = fireLoopOn(loop, events);
  assert.equal(hit?.decision.fire, true);

  const schedLoop = loopFixture({ trigger: { type: "schedule", schedule: { rrule: "FREQ=HOURLY", timezone: "UTC" } } });
  assert.equal(evaluateTrigger(schedLoop, events[0]!).fire, false);
});

test("full poll-loop chain: tracker windows → events → trigger decisions stay dedup-stable", () => {
  const t = new PollTracker();
  t.observe({ issues: [issue()], watermark: W0 }); // baseline
  const w1 = { issues: [issue({ state: { id: "st-2", name: "Done", type: "completed" }, updatedAt: "2026-09-26T10:00:00.000Z" })], watermark: "2026-09-26T10:00:00.000Z" };
  const first = t.observe(w1).map((e) => evaluateTrigger(loopFixture(), e));
  assert.equal(first.filter((d) => d.fire).length, 1);
  // restarting mid-window: a tracker restored from the same state replays no events
  const restored = PollTracker.fromJSON(t.toJSON());
  assert.deepEqual(restored.observe(w1), []); // same window re-observed: diff is empty now
});
