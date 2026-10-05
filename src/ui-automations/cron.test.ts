/** AU3: cron validation from the POSIX/Vixie spec. Pure. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { daysAreUnion, MACROS, validateCron } from "./cron.ts";

const bad = (e: string): string => {
  const v = validateCron(e);
  assert.equal(v.ok, false, `expected refusal: ${JSON.stringify(e)}`);
  return v.ok ? `` : v.detail;
};

test(`every Vixie macro expands to a valid five-field form`, () => {
  for (const [macro, fields] of Object.entries(MACROS)) {
    const v = validateCron(macro);
    assert.ok(v.ok, macro);
    if (v.ok) {
      assert.equal(v.fields, fields);
      assert.equal(v.macro, macro);
      assert.ok(validateCron(fields).ok, `expansion of ${macro} must itself validate`);
    }
  }
});

test(`@daily and "0 0 * * *" normalize to the SAME fields — identity is by meaning`, () => {
  const a = validateCron(`@daily`);
  const b = validateCron(`0 0 * * *`);
  assert.ok(a.ok && b.ok && a.fields === b.fields);
});

test(`whitespace runs collapse, so formatting is not identity`, () => {
  const v = validateCron(`  0   9  *  *   1-5 `);
  assert.ok(v.ok && v.fields === `0 9 * * 1-5`);
});

test(`lists, ranges and steps parse; bounds are per field`, () => {
  assert.ok(validateCron(`*/15 9-17 1,15 * 1-5`).ok);
  assert.ok(validateCron(`0 0 1 1 7`).ok, `7 is Sunday too (Vixie)`);
  assert.match(bad(`60 * * * *`), /minute: 60 outside 0-59/);
  assert.match(bad(`0 24 * * *`), /hour: 24 outside 0-23/);
  assert.match(bad(`0 0 0 * *`), /dayOfMonth: 0 outside 1-31/);
  assert.match(bad(`0 0 * 13 *`), /month: 13 outside 1-12/);
  assert.match(bad(`0 0 * * 8`), /dayOfWeek: 8 outside 0-7/);
});

test(`malformed input names the fault, never throws`, () => {
  assert.match(bad(``), /empty/);
  assert.match(bad(`* * * *`), /expected 5 fields, got 4/);
  assert.match(bad(`* * * * * *`), /expected 5 fields, got 6/);
  assert.match(bad(`@fortnightly`), /unknown macro/);
  assert.match(bad(`1-0 * * * *`), /runs backwards/);
  assert.match(bad(`*/0 * * * *`), /step of 0/);
  assert.match(bad(`a * * * *`), /cannot parse "a"/);
});

test(`the DOM/DOW OR rule: both restricted means EITHER matches, not both`, () => {
  // POSIX: `0 9 13 * 5` is "the 13th, and also every Friday" — NOT "Friday
  // the 13th". The scheduler slice must honour this; the predicate is here
  // so it cannot be forgotten.
  assert.equal(daysAreUnion(`0 9 13 * 5`), true);
  assert.equal(daysAreUnion(`0 9 13 * *`), false, `only DOM restricted`);
  assert.equal(daysAreUnion(`0 9 * * 5`), false, `only DOW restricted`);
  assert.equal(daysAreUnion(`0 9 * * *`), false);
});
