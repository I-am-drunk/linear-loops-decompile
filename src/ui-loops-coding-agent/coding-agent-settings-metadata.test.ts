/**
 * Golden test (the G0 acceptance bar): our clean module, driven with the SAME
 * seam markers and probes the committed drive-mode driver used
 * (golden/coding-agent-settings-metadata-driver.mjs, mirrored line-for-line)
 * and projected through the SAME tagged-v2 grammar, must byte-match the
 * committed corpus-executed golden.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { codingAgentSettingsMetadata, type FeatureAccessOrganization } from "./coding-agent-settings-metadata.ts";

const goldenPath = join(import.meta.dirname, `golden`, `coding-agent-settings-metadata.expected.json`);
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
  const askedFlags: string[] = [];
  let flagValue = true;
  const metadata = codingAgentSettingsMetadata(`stub:ContextualMenuActions.uP(DocsLink)`, {
    codeSandboxSizing: `flag:codeSandboxSizing`,
    isEnabled: (flag) => { askedFlags.push(flag); return flagValue; },
  });
  const items = metadata.sections.general.items;

  const org = (grants: string[]): { asked: string[]; organization: FeatureAccessOrganization } => {
    const asked: string[] = [];
    return { asked, organization: { canAccess: (k) => { asked.push(k); return grants.includes(k); } } };
  };
  const both = org([`codingSessions`, `agentAutomations`]);
  const onlyCoding = org([`codingSessions`]);
  const onlyAutomations = org([`agentAutomations`]);
  const neither = org([]);
  const lra = items.loopsRepositoryAccess.applicable;
  const loopsRepositoryAccess = {
    both: lra({ organization: both.organization }),
    onlyCoding: lra({ organization: onlyCoding.organization }),
    onlyAutomations: lra({ organization: onlyAutomations.organization }),
    neither: lra({ organization: neither.organization }),
    askedKeysOnBoth: both.asked,
  };

  const rp = items.regionPinning.applicable;
  flagValue = true;
  const whenEnabled = rp();
  flagValue = false;
  const whenDisabled = rp();

  const envApplicable = metadata.sections.environments.applicable;
  const environments = {
    granted: envApplicable({ organization: { canAccess: (k) => k === `codingSessions` } }),
    denied: envApplicable({ organization: { canAccess: () => false } }),
  };

  return {
    metadata: project(metadata),
    ownKeys: Object.keys(metadata),
    sectionsOwnKeys: Object.keys(metadata.sections),
    generalItemsOwnKeys: Object.keys(items),
    probes: {
      loopsRepositoryAccess,
      regionPinning: { whenEnabled, whenDisabled, askedFlags },
      environments,
    },
  };
}

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (fragment metadata + three-chunk composition + probes)`, () => {
  const ours = serialize(surface());
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
});
