/**
 * T-1103 — the Runner's RunRegistry seam (has/activeRunIds), which the
 * connect channel reads for presence-lite and unknown-run gates.
 * Run: node --experimental-strip-types --test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Runner } from "./runner.ts";
import type { Brain } from "./brain.ts";

/** A brain that answers one exchange with a single response part. */
const doneBrain: Brain = {
  async *stream() {
    yield { kind: "response", text: "done" };
  },
};

/** A brain that parks until its abort fires (the cooperative-cancel path). */
const cancelableBrain: Brain = {
  async *stream(_input, signal) {
    while (!signal.aborted) {
      await new Promise((r) => setTimeout(r, 5));
    }
    return;
  },
};

test("has(): false for unknown ids, true after start", () => {
  const runner = new Runner();
  assert.equal(runner.has("nope"), false);
  const run = runner.start({ loopId: "loop-1", message: "hi", brain: doneBrain, runId: "run-1" });
  assert.equal(runner.has(run.id), true);
  assert.equal(runner.has("run-1"), true);
});

test("activeRunIds(): live runs listed, terminal runs drop out", async () => {
  const runner = new Runner();
  assert.deepEqual(runner.activeRunIds(), []);

  const run = runner.start({ loopId: "loop-1", message: "hi", brain: doneBrain, runId: "run-live" });
  assert.deepEqual(runner.activeRunIds(), ["run-live"]);

  const final = await runner.whenIdle(run.id);
  assert.equal(final.status, "complete");
  assert.deepEqual(runner.activeRunIds(), []);

  const doomed = runner.start({ loopId: "loop-1", message: "hi", brain: cancelableBrain, runId: "run-doomed" });
  assert.deepEqual(runner.activeRunIds(), [doomed.id]);
  runner.cancel(doomed.id); // cooperative: the drive loop lands the transition
  const landed = await runner.whenIdle(doomed.id);
  assert.equal(landed.status, "canceled");
  assert.deepEqual(runner.activeRunIds(), []);
});
