/**
 * Golden test (the G0 acceptance bar): our clean module's observable surface,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver) and the SAME projection the committed drive-mode driver used
 * (golden/new-agent-issuer-metadata-driver.mjs), must byte-match the
 * committed corpus-executed golden region by region. The entry's
 * export-name surface (ownExportNames) is a corpus-side fact with no
 * reimplementation counterpart in this slice (the Component export is
 * declared GAP), so the test asserts it against the literal names instead.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  newAgentIssuerPageMetadata,
  newAgentIssuerComponentDisplayName,
} from "./new-agent-issuer-metadata.ts";

const goldenPath = join(import.meta.dirname, `golden`, `new-agent-issuer.metadata.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: { properties: Array<{ key: string; value: unknown }> };
};

const region = (key: string): string =>
  JSON.stringify(golden.output.properties.find((p) => p.key === key)?.value);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean metadata literal byte-matches the corpus-executed golden (value + key order + ownKeys)`, () => {
  assert.equal(JSON.stringify(serialize(newAgentIssuerPageMetadata)), region(`pageMetadata`));
  assert.equal(JSON.stringify(serialize(Object.keys(newAgentIssuerPageMetadata))), region(`ownKeys`));
});

test(`the component displayName fact matches the golden`, () => {
  assert.equal(JSON.stringify(serialize(newAgentIssuerComponentDisplayName)), region(`componentDisplayName`));
});

test(`the corpus entry's export-name surface is the declared two exports`, () => {
  assert.equal(
    region(`ownExportNames`),
    JSON.stringify(serialize([`Component`, `pageMetadata`])),
  );
});
