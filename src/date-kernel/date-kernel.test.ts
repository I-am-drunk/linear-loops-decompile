/**
 * Golden test (G0 acceptance bar): our clean module's observable behavior,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with, must byte-match the committed corpus-executed golden.
 *
 * The fixture set is byte-identical by construction: this test runs the SAME
 * driver file the golden was recorded with
 * (`golden/date-kernel-driver.mjs`), passing our `installDateKernel` where
 * the corpus sandbox passed the real `fe` export — the driver's whole
 * contract is `entry.$` = the installer. Any divergence between our
 * arithmetic and the corpus's shows up as a byte diff.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  BUSINESS_DAY_OUT_OF_BOUNDS_MESSAGE,
  INVALID_WORK_DAYS_MESSAGE,
  installDateKernel,
  midnight,
  nearestMidnight,
  offsetByDays,
  offsetByHours,
  toLocalDate,
  toTimelessDate,
} from "./date-kernel.ts";

const goldenDir = join(import.meta.dirname, `golden`);
const golden = JSON.parse(readFileSync(join(goldenDir, `date-kernel.cases.expected.json`), `utf8`)) as {
  provenance: { serializer: string };
  output: unknown;
};

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (same driver, our installer)`, async () => {
  const driver = (await import(`./golden/date-kernel-driver.mjs`)) as {
    default: (s: { entry: Record<string, unknown> }) => Promise<unknown>;
  };
  const ours = await driver.default({ entry: { $: installDateKernel } });
  assert.equal(bytes(serialize(ours)), bytes(golden.output));
});

test(`exact throw strings match the corpus literals`, () => {
  assert.equal(INVALID_WORK_DAYS_MESSAGE, `Invalid work days specified`);
  assert.equal(BUSINESS_DAY_OUT_OF_BOUNDS_MESSAGE, `Business day offset out of bounds (>10000000 offset)`);
});

test(`pure functions agree with the installed prototype methods`, () => {
  installDateKernel();
  const d = new Date(2026, 3, 9, 14, 45, 30, 500);
  assert.equal(d.midnight().getTime(), midnight(d).getTime());
  assert.equal(d.nearestMidnight().getTime(), nearestMidnight(d).getTime());
  assert.equal(d.offsetByDays(7).getTime(), offsetByDays(d, 7).getTime());
  assert.equal(d.offsetByHours(-3).getTime(), offsetByHours(d, -3).getTime());
  assert.equal(d.toTimelessDate(), toTimelessDate(d));
  assert.equal(`2026-04-09`.toLocalDate().getTime(), toLocalDate(`2026-04-09`).getTime());
});

test(`install descriptor shape matches the corpus's D helper (non-enumerable, writable, configurable)`, () => {
  installDateKernel();
  const desc = Object.getOwnPropertyDescriptor(Date.prototype, `toTimelessDate`);
  assert.ok(desc);
  assert.equal(desc.enumerable, false);
  assert.equal(desc.writable, true);
  assert.equal(desc.configurable, true);
  // The two spacetime-only methods are deliberately NOT installed (declared
  // out of this slice's scope — module header): absence must be loud.
  assert.equal(Object.getOwnPropertyDescriptor(Date.prototype, `beginningOfWeek`), undefined);
  assert.equal(Object.getOwnPropertyDescriptor(Date.prototype, `nextWeekDay`), undefined);
});
