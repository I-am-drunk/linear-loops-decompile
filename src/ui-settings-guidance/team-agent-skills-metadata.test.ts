/**
 * Golden test (the G0 acceptance bar): our clean module's observable surface,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver) and the SAME projection the committed drive-mode driver used
 * (golden/team-agent-skills-driver.mjs), must byte-match the committed
 * corpus-executed golden.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  teamAgentSkillsPageMetadata,
  teamAgentSkillsComponentDisplayName,
} from "./team-agent-skills-metadata.ts";

const goldenPath = join(import.meta.dirname, `golden`, `team-agent-skills.metadata.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: unknown;
};

/** The same module-surface projection the corpus-side driver applies. */
function surface(): unknown {
  return {
    pageMetadata: teamAgentSkillsPageMetadata,
    componentDisplayName: teamAgentSkillsComponentDisplayName,
  };
}

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (metadata surface)`, () => {
  const ours = serialize(surface());
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
});
