/**
 * Golden test (G0 acceptance bar): our clean module's output, projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the declared observation driver), must
 * byte-match the committed corpus-executed golden, per parametrization.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { LinearAgentEmptyStateHero } from "./empty-state-hero.ts";

type TaggedObject = { tag: string; properties: Array<{ key: string; value: unknown }> };
const golden = JSON.parse(readFileSync(join(import.meta.dirname, `golden`, `empty-state-hero.expected.json`), `utf8`)) as {
  provenance: { serializer: string };
  output: TaggedObject;
};

function goldenCase(name: string): unknown {
  const hit = golden.output.properties.find((p) => p.key === name);
  assert.notEqual(hit, undefined, `golden case ${name} missing`);
  return hit?.value;
}

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

// The icon seam: the golden holds the ContextualMenuActions icon as this exact
// declared string marker (see corpus-manifest.json), so our module receives it
// the same way — the boundary is the marker, byte-identical on both sides.
const ICON_MARKER = `stub:ContextualMenuActions.uB(AgentIcon)`;

const cases = [
  [`static`, { shouldAnimate: false, icon: ICON_MARKER }],
  [`animated`, { shouldAnimate: true, icon: ICON_MARKER }],
] as const;

for (const [name, props] of cases) {
  test(`clean module byte-matches the corpus-executed golden (${name})`, () => {
    const ours = serialize(LinearAgentEmptyStateHero(props));
    assert.equal(
      `${JSON.stringify(ours, null, 2)}\n`,
      `${JSON.stringify(goldenCase(name), null, 2)}\n`,
    );
  });
}

test(`grid facts hold: 253 cells, exactly one hidden (row 10, col 11), keys row-col`, () => {
  const tree = LinearAgentEmptyStateHero({ shouldAnimate: false, icon: ICON_MARKER });
  const children = tree.props[`children`] as Array<{ props: Record<string, unknown> }>;
  const grid = children[0];
  assert.notEqual(grid, undefined);
  const cells = grid?.props[`children`] as Array<{ key: string | null; props: { className?: string } }>;
  assert.equal(cells.length, 253);
  const hidden = cells.filter((c) => (c.props.className ?? ``).includes(`sx-lshs6z`));
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0]?.key, `10-11`);
  assert.equal(cells[0]?.key, `0-0`);
  assert.equal(cells[252]?.key, `10-22`);
});
