/**
 * Golden test (G0 acceptance bar): our clean module's projected trees,
 * serialized through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver), must byte-match the committed corpus-executed golden, region by
 * region. Fixtures mirror the golden driver line-for-line.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  AGENT_AUTOMATION_PERMISSIONS_ANCHOR,
  SettingsCard,
  SettingsDescriptionRow,
  SettingsLabeledRow,
  SettingsSection,
} from "./settings-sections.ts";

type TaggedObject = { tag: string; properties: Array<{ key: string; value: unknown }> };
const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, `golden`, `settings-sections.branches.expected.json`), `utf8`),
) as { provenance: { serializer: string }; output: TaggedObject };

function region(obj: TaggedObject, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    const hit = (cur as TaggedObject).properties.find((p) => p.key === key);
    assert.notEqual(hit, undefined, `golden region ${path.join(`.`)} missing at ${key}`);
    cur = hit?.value;
  }
  return cur;
}
const bytes = (v: unknown): string => JSON.stringify(v, null, 2);
const match = (ours: unknown, ...path: string[]): void => {
  assert.equal(bytes(serialize(ours)), bytes(region(golden.output, ...path)), path.join(`.`));
};

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`permissions anchor id byte-matches`, () => {
  match(AGENT_AUTOMATION_PERMISSIONS_ANCHOR, `permissionsAnchorId`);
});

test(`SettingsSection byte-matches (titled+accessory / untitled / titled-no-accessory)`, () => {
  match(SettingsSection({ id: `sec-1`, title: `Pinned title`, accessory: `pin:accessory`, children: `pin:children` }), `section`, `titledWithAccessory`);
  match(SettingsSection({ id: `sec-2`, children: `pin:children` }), `section`, `untitled`);
  match(SettingsSection({ id: `sec-3`, title: `Pinned title`, children: `pin:children` }), `section`, `titledNoAccessory`);
});

test(`SettingsCard byte-matches (plain / flush+sx composition)`, () => {
  match(SettingsCard({ id: `card-1`, children: `pin:children` }), `card`, `plain`);
  match(SettingsCard({ id: `card-2`, flush: true, sx: { pinned: `sx-fixture` }, children: `pin:children` }), `card`, `flushWithSx`);
});

test(`SettingsLabeledRow byte-matches (divided+labelFor+description / plain)`, () => {
  match(
    SettingsLabeledRow({ title: `Pinned row title`, description: `Pinned description`, labelFor: `input-1`, descriptionId: `desc-1`, divided: true, children: `pin:children` }),
    `labeledRow`, `dividedLabeledDescribed`,
  );
  match(SettingsLabeledRow({ title: `Pinned row title`, children: `pin:children` }), `labeledRow`, `plain`);
});

test(`SettingsDescriptionRow byte-matches (divided / undivided)`, () => {
  match(SettingsDescriptionRow({ divided: true, children: `pin:description-children` }), `descriptionRow`, `divided`);
  match(SettingsDescriptionRow({ children: `pin:description-children` }), `descriptionRow`, `undivided`);
});
