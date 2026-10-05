/** AU1 sort/filter kernel. Pure functions, no DOM. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { listFor, matches, sortAutomations, type AutomationSummary } from "./model.ts";

const a = (over: Partial<AutomationSummary> & { id: string; name: string }): AutomationSummary => ({
  enabled: true, model: `gpt-4o`, createdBy: `tj`, tools: [], triggerCount: 1, ...over,
});

test(`enabled rows sort before disabled, regardless of name`, () => {
  const out = sortAutomations([
    a({ id: `1`, name: `Alpha`, enabled: false }),
    a({ id: `2`, name: `Zulu`, enabled: true }),
  ]);
  assert.deepEqual(out.map((x) => x.name), [`Zulu`, `Alpha`]);
});

test(`names collate naturally: "Deploy 2" before "Deploy 10"`, () => {
  const out = sortAutomations([a({ id: `1`, name: `Deploy 10` }), a({ id: `2`, name: `Deploy 2` })]);
  assert.deepEqual(out.map((x) => x.name), [`Deploy 2`, `Deploy 10`]);
});

test(`equal names tiebreak on id so order does not shift between renders`, () => {
  const once = sortAutomations([a({ id: `b`, name: `Same` }), a({ id: `a`, name: `Same` })]);
  const twice = sortAutomations([a({ id: `a`, name: `Same` }), a({ id: `b`, name: `Same` })]);
  assert.deepEqual(once.map((x) => x.id), [`a`, `b`]);
  assert.deepEqual(twice.map((x) => x.id), [`a`, `b`]);
});

test(`sortAutomations does not mutate its input`, () => {
  const input = [a({ id: `1`, name: `Z` }), a({ id: `2`, name: `A` })];
  sortAutomations(input);
  assert.deepEqual(input.map((x) => x.name), [`Z`, `A`]);
});

test(`search covers name, model, creator and tool names`, () => {
  const row = a({ id: `1`, name: `Nightly`, model: `claude-opus`, createdBy: `sam`, tools: [`github`] });
  for (const q of [`nightly`, `opus`, `sam`, `github`]) {
    assert.equal(matches(row, { search: q }), true, `missed: ${q}`);
  }
  assert.equal(matches(row, { search: `nothing` }), false);
});

test(`search is accent- and case-insensitive`, () => {
  const row = a({ id: `1`, name: `Déploy Staging` });
  assert.equal(matches(row, { search: `deploy` }), true);
  assert.equal(matches(row, { search: `DEPLOY` }), true);
});

test(`multiple terms narrow — all must match, in any field`, () => {
  const row = a({ id: `1`, name: `Nightly build`, createdBy: `sam` });
  assert.equal(matches(row, { search: `nightly sam` }), true);
  assert.equal(matches(row, { search: `nightly alex` }), false);
});

test(`blank and whitespace-only searches match everything`, () => {
  const row = a({ id: `1`, name: `Anything` });
  assert.equal(matches(row, { search: `` }), true);
  assert.equal(matches(row, { search: `   ` }), true);
  assert.equal(matches(row, {}), true);
});

test(`the enabled filter has three states: on, off, and undefined=both`, () => {
  const on = a({ id: `1`, name: `On`, enabled: true });
  const off = a({ id: `2`, name: `Off`, enabled: false });
  assert.deepEqual(listFor([on, off], { enabled: true }).map((x) => x.id), [`1`]);
  assert.deepEqual(listFor([on, off], { enabled: false }).map((x) => x.id), [`2`]);
  assert.equal(listFor([on, off], {}).length, 2);
});

test(`the tool filter is exact, not substring — "git" must not match "github"`, () => {
  const row = a({ id: `1`, name: `X`, tools: [`github`] });
  assert.equal(matches(row, { tool: `github` }), true);
  // A substring tool filter would silently widen a user's explicit choice.
  assert.equal(matches(row, { tool: `git` }), false);
});

test(`filters compose with search`, () => {
  const rows = [
    a({ id: `1`, name: `Nightly`, enabled: true, tools: [`github`] }),
    a({ id: `2`, name: `Nightly`, enabled: false, tools: [`github`] }),
    a({ id: `3`, name: `Weekly`, enabled: true, tools: [`slack`] }),
  ];
  assert.deepEqual(
    listFor(rows, { search: `nightly`, enabled: true, tool: `github` }).map((x) => x.id),
    [`1`],
  );
});
