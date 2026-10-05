/** AU1 rendering: rows, escaping, the two empty states, toolbar state. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { renderEmpty, renderList, renderRow, toolsOf } from "./render.ts";
import type { AutomationSummary } from "./model.ts";

const a = (over: Partial<AutomationSummary> & { id: string; name: string }): AutomationSummary => ({
  enabled: true, model: `gpt-4o`, createdBy: `tj`, tools: [], triggerCount: 1, ...over,
});

test(`a hostile automation name cannot inject markup`, () => {
  const html = renderRow(a({ id: `1`, name: `<script>go()</script>` }));
  assert.ok(!html.includes(`<script>`), html);
  assert.ok(html.includes(`&lt;script&gt;`));
});

test(`row shows model, creator and a pluralized trigger count`, () => {
  assert.ok(renderRow(a({ id: `1`, name: `X`, triggerCount: 1 })).includes(`1 trigger<`));
  assert.ok(renderRow(a({ id: `1`, name: `X`, triggerCount: 3 })).includes(`3 triggers<`));
});

test(`tool chips cap at two plus a count, so one row cannot set the height`, () => {
  const html = renderRow(a({ id: `1`, name: `X`, tools: [`a`, `b`, `c`, `d`] }));
  assert.equal(html.match(/class="a-chip"/g)?.length, 2);
  assert.ok(html.includes(`+2`));
});

test(`no tools and never-run read as states, not blanks`, () => {
  const html = renderRow(a({ id: `1`, name: `X` }));
  assert.ok(html.includes(`No tools`));
  assert.ok(html.includes(`Never run`));
});

test(`a last run renders its status badge`, () => {
  const html = renderRow(a({ id: `1`, name: `X`, lastRun: { status: `failed`, at: `2m ago` } }));
  assert.ok(html.includes(`a-failed`) && html.includes(`Failed`) && html.includes(`2m ago`));
});

test(`the filtered empty state does NOT offer to create`, () => {
  const html = renderEmpty(true);
  assert.ok(html.includes(`No matches`));
  assert.ok(html.includes(`data-act="clearFilters"`));
  // Ten automations may exist behind the filter; offering "New automation"
  // here answers a question the user did not ask.
  assert.ok(!html.includes(`data-act="create"`), html);
});

test(`the true empty state is an onboarding moment with one button`, () => {
  const html = renderEmpty(false);
  assert.ok(html.includes(`No automations yet`));
  assert.ok(html.includes(`data-act="create"`));
  assert.ok(!html.includes(`clearFilters`));
});

test(`a query that hides every row gets the dead-end state, not onboarding`, () => {
  const rows = [a({ id: `1`, name: `Nightly` })];
  const html = renderList(rows, { search: `nothing matches this` });
  // The distinction keys off the UNFILTERED set, which is the bug worth
  // pinning: `shown.length === 0` alone would show onboarding here.
  assert.ok(html.includes(`No matches`), html.slice(0, 200));
  assert.ok(!html.includes(`No automations yet`));
});

test(`an actually empty list gets onboarding`, () => {
  assert.ok(renderList([], {}).includes(`No automations yet`));
});

test(`toolbar reflects current query state`, () => {
  const rows = [a({ id: `1`, name: `X`, tools: [`github`] })];
  const html = renderList(rows, { search: `nig`, enabled: false, tool: `github` });
  assert.ok(html.includes(`value="nig"`));
  assert.ok(html.includes(`<option value="off" selected>Disabled</option>`));
  assert.ok(html.includes(`<option value="github" selected>github</option>`));
});

test(`toolsOf is the deduplicated sorted union across rows`, () => {
  const rows = [
    a({ id: `1`, name: `A`, tools: [`slack`, `github`] }),
    a({ id: `2`, name: `B`, tools: [`github`] }),
  ];
  assert.deepEqual(toolsOf(rows), [`github`, `slack`]);
});

test(`rows render in list order: enabled first`, () => {
  const html = renderList([
    a({ id: `1`, name: `Alpha`, enabled: false }),
    a({ id: `2`, name: `Zulu`, enabled: true }),
  ]);
  assert.ok(html.indexOf(`Zulu`) < html.indexOf(`Alpha`));
});

test(`delete is the only action marked dangerous`, () => {
  const html = renderRow(a({ id: `1`, name: `X` }));
  assert.equal(html.match(/a-danger/g)?.length, 1);
  assert.ok(html.includes(`data-act="delete"`));
});

test(`no colour literal anywhere in the stylesheet`, async () => {
  const { AUTOMATIONS_CSS } = await import("./style.css.ts");
  const bad = AUTOMATIONS_CSS.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g);
  assert.equal(bad, null, `colour literals: ${bad?.join(`, `)}`);
  assert.ok(AUTOMATIONS_CSS.includes(`var(--t-labelBase)`));
});

test(`the SPACE ladder is shared with ui-settings, not re-invented`, async () => {
  const [auto, settings] = await Promise.all([import("./style.css.ts"), import("../ui-settings/style.css.ts")]);
  // One ladder across the app is what makes surfaces look related; a second
  // copy would drift. Assert the import is live rather than duplicated.
  assert.ok(auto.AUTOMATIONS_CSS.includes(`padding:${settings.SPACE.md} ${settings.SPACE.lg}`));
});
