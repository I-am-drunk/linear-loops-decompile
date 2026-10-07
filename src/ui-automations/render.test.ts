import assert from "node:assert/strict";
import { test } from "node:test";
import { renderEmpty, renderList, renderRow, renderRowActions } from "./render.ts";
import type { AutomationSummary } from "./model.ts";
const a = (over: Partial<AutomationSummary> = {}): AutomationSummary => ({
  id: `one`, name: `Nightly`, enabled: true, model: `model-not-in-list`,
  createdBy: `Sam`, createdById: 7, tools: [], triggerCount: 123, ...over,
});

test(`user-provided values cannot inject markup`, () => {
  const html = renderRow(a({ id: `" onclick="bad`, name: `<script>bad()</script>`,
    createdBy: `<img src=x onerror=bad()>`, tools: [`<iframe>`] }));
  for (const tag of [`<script>`, `<img`, `<iframe>`]) assert.ok(!html.includes(tag));
  assert.ok(html.includes(`&lt;script&gt;`));
  assert.ok(html.includes(`data-id="&quot; onclick=&quot;bad"`));
});

test(`desktop columns omit model, trigger count and last run`, () => {
  const html = renderList([a({ lastRun: { status: `failed`, at: `last-run-sentinel` } })], { tab: `team` });
  for (const label of [`Name`, `Created By`, `Status`, `Tools`]) assert.ok(html.includes(`>${label}</span>`));
  for (const absent of [`model-not-in-list`, `123 triggers`, `last-run-sentinel`, `Never run`]) assert.ok(!html.includes(absent));
});

test(`reference fallbacks and creation date stay in their own cells`, () => {
  const html = renderRow(a({ name: ``, createdBy: ``, createdAtLabel: `2 days ago`, enabled: false }));
  assert.ok(html.includes(`>Untitled</span>`));
  assert.ok(html.includes(`class="a-author-name">-</span>`));
  assert.ok(html.includes(`class="a-date">2 days ago</span>`));
  assert.ok(html.includes(`>Inactive</span>`));
  assert.ok(renderRow(a({ access: `limited`, createdAtLabel: `secret date` })).includes(`class="a-date">—</span>`));
});

test(`row actions live in a named menu with Delete separated`, () => {
  assert.ok(!renderRow(a()).includes(`role="menuitem"`));
  const html = renderRow(a(), { openMenuFor: `one` }) + renderRowActions(`one`);
  assert.ok(html.includes(`aria-label="More actions"`));
  assert.ok(html.includes(`aria-expanded="true"`));
  assert.ok(html.includes(`aria-label="Row actions"`));
  assert.ok(html.includes(`>Edit Details</button>`));
  assert.ok(html.includes(`role="separator"`));
  assert.equal(html.match(/class="a-danger"/g)?.length, 1);
});

test(`empty search result has no invented explanatory copy or create button`, () => {
  assert.equal(renderEmpty(true), `<div class="a-empty"><div class="a-emptyh">No Results Found</div></div>`);
  const html = renderList([], { search: `missing` });
  assert.ok(html.includes(`No Results Found`));
  assert.ok(!html.includes(`No Automations Yet`));
  assert.ok(!html.includes(`a-headrow`));
});

test(`ordinary empty renders a standalone card and create action`, () => {
  const html = renderEmpty(false);
  assert.ok(html.includes(`No Automations Yet`));
  assert.ok(html.includes(`data-act="create">New Automation`));
  assert.ok(!html.includes(`a-headrow`));
});

test(`toolbar has Mine and Team tabs followed by All Runs and search`, () => {
  const html = renderList([], { tab: `team`, search: `needle` });
  assert.ok(html.includes(`aria-label="Automation filters"`));
  assert.ok(html.includes(`data-tab="team" aria-selected="true"`));
  assert.ok(html.indexOf(`All Runs`) < html.indexOf(`placeholder="Search..."`));
  assert.ok(html.includes(`value="needle"`));
  assert.ok(!html.includes(`<select`));
});

test(`rows preserve source order inside the active and inactive groups`, () => {
  const html = renderList([a({ id: `d`, name: `Disabled`, enabled: false }),
    a({ id: `z`, name: `Zulu` }), a({ id: `a`, name: `Alpha` })], { tab: `team` });
  assert.ok(html.indexOf(`>Zulu</span>`) < html.indexOf(`>Alpha</span>`));
  assert.ok(html.indexOf(`>Alpha</span>`) < html.indexOf(`>Disabled</span>`));
});

test(`pagination is outside the table and reports the visible range`, () => {
  const rows = Array.from({ length: 52 }, (_, i) => a({ id: String(i), name: `Row ${i}` }));
  const html = renderList(rows, { tab: `team`, page: 2 });
  assert.ok(html.includes(`26–50 of 52`));
  assert.ok(html.includes(`2 / 3`));
  assert.ok(html.includes(`aria-label="Previous page"`));
  assert.equal(html.match(/class="a-row"/g)?.length, 25);
  assert.ok(!renderList([a()], { tab: `team` }).includes(`a-pagination`));
});
