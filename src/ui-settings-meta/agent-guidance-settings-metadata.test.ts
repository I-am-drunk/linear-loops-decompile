/**
 * Golden test (the G0 acceptance bar): our clean module's observable surface,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver) and the SAME projection the committed drive-mode driver used
 * (golden/agent-guidance-driver.mjs), must byte-match the committed
 * corpus-executed golden. The probe fixtures here mirror the driver
 * line-for-line so the two sides observe identical shapes.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  agentGuidanceSettingsMetadata,
  type AgentAppUser,
  type AgentGuidanceSettingsMetadata,
} from "./agent-guidance-settings-metadata.ts";

const goldenPath = join(import.meta.dirname, `golden`, `agent-guidance-settings.metadata.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: unknown;
};

/** The same probe fixtures the corpus-side driver applies (kept in sync by
 * the byte-compare itself: a divergence changes the projected keys). */
const probeOrgs: Record<string, AgentAppUser[]> = {
  activeWithOauthClientId: [{ isActive: true, oauthClientId: `oauth-client-1` }],
  activeWithNullOauthClientId: [{ isActive: true, oauthClientId: null }],
  activeWithEmptyOauthClientId: [{ isActive: true, oauthClientId: `` }],
  inactiveWithOauthClientId: [{ isActive: false, oauthClientId: `oauth-client-1` }],
  noAgentAppUsers: [],
  mixedListOneQualifies: [
    { isActive: false, oauthClientId: `oauth-client-1` },
    { isActive: true, oauthClientId: null },
    { isActive: true, oauthClientId: `oauth-client-2` },
  ],
};

function project(metadata: AgentGuidanceSettingsMetadata): unknown {
  const { applicable, ...data } = metadata;
  return {
    data,
    applicable: Object.fromEntries(
      Object.entries(probeOrgs).map(([name, agentAppUsers]) => [
        name,
        applicable({ organization: { agentAppUsers } }),
      ]),
    ),
  };
}

/** The same module-surface projection the corpus-side driver applies. */
function surface(): unknown {
  return {
    team: project(agentGuidanceSettingsMetadata(`team`)),
    workspace: project(agentGuidanceSettingsMetadata(`workspace`)),
    nonTeamScopeFallsThroughToWorkspaceId: agentGuidanceSettingsMetadata(`anything-else`).id,
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
