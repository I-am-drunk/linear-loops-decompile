/** AU1 sort/filter kernel. Pure functions, no DOM. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { listFor, listPage, matches, sortAutomations, type AutomationSummary } from "./model.ts";

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

test(`equal enabled states keep source order instead of sorting names`, () => {
  const out = sortAutomations([a({ id: `1`, name: `Deploy 10` }), a({ id: `2`, name: `Deploy 2` })]);
  assert.deepEqual(out.map((x) => x.name), [`Deploy 10`, `Deploy 2`]);
});

test(`duplicate names retain incoming order without an id tiebreak`, () => {
  const once = sortAutomations([a({ id: `b`, name: `Same` }), a({ id: `a`, name: `Same` })]);
  const twice = sortAutomations([a({ id: `a`, name: `Same` }), a({ id: `b`, name: `Same` })]);
  assert.deepEqual(once.map((x) => x.id), [`b`, `a`]);
  assert.deepEqual(twice.map((x) => x.id), [`a`, `b`]);
});

test(`sortAutomations does not mutate its input`, () => {
  const input = [a({ id: `1`, name: `Z` }), a({ id: `2`, name: `A` })];
  sortAutomations(input);
  assert.deepEqual(input.map((x) => x.name), [`Z`, `A`]);
});

test(`search covers name and creator but not hidden model or tool fields`, () => {
  const row = a({ id: `1`, name: `Nightly`, model: `claude-opus`, createdBy: `sam`, tools: [`github`] });
  for (const q of [`nightly`, `sam`]) {
    assert.equal(matches(row, { tab: `team`, search: q }), true, `missed: ${q}`);
  }
  assert.equal(matches(row, { tab: `team`, search: `nothing` }), false);
  assert.equal(matches(row, { tab: `team`, search: `opus` }), false);
  assert.equal(matches(row, { tab: `team`, search: `github` }), false);
});

test(`search folds case while preserving accents`, () => {
  const row = a({ id: `1`, name: `Déploy Staging` });
  assert.equal(matches(row, { tab: `team`, search: `deploy` }), false);
  assert.equal(matches(row, { tab: `team`, search: `DEPLOY` }), false);
  assert.equal(matches(row, { tab: `team`, search: `DÉPLOY` }), true);
});

test(`a trimmed search is one substring within a single field`, () => {
  const row = a({ id: `1`, name: `Nightly build`, createdBy: `sam` });
  assert.equal(matches(row, { tab: `team`, search: ` nightly BUILD ` }), true);
  assert.equal(matches(row, { tab: `team`, search: `nightly sam` }), false);
  assert.equal(matches(row, { tab: `team`, search: `nightly alex` }), false);
});

test(`blank and whitespace-only searches match everything`, () => {
  const row = a({ id: `1`, name: `Anything` });
  assert.equal(matches(row, { tab: `team`, search: `` }), true);
  assert.equal(matches(row, { tab: `team`, search: `   ` }), true);
  assert.equal(matches(row, { tab: `team`,}), true);
});

test(`Mine requires an identified owner and excludes limited access`, () => {
  const own = a({ id: `1`, name: `Own`, createdById: 7 });
  const others = a({ id: `2`, name: `Other`, createdById: 8 });
  const limited = a({ id: `3`, name: `Limited`, createdById: 7, access: `limited` });
  assert.deepEqual(listFor([own, others, limited], { viewerId: 7 }).map(x => x.id), [`1`]);
  assert.deepEqual(listFor([own]), []);
  assert.equal(listFor([own, others, limited], { tab: `team` }).length, 3);
});

test(`hidden full-access records are omitted from both tabs`, () => {
  const hidden = a({ id: `1`, name: `Hidden`, hidden: true, createdById: 7 });
  assert.deepEqual(listFor([hidden], { tab: `team` }), []);
  assert.deepEqual(listFor([hidden], { viewerId: 7 }), []);
});

test(`pagination uses 25 rows and clamps invalid host input`, () => {
  const rows = Array.from({ length: 52 }, (_, i) => a({ id: String(i), name: `Row ${i}` }));
  const one = listPage(rows, { tab: `team` });
  const two = listPage(rows, { tab: `team`, page: 2 });
  assert.equal(one.items.length, 25);
  assert.equal(two.items[0]?.id, `25`);
  assert.equal(two.pages, 3);
  assert.deepEqual(listPage(rows, { tab: `team`, page: 99 }).items.map(x => x.id), [`50`, `51`]);
  for (const page of [NaN, Infinity, -1, 0, 1.5]) {
    assert.equal(listPage(rows, { tab: `team`, page }).page, 1);
  }
  const narrowed = listPage(rows, { tab: `team`, page: 3, search: `Row 51` });
  assert.equal(narrowed.page, 1);
  assert.equal(narrowed.items[0]?.id, `51`);
});
