/**
 * T-701 unit tests for the pure loops-list modules. Runs under
 * `node --experimental-strip-types --test` (no enums/namespaces in the
 * imported modules — keep it that way).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { filterLoops, groupLoops, WORKSPACE_GROUP } from "../src/features/loops/grouping.ts";
import { relativeAgo, lastRunLabel } from "../src/features/loops/relativeTime.ts";
import { scheduleLabel, triggerLabel } from "../src/features/loops/triggerLabel.ts";
import { statusTone, NEVER_RUN_TONE } from "../src/features/loops/statusTone.ts";
import type { LoopSummary } from "../src/features/loops/types.ts";

const mk = (over: Partial<LoopSummary>): LoopSummary => ({
  id: over.id ?? "x",
  name: over.name ?? "Loop",
  ownerName: over.ownerName ?? "Ada",
  enabled: over.enabled ?? true,
  trigger: over.trigger ?? { type: "chat" },
  ...over,
});

test("grouping: groupName beats team beats Workspace; Workspace sorts last", () => {
  const groups = groupLoops([
    mk({ id: "w", name: "Zeta" }), // workspace catch-all
    mk({ id: "b", name: "Beta", teamName: "Beta team" }),
    mk({ id: "a", name: "Alpha", groupName: "Alpha grp", teamName: "Zzz team" }),
    mk({ id: "w2", name: "Aaa" }), // workspace, sorts first within its group
  ]);
  assert.deepEqual(groups.map((g) => g.label), ["Alpha grp", "Beta team", WORKSPACE_GROUP]);
  assert.equal(groups[2]!.isWorkspace, true);
  assert.deepEqual(groups[2]!.loops.map((l) => l.id), ["w2", "w"]); // A→Z inside group
  // empty input → no groups
  assert.deepEqual(groupLoops([]), []);
});

test("filter: case-insensitive over name/description/team/owner; blank keeps all", () => {
  const loops = [
    mk({ id: "1", name: "Triage digest", description: "Morning summary" }),
    mk({ id: "2", name: "SLA watch", teamName: "Support" }),
    mk({ id: "3", name: "Scribe", ownerName: "Mara" }),
  ];
  assert.deepEqual(filterLoops(loops, "").map((l) => l.id), ["1", "2", "3"]);
  assert.deepEqual(filterLoops(loops, "  ").map((l) => l.id), ["1", "2", "3"]);
  assert.deepEqual(filterLoops(loops, "TRIAGE").map((l) => l.id), ["1"]);
  assert.deepEqual(filterLoops(loops, "morning").map((l) => l.id), ["1"]);
  assert.deepEqual(filterLoops(loops, "support").map((l) => l.id), ["2"]);
  assert.deepEqual(filterLoops(loops, "mara").map((l) => l.id), ["3"]);
  assert.deepEqual(filterLoops(loops, "zzz"), []);
});

test("relativeAgo: just-now / m / h / d / absolute; future is just now", () => {
  const now = new Date("2026-09-27T12:00:00.000Z");
  assert.equal(relativeAgo("2026-09-27T11:59:40.000Z", now), "just now");
  assert.equal(relativeAgo("2026-09-27T11:54:00.000Z", now), "6m ago");
  assert.equal(relativeAgo("2026-09-27T10:00:00.000Z", now), "2h ago");
  assert.equal(relativeAgo("2026-09-25T12:00:00.000Z", now), "2d ago");
  assert.equal(relativeAgo("2026-08-01T12:00:00.000Z", now), "Aug 1");
  assert.equal(relativeAgo("2026-09-28T00:00:00.000Z", now), "just now");
  assert.equal(relativeAgo("not-a-date", now), "unknown");
  // chip labels
  assert.equal(lastRunLabel({ status: "complete", at: "2026-09-27T10:00:00.000Z" }, now), "Ran 2h ago");
  assert.equal(lastRunLabel({ status: "error", at: "2026-09-27T10:00:00.000Z" }, now), "Failed 2h ago");
  assert.equal(lastRunLabel({ status: "active", at: "2026-09-27T10:00:00.000Z" }, now), "Running…");
  assert.equal(lastRunLabel({ status: "awaitingInput", at: "2026-09-27T10:00:00.000Z" }, now), "Waiting for input");
  assert.equal(lastRunLabel({ status: "pending", at: "2026-09-27T10:00:00.000Z" }, now), "Queued");
});

test("trigger labels: schedule FREQ shapes, chat, event kinds", () => {
  assert.equal(scheduleLabel("FREQ=HOURLY"), "Hourly");
  assert.equal(scheduleLabel("FREQ=WEEKLY;BYDAY=MO,FR"), "Weekly · Mon, Fri");
  assert.equal(scheduleLabel("FREQ=DAILY;INTERVAL=2"), "Daily · every 2");
  assert.equal(scheduleLabel("DTSTART;SOMETHING=1"), "Custom schedule");
  assert.equal(triggerLabel({ type: "chat" }), "Chat mention");
  assert.equal(
    triggerLabel({
      type: "event",
      event: { entity: "issue", kind: "inTriage" },
      activationMode: "collectionChanged",
    }),
    "Issue in triage",
  );
  assert.equal(
    triggerLabel({
      type: "event",
      event: { entity: "release", kind: "created" },
      activationMode: "collectionChanged",
    }),
    "Release created",
  );
  // status tones cover the whole RunStatus vocabulary
  assert.equal(statusTone("complete"), "success");
  assert.equal(statusTone("error"), "danger");
  assert.equal(statusTone("awaitingInput"), "warning");
  assert.equal(statusTone("active"), "accent");
  assert.equal(statusTone("pending"), "accent");
  assert.equal(statusTone("waiting"), "accent");
  assert.equal(statusTone("canceled"), "muted");
  assert.equal(statusTone("stale"), "muted");
  assert.equal(NEVER_RUN_TONE, "muted");
});
