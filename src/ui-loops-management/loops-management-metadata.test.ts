/**
 * Golden test (the G0 acceptance bar): the clean literal must byte-match BOTH
 * committed corpus-executed goldens' metadata regions (the page chunk's and
 * the shim's — themselves byte-equal, the alias adds no behavior), through
 * the SAME tagged-v2 grammar; the alias identity is asserted on both sides.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { loopsManagementPageMetadata, pageMetadata } from "./loops-management-metadata.ts";

const read = (name: string): { provenance: { serializer: string }; output: { properties: Array<{ key: string; value: unknown }> } } =>
  JSON.parse(readFileSync(join(import.meta.dirname, `golden`, name), `utf8`)) as never;

const target = read(`loops-management.metadata.expected.json`);
const shim = read(`loops-management.shim.expected.json`);
const region = (g: typeof target, key: string): string => JSON.stringify(g.output.properties.find((p) => p.key === key)?.value);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(target.provenance.serializer, SERIALIZER_VERSION);
  assert.equal(shim.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean metadata literal byte-matches both corpus-executed goldens (value + key order)`, () => {
  const ours = JSON.stringify(serialize(loopsManagementPageMetadata));
  assert.equal(ours, region(target, `pageMetadata`));
  assert.equal(ours, region(shim, `pageMetadata`));
  assert.equal(JSON.stringify(serialize(Object.keys(loopsManagementPageMetadata))), region(target, `ownKeys`));
});

test(`the shim name is the exact page constant (the corpus alias, mirrored)`, () => {
  assert.equal(pageMetadata, loopsManagementPageMetadata);
});
