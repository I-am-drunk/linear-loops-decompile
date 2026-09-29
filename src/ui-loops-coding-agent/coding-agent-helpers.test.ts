/**
 * Golden test (G0 acceptance bar): our clean module's output, projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the declared observation driver), must
 * byte-match the committed corpus-executed golden, region by region.
 *
 * The projection mirrors the golden driver exactly: the driver's icon
 * projection maps element type → stub identity; here the same identities are
 * passed as plain values through iconFor, so the mapping fact byte-matches.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  CodingAgentRepoHelper,
  CodingAgentSettingsHelper,
} from "./coding-agent-helpers.ts";

type TaggedObject = { tag: string; properties: Array<{ key: string; value: unknown }> };
const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, `golden`, `coding-agent-model-select.statics.expected.json`), `utf8`),
) as { provenance: { serializer: string }; output: TaggedObject };

function region(obj: TaggedObject, key: string): unknown {
  const hit = obj.properties.find((p) => p.key === key);
  assert.notEqual(hit, undefined, `golden region ${key} missing`);
  return hit?.value;
}
const goldenRepo = region(golden.output, `repo`) as TaggedObject;
const goldenHelper = region(golden.output, `helper`) as TaggedObject;

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`repo helper byte-matches the golden (hostName/fullName/label both branches)`, () => {
  const ours = serialize({
    hostName: CodingAgentRepoHelper.hostName({ baseUrl: `https://GitHub.COM/linear/linear` }),
    fullName: CodingAgentRepoHelper.fullName({ owner: `linear`, name: `linear` }),
    labelGithub: CodingAgentRepoHelper.label({ owner: `linear`, name: `linear`, baseUrl: `https://github.com/linear/linear` }),
    labelOtherHost: CodingAgentRepoHelper.label({ owner: `acme`, name: `app`, baseUrl: `https://Git.Acme.dev/acme/app` }),
  });
  assert.equal(bytes(ours), bytes(goldenRepo));
});

test(`settings helper values byte-match the golden (sizes/harnesses/descriptions)`, () => {
  for (const key of [`sandboxSizes`, `harnesses`, `descriptions`] as const) {
    const ours = serialize(CodingAgentSettingsHelper[key]);
    assert.equal(bytes(ours), bytes(region(goldenHelper, key)), key);
  }
});

test(`labels byte-match the golden incl. the passthrough default`, () => {
  const ours = serialize({
    claude: CodingAgentSettingsHelper.label(`claude`),
    codex: CodingAgentSettingsHelper.label(`codex`),
    openSource: CodingAgentSettingsHelper.label(`open-source`),
    passthroughDefault: CodingAgentSettingsHelper.label(`some-future-harness`),
  });
  assert.equal(bytes(ours), bytes(region(goldenHelper, `labels`)));
});

test(`autoPreference byte-matches the golden incl. the throw message`, () => {
  let throwMessage: string | null = null;
  try {
    CodingAgentSettingsHelper.autoPreference(`not-a-harness`);
  } catch (e) {
    throwMessage = (e as Error).message;
  }
  const ours = serialize({
    claude: CodingAgentSettingsHelper.autoPreference(`claude`),
    codex: CodingAgentSettingsHelper.autoPreference(`codex`),
    openSource: CodingAgentSettingsHelper.autoPreference(`open-source`),
    throwMessage,
  });
  assert.equal(bytes(ours), bytes(region(goldenHelper, `autoPreference`)));
});

test(`harness→icon mapping byte-matches the golden (identity mapping + null + passthrough)`, () => {
  // The golden's icon regions record the driver's projection {type, props};
  // our mapping supplies the same identities, so the fact byte-matches.
  const icons = {
    claude: { type: `stub:ClaudeIcon(vI)`, props: {} },
    codex: { type: `stub:CodexIcon(yI)`, props: {} },
  };
  const ours = serialize({
    claude: CodingAgentSettingsHelper.iconFor(`claude`, icons),
    codex: CodingAgentSettingsHelper.iconFor(`codex`, icons),
    openSource: CodingAgentSettingsHelper.iconFor(`open-source`, icons),
    passthroughDefault: CodingAgentSettingsHelper.iconFor(`literal-passthrough`, icons),
  });
  assert.equal(bytes(ours), bytes(region(goldenHelper, `icons`)));
});

test(`default model description byte-matches the golden`, () => {
  const ours = serialize(CodingAgentSettingsHelper.modelDescriptionDefault());
  assert.equal(bytes(ours), bytes(region(goldenHelper, `modelDescriptionDefault`)));
});
