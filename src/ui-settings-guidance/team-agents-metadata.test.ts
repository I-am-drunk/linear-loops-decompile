/**
 * Golden test (the G0 acceptance bar): our clean module, driven with the SAME
 * seam marker and probes the committed drive-mode driver used
 * (golden/team-agents-metadata-driver.mjs, mirrored line-for-line) and
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with, must byte-match the committed corpus-executed golden.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { teamAgentsPageMetadata } from "./team-agents-metadata.ts";

const goldenPath = join(import.meta.dirname, `golden`, `team-agents.metadata.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: unknown;
};

/** The driver's function projection, verbatim. */
function project(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(project);
  if (node === null || typeof node !== `object`) return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = typeof v === `function` ? `<function:${k}>` : project(v);
  return out;
}

/** The same projection + probes the corpus-side driver applies. */
function surface(): unknown {
  const metadata = teamAgentsPageMetadata(`stub:ContextualMenuActions.uP(DocsLink)`);
  const guidance = metadata.sections.agentGuidance;
  const user = (active: boolean, clientId: string | null): { isActive: boolean; oauthClientId: string | null } => ({
    isActive: active,
    oauthClientId: clientId,
  });
  return {
    metadata: project(metadata),
    ownKeys: Object.keys(metadata),
    sectionsOwnKeys: Object.keys(metadata.sections),
    agentGuidanceApplicable: {
      activeWithClientId: guidance.applicable({ organization: { agentAppUsers: [user(true, `client-1`)] } }),
      activeWithoutClientId: guidance.applicable({ organization: { agentAppUsers: [user(true, null)] } }),
      inactiveWithClientId: guidance.applicable({ organization: { agentAppUsers: [user(false, `client-1`)] } }),
      empty: guidance.applicable({ organization: { agentAppUsers: [] } }),
    },
  };
}

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (fragment metadata + cross-chunk guidance section)`, () => {
  const ours = serialize(surface());
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
});
