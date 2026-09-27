/**
 * Tests for RateBudget — the piece with the most subtle logic.
 * Run: see README: compile then run node --test on emitted tests/rateBudget.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { RateBudget } from "../rateBudget.js";
import { BudgetExhaustedError } from "../errors.js";

function makeBudget(overrides: Partial<ConstructorParameters<typeof RateBudget>[0]> = {}) {
  let t = 1_000_000;
  const budget = new RateBudget({
    maxRequestsPerHour: 3,
    windowMs: 60_000,
    now: () => t,
    ...overrides,
  });
  return { budget, advance: (ms: number) => (t += ms) };
}

test("allows up to maxRequests in the window, then reports a wait", () => {
  const { budget } = makeBudget();
  assert.equal(budget.waitTimeMs(), 0);
  budget.record();
  budget.record();
  budget.record();
  assert.equal(budget.remainingRequests(), 0);
  assert.ok(budget.waitTimeMs() > 0);
});

test("sliding window frees capacity as old spends age out", () => {
  const { budget, advance } = makeBudget();
  budget.record();
  budget.record();
  budget.record();
  assert.equal(budget.remainingRequests(), 0);
  advance(61_000); // whole window passes
  assert.equal(budget.remainingRequests(), 3);
  assert.equal(budget.waitTimeMs(), 0);
});

test("server clamp lowers the estimate and decrements on record", () => {
  const { budget } = makeBudget({ maxRequestsPerHour: 100 });
  budget.updateFromHeaders({ requestsRemaining: 5 });
  assert.equal(budget.remainingRequests(), 5);
  budget.record();
  budget.record();
  assert.equal(budget.remainingRequests(), 3);
});

test("never raises the estimate above local bookkeeping via headers", () => {
  const { budget } = makeBudget({ maxRequestsPerHour: 10 });
  budget.record();
  budget.record();
  budget.updateFromHeaders({ requestsRemaining: 500 });
  assert.equal(budget.remainingRequests(), 8);
});

test("complexity over the configured cap is an Infinity wait", () => {
  const { budget } = makeBudget({ maxComplexityPerHour: 10 });
  assert.equal(budget.waitTimeMs(11), Infinity);
  assert.equal(budget.waitTimeMs(10), 0);
});

test("blockedUntil from retryAfterMs gates waitTimeMs", () => {
  const { budget, advance } = makeBudget();
  budget.updateFromHeaders({ retryAfterMs: 30_000 });
  assert.ok(budget.waitTimeMs() >= 29_000);
  advance(31_000);
  assert.equal(budget.waitTimeMs(), 0);
});

test("waitForBudget resolves after capacity frees", async () => {
  const real: RateBudget = new RateBudget({
    maxRequestsPerHour: 1,
    windowMs: 40, // 40ms window for a fast test
  });
  real.record();
  const start = Date.now();
  await real.waitForBudget(1, { maxWaitMs: 5000 });
  assert.ok(Date.now() - start >= 35);
});

test("waitForBudget throws BudgetExhaustedError past maxWaitMs", async () => {
  const real = new RateBudget({ maxRequestsPerHour: 1, windowMs: 60_000 });
  real.record();
  await assert.rejects(
    () => real.waitForBudget(1, { maxWaitMs: 10 }),
    (e) => e instanceof BudgetExhaustedError,
  );
});

test("snapshot shape is stable", () => {
  const { budget } = makeBudget();
  budget.record();
  const snap = budget.snapshot();
  assert.equal(snap.requestsUsed, 1);
  assert.equal(snap.requestsRemaining, 2);
  assert.equal(snap.complexityRemaining, null);
  assert.equal(snap.blockedUntil, null);
});

