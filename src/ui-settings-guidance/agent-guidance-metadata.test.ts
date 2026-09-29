/**
 * Golden test (the G0 acceptance bar): our clean module's observable surface,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver) and the SAME projection the committed drive-mode driver used
 * (golden/agent-guidance-metadata-driver.mjs), must byte-match the committed
 * corpus-executed golden. The projection here mirrors the driver
 * line-for-line so the two sides observe identical shapes.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { agentGuidanceSettingsMetadata, type AgentGuidanceSettingsMetadata, type OrganizationWithAgentAppUsers } from "./agent-guidance-metadata.ts";

const goldenPath = join(import.meta.dirname, `golden`, `agent-guidance-metadata.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: unknown;
};

/** The same org fixtures and projection the corpus-side driver applies. */
const orgs: Record<string, OrganizationWithAgentAppUsers> = {
  noAgents: { agentAppUsers: [] },
  activeWithClient: { agentAppUsers: [{ isActive: true, oauthClientId: `client-1` }] },
  activeWithoutClient: { agentAppUsers: [{ isActive: true, oauthClientId: null }] },
  inactiveWithClient: { agentAppUsers: [{ isActive: false, oauthClientId: `client-2` }] },
  mixedSecondQualifies: { agentAppUsers: [{ isActive: false, oauthClientId: `client-3` }, { isActive: true, oauthClientId: `client-4` }] },
};

function project(metadata: AgentGuidanceSettingsMetadata): unknown {
  return {
    id: metadata.id,
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    ownKeys: Object.keys(metadata),
    applicable: Object.fromEntries(
      Object.entries(orgs).map(([name, organization]) => [name, metadata.applicable({ organization })]),
    ),
  };
}

function surface(): unknown {
  return {
    team: project(agentGuidanceSettingsMetadata(`team`)),
    workspace: project(agentGuidanceSettingsMetadata(`workspace`)),
    nonTeamStringTakesWorkspaceBranch: agentGuidanceSettingsMetadata(`Team`).id,
    undefinedTakesWorkspaceBranch: agentGuidanceSettingsMetadata(undefined).id,
  };
}

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (factory surface)`, () => {
  const ours = serialize(surface());
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
});
