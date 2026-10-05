/** AU2: section registry + dirty/save machinery. Pure data, no DOM. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, makeRegistry, type Draft, type SectionSpec } from "./detail.ts";
import type { Row } from "../ui-settings/rows.ts";

const spec = (id: string, order: number, build?: (d: Draft) => Row[]): SectionSpec => ({
  id,
  title: id,
  order,
  build: build ?? (() => []),
});

test(`sections sort by order, not registration sequence`, () => {
  const r = makeRegistry();
  r.register(spec(`tools`, 30));
  r.register(spec(`triggers`, 10));
  r.register(spec(`prompts`, 20));
  assert.deepEqual(r.specs().map((s) => s.id), [`triggers`, `prompts`, `tools`]);
});

test(`equal order keeps registration order, stably across calls`, () => {
  const r = makeRegistry();
  r.register(spec(`b`, 10));
  r.register(spec(`a`, 10));
  assert.deepEqual(r.specs().map((s) => s.id), [`b`, `a`]);
  assert.deepEqual(r.specs().map((s) => s.id), [`b`, `a`]);
});

test(`double registration throws rather than replacing silently`, () => {
  const r = makeRegistry();
  r.register(spec(`x`, 1));
  assert.throws(() => r.register(spec(`x`, 2)), /already registered: x/);
});

test(`a fresh editor is clean, and set() reports whether it changed anything`, () => {
  const e = makeEditor(makeRegistry(), { name: `Nightly` });
  assert.equal(e.dirty(), false);
  assert.equal(e.set(`name`, `Nightly`), false, `no-op set must report false`);
  assert.equal(e.dirty(), false);
  assert.equal(e.set(`name`, `Weekly`), true);
  assert.equal(e.dirty(), true);
});

test(`key ORDER is not a change — canonical comparison, not raw stringify`, () => {
  // A form that rebuilds an object would otherwise report dirty with
  // nothing edited.
  const e = makeEditor(makeRegistry(), { cfg: { a: 1, b: 2 } });
  assert.equal(e.set(`cfg`, { b: 2, a: 1 }), false);
  assert.equal(e.dirty(), false);
});

test(`nested key order is also not a change`, () => {
  const e = makeEditor(makeRegistry(), { t: [{ kind: `cron`, at: `9` }] });
  assert.equal(e.set(`t`, [{ at: `9`, kind: `cron` }]), false);
});

test(`array ORDER is a change — reordering chain steps is a real edit`, () => {
  const e = makeEditor(makeRegistry(), { steps: [`a`, `b`] });
  assert.equal(e.set(`steps`, [`b`, `a`]), true);
  assert.equal(e.dirty(), true);
});

test(`commit makes the draft the new baseline; discard restores it`, () => {
  const e = makeEditor(makeRegistry(), { name: `A` });
  e.set(`name`, `B`);
  e.commit();
  assert.equal(e.dirty(), false);
  assert.equal(e.saved()[`name`], `B`);
  e.set(`name`, `C`);
  e.discard();
  assert.equal(e.dirty(), false);
  assert.equal(e.draft()[`name`], `B`, `discard must restore the committed value`);
});

test(`mutating the caller's initial object cannot make a dirty draft look clean`, () => {
  const initial: Draft = { name: `A` };
  const e = makeEditor(makeRegistry(), initial);
  initial[`name`] = `hijacked`;
  assert.equal(e.saved()[`name`], `A`, `baseline must be a deep copy`);
  assert.equal(e.dirty(), false);
});

test(`dirtySections names only the sections whose ROWS changed`, () => {
  const r = makeRegistry();
  r.register(spec(`triggers`, 10, (d) => [
    { kind: `toggle`, id: `on`, label: `Enabled`, on: Boolean(d[`enabled`]) },
  ]));
  r.register(spec(`prompts`, 20, (d) => [
    { kind: `text`, id: `p`, label: `Prompt`, value: String(d[`prompt`] ?? ``) },
  ]));
  const e = makeEditor(r, { enabled: false, prompt: `hi` });

  assert.deepEqual(e.dirtySections(), []);
  e.set(`enabled`, true);
  assert.deepEqual(e.dirtySections(), [`triggers`], `a prompt edit did not happen`);
  e.set(`prompt`, `bye`);
  assert.deepEqual(e.dirtySections(), [`triggers`, `prompts`]);
});

test(`a field no section reads is still dirty on the draft, named by none`, () => {
  const r = makeRegistry();
  r.register(spec(`triggers`, 10, () => []));
  const e = makeEditor(r, { hidden: 1 });
  e.set(`hidden`, 2);
  assert.equal(e.dirty(), true, `the draft changed`);
  assert.deepEqual(e.dirtySections(), [], `no section renders it`);
});

test(`sections() builds from the CURRENT draft and is shell-shaped`, () => {
  const r = makeRegistry();
  r.register(spec(`triggers`, 10, (d) => [
    { kind: `toggle`, id: `on`, label: `Enabled`, on: Boolean(d[`enabled`]) },
  ]));
  const e = makeEditor(r, { enabled: false });
  const before = e.sections();
  assert.equal(before[0]?.id, `triggers`);
  assert.equal(before[0]?.rows[0]?.kind === `toggle` && before[0].rows[0].on, false);
  e.set(`enabled`, true);
  const after = e.sections();
  assert.equal(after[0]?.rows[0]?.kind === `toggle` && after[0].rows[0].on, true);
});
