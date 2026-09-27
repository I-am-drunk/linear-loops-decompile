import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOOP_DRAFT } from "./index.ts";

test("default loop draft is disabled and unpublished until the operator publishes", () => {
  assert.equal(DEFAULT_LOOP_DRAFT.enabled, false);
  assert.equal(DEFAULT_LOOP_DRAFT.triggerType, "schedule");
  assert.ok(DEFAULT_LOOP_DRAFT.schedule?.rrule.startsWith("FREQ="));
  assert.deepEqual(DEFAULT_LOOP_DRAFT.activities, ["comment"]);
});
