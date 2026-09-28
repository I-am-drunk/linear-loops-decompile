/**
 * Golden test (the G0 acceptance bar): our clean module's output, projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the declared observation driver), must
 * byte-match the committed corpus-executed goldens for
 * AutomationsEmptyStateIcon.CWP-Klc2.js.
 *
 * Two committed goldens pin both STATIC-branch input paths:
 *   - darkStatic: default props (isAnimated defaults to false);
 *   - darkReducedMotion: isAnimated=true overridden by prefers-reduced-motion
 *     (the corpus guard `isAnimated && !useReducedMotion()`), asserted
 *     byte-identical to darkStatic — the override IS the behavior.
 * The animated branch has no golden yet (T2 renderer needed); the module
 * refuses it loudly and a test pins that refusal.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { AutomationsEmptyStateIcon } from "./automations-empty-state-icon.ts";

type Golden = { provenance: { serializer: string }; output: unknown };
function loadGolden(name: string): Golden {
  return JSON.parse(readFileSync(join(import.meta.dirname, `golden`, `automations-empty-state-icon.${name}.expected.json`), `utf8`)) as Golden;
}

// The H2 pins — identical to golden/theme-stub-automations-dark.mjs, the
// values the corpus execution saw
// (src/ui-theme/golden/golden-derived-retina0.json .darkDefault).
const darkDefault = {
  color: {
    labelBase: `#e2e3e5`,
    labelFaint: `#565658`,
    labelMuted: `#949597`,
  },
};

test(`golden serializer version matches the one this test projects with`, () => {
  for (const name of [`darkStatic`, `darkReducedMotion`]) {
    assert.equal(loadGolden(name).provenance.serializer, SERIALIZER_VERSION);
  }
});

test(`clean module byte-matches the corpus-executed golden (darkStatic, default props)`, () => {
  const ours = serialize(AutomationsEmptyStateIcon(darkDefault, { prefersReducedMotion: false }));
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(loadGolden(`darkStatic`).output, null, 2)}\n`,
  );
});

test(`reduced motion overrides isAnimated back to the byte-identical static tree (darkReducedMotion)`, () => {
  const ours = serialize(AutomationsEmptyStateIcon(darkDefault, { isAnimated: true, prefersReducedMotion: true }));
  const golden = loadGolden(`darkReducedMotion`);
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
  // the two goldens themselves must be byte-identical trees — the corpus
  // behavior this case exists to pin
  assert.equal(
    JSON.stringify(golden.output),
    JSON.stringify(loadGolden(`darkStatic`).output),
  );
});

test(`theme tokens flow through: a different theme changes exactly the three fills`, () => {
  const other = { color: { labelBase: `#000001`, labelFaint: `#000002`, labelMuted: `#000003` } };
  const a = JSON.stringify(serialize(AutomationsEmptyStateIcon(darkDefault, { prefersReducedMotion: false })));
  const b = JSON.stringify(serialize(AutomationsEmptyStateIcon(other, { prefersReducedMotion: false })));
  assert.notEqual(a, b);
  assert.equal(
    a.replaceAll(`#949597`, `#000003`).replaceAll(`#e2e3e5`, `#000001`).replaceAll(`#565658`, `#000002`),
    b,
  );
});

test(`the unverified animated branch refuses loudly instead of shipping a plausible tree`, () => {
  assert.throws(
    () => AutomationsEmptyStateIcon(darkDefault, { isAnimated: true, prefersReducedMotion: false }),
    /animated branch is not golden-verified/,
  );
});
