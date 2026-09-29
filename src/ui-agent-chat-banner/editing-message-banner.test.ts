/**
 * Golden test (the G0 acceptance bar): our clean module's output, projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the declared observation driver), must
 * byte-match the committed corpus-executed golden. The icon argument is the
 * same string marker the corpus case's declared stub used, so the byte oracle
 * covers the seam props too.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { EditingMessageBanner } from "./editing-message-banner.ts";

type TaggedObject = { tag: string; properties: Array<{ key: string; value: unknown }> };
const golden = JSON.parse(readFileSync(join(import.meta.dirname, `golden`, `editing-message-banner.expected.json`), `utf8`)) as {
  provenance: { serializer: string };
  output: TaggedObject;
};

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden`, () => {
  const banner = golden.output.properties.find((p) => p.key === `banner`);
  assert.notEqual(banner, undefined);
  const ours = serialize({ banner: EditingMessageBanner(`stub:ContextualMenuActions.rL(EditIcon)`) });
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
});

test(`the icon seam flows through: a different icon component changes exactly the icon element type`, () => {
  const a = JSON.stringify(serialize(EditingMessageBanner(`icon-a`)));
  const b = JSON.stringify(serialize(EditingMessageBanner(`icon-b`)));
  assert.notEqual(a, b);
  assert.equal(a.replace(`icon-a`, `icon-b`), b);
});
