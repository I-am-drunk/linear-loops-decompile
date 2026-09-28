/**
 * Golden test (the G0 acceptance bar): our clean module's observable surface,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver) and the SAME projection the committed drive-mode driver used
 * (golden/agent-issuers-metadata-driver.mjs), must byte-match the committed
 * corpus-executed golden's value regions.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  agentIssuersPageMetadata,
  agentIssuersComponentDisplayName,
} from "./agent-issuers-metadata.ts";

const goldenPath = join(import.meta.dirname, `golden`, `agent-issuers.metadata.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: { properties: Array<{ key: string; value: unknown }> };
};

const region = (key: string): string => {
  const p = golden.output.properties.find((p) => p.key === key);
  assert.ok(p, `golden region ${key} exists`);
  return JSON.stringify(p.value);
};

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean metadata literal byte-matches the corpus-executed golden (value + key order + ownKeys pins)`, () => {
  const m = agentIssuersPageMetadata;
  assert.equal(JSON.stringify(serialize(m)), region(`pageMetadata`));
  assert.equal(JSON.stringify(serialize(Object.keys(m))), region(`ownKeys`));
  assert.equal(JSON.stringify(serialize(Object.keys(m.sections))), region(`sectionsOwnKeys`));
  assert.equal(JSON.stringify(serialize(Object.keys(m.sections.configured))), region(`configuredOwnKeys`));
  assert.equal(JSON.stringify(serialize(Object.keys(m.sections.add))), region(`addOwnKeys`));
});

test(`component displayName matches the corpus module-eval fact`, () => {
  assert.equal(JSON.stringify(serialize(agentIssuersComponentDisplayName)), region(`componentDisplayName`));
});
