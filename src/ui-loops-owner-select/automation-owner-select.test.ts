/**
 * Golden test (the G0 acceptance bar): our clean module, driven with the SAME
 * fixtures and seam markers the committed drive-mode driver used
 * (golden/owner-select-driver.mjs, mirrored line-for-line) and projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the declared observation driver), must
 * byte-match the committed corpus-executed golden.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  renderAutomationOwnerSelect,
  type OwnerAccess,
  type OwnerSelectSeams,
  type OwnerSelectRendering,
} from "./automation-owner-select.ts";

const goldenPath = join(import.meta.dirname, `golden`, `owner-select.branches.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: unknown;
};

/** The driver's seam markers (the golden's stub values), verbatim. */
const seams: OwnerSelectSeams = {
  usersTooltip: `stub:ContextualMenuActions.v_(users-tooltip)`,
  propertyTrigger: `stub:ContextualMenuActions.K_(property-trigger)`,
  actionTrigger: `stub:ActionTrigger.t`,
  button: `stub:Button.t`,
  text: `stub:Text.t`,
  avatar: `stub:Avatar.t(Avatar)`,
  userName: `stub:Avatar.Ht(UserName)`,
  secondaryAction: `stub:ContextualMenuActions.E_(secondary-action)`,
  baseAction: { id: `stub:ContextualMenuActions.lt(change-owner-action)` },
};

/** The driver's function projection, verbatim. */
function project(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(project);
  if (node === null || typeof node !== `object`) return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = typeof v === `function` ? `<function:${k}>` : project(v);
  return out;
}

/** The same branch fixtures the corpus-side driver applies. */
function surface(): unknown {
  const owner = { id: `user-owner-1`, name: `Owner Fixture` };
  const workflow = { id: `wf-1`, effectiveOwner: owner };
  const access = (kind: string): OwnerAccess => ({
    configure: { kind, ...(kind === `disabled` ? { reason: `pinned-disabled-reason` } : {}) },
  });
  const tooltipMarker = `pin:interactiveUsersTooltipContent`;
  const render = (props: Parameters<typeof renderAutomationOwnerSelect>[0]): unknown => {
    const r: OwnerSelectRendering = renderAutomationOwnerSelect(props, seams, tooltipMarker);
    return { tooltip: { element: r.tooltip.element, props: project(r.tooltip.props) }, renderPropResult: project(r.renderPropResult) };
  };
  return {
    propertyAllowed: render({ workflow, access: access(`allowed`) }),
    inlineAllowed: render({ workflow, access: access(`allowed`), appearance: `inline`, sx: { pinned: `sx-fixture` } }),
    propertyDisabledKind: render({ workflow, access: access(`disabled`) }),
  };
}

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (both appearance branches + the disabled action)`, () => {
  const ours = serialize(surface());
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
});
