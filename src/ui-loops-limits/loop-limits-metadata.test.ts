/**
 * Golden test (the G0 acceptance bar): our clean module, projected with the
 * SAME driver shape (golden/loop-limits-metadata-driver.mjs, mirrored) through
 * the SAME tagged-v2 grammar, must byte-match the committed corpus-executed
 * golden's value regions; the alias identity is asserted on both sides.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { loopLimitsPageMetadata, loopSpendLimitsMetadata } from "./loop-limits-metadata.ts";

const goldenPath = join(import.meta.dirname, `golden`, `loop-limits.metadata.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: { properties: Array<{ key: string; value: unknown }> };
};

const region = (key: string): string => JSON.stringify(golden.output.properties.find((p) => p.key === key)?.value);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean metadata literal byte-matches the corpus-executed golden (value + key order)`, () => {
  assert.equal(JSON.stringify(serialize(loopLimitsPageMetadata)), region(`pageMetadata`));
  assert.equal(JSON.stringify(serialize(Object.keys(loopLimitsPageMetadata))), region(`ownKeys`));
});

test(`the page-level name is the exact usage-subpage constant (the corpus Z=V alias, mirrored)`, () => {
  assert.equal(loopLimitsPageMetadata, loopSpendLimitsMetadata);
});
