/** AU3: the trigger list — dedupe by meaning, validation, the section. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, makeRegistry } from "./detail.ts";
import { addTrigger, removeTrigger, TRIGGERS_KEY, TRIGGERS_SECTION, triggerKey, triggersOf, type Trigger } from "./triggers.ts";

const sched = (cron: string, timezone?: string): Trigger =>
  timezone === undefined ? { kind: `schedule`, cron } : { kind: `schedule`, cron, timezone };

test(`@daily and "0 0 * * *" are the SAME trigger — dedupe is by meaning`, () => {
  const a = addTrigger([], sched(`@daily`));
  assert.ok(a.ok);
  const b = a.ok ? addTrigger(a.triggers, sched(`0 0 * * *`)) : a;
  // Two identical schedules would fire the automation twice for one tick.
  assert.equal(b.ok === false && b.reason, `duplicate`);
});

test(`whitespace differences are not a different trigger`, () => {
  assert.equal(triggerKey(sched(`0 9 * * *`)), triggerKey(sched(`  0  9 * *  * `)));
});

test(`timezone IS part of identity — 09:00 Oslo and 09:00 Tokyo differ`, () => {
  const a = addTrigger([], sched(`0 9 * * *`, `Europe/Oslo`));
  const b = a.ok ? addTrigger(a.triggers, sched(`0 9 * * *`, `Asia/Tokyo`)) : a;
  assert.ok(b.ok && b.triggers.length === 2);
});

test(`manual is a singleton — a second manual trigger is a duplicate`, () => {
  const a = addTrigger([], { kind: `manual` });
  const b = a.ok ? addTrigger(a.triggers, { kind: `manual` }) : a;
  assert.equal(b.ok === false && b.reason, `duplicate`);
});

test(`an invalid schedule is refused with the validator's detail, before dedupe`, () => {
  const r = addTrigger([], sched(`60 * * * *`));
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, `invalid`);
    assert.match(r.detail, /minute: 60/);
  }
});

test(`addTrigger and removeTrigger return NEW lists and leave the input alone`, () => {
  const start: Trigger[] = [{ kind: `manual` }];
  const added = addTrigger(start, sched(`@hourly`));
  assert.ok(added.ok && added.triggers.length === 2);
  assert.equal(start.length, 1, `input mutated`);
  const removed = removeTrigger(added.ok ? added.triggers : [], 0);
  assert.deepEqual(removed, [sched(`@hourly`)]);
});

test(`triggersOf tolerates a missing or malformed key`, () => {
  assert.deepEqual(triggersOf({}), []);
  assert.deepEqual(triggersOf({ [TRIGGERS_KEY]: `not a list` }), []);
});

test(`the section registers into AU2's frame and renders live from the draft`, () => {
  const reg = makeRegistry();
  reg.register(TRIGGERS_SECTION);
  const e = makeEditor(reg, { [TRIGGERS_KEY]: [] });

  // Empty: one disabled explanatory row, and nothing else.
  const empty = e.sections()[0];
  assert.equal(empty?.id, `triggers`);
  assert.equal(empty?.rows.length, 1);
  assert.equal(empty?.rows[0]?.disabled, true);

  // Add two triggers through the editor; the section reflects them and is dirty.
  const next = addTrigger([], sched(`@daily`, `Europe/Oslo`));
  const next2 = next.ok ? addTrigger(next.triggers, { kind: `manual` }) : next;
  assert.ok(next2.ok);
  if (next2.ok) e.set(TRIGGERS_KEY, next2.triggers);
  const rows = e.sections()[0]?.rows ?? [];
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.label, `Schedule`);
  assert.equal(rows[0]?.kind === `connection` && rows[0].detail, `@daily · Europe/Oslo`);
  assert.equal(rows[1]?.label, `Manual`);
  assert.deepEqual(e.dirtySections(), [`triggers`]);
});
