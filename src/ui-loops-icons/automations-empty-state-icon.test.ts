/**
 * Golden test (the G0 acceptance bar): our clean module's output, projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the DECLARED observation driver, #225
 * 23:41Z red-team), must byte-match the committed corpus-executed goldens.
 *
 * The theme values fed in are each golden's own stub pins (H2 darkDefault /
 * lightDefault, golden/theme-stub*.mjs) — the same inputs the corpus
 * component received. The case PAIR pins both first-party default themes
 * (the #249 pattern: one case proves the tree, the pair proves token flow).
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
const golden = loadGolden(`darkDefault`);

// The H2 pins — identical to golden/theme-stub.mjs / theme-stub-light.mjs,
// the values each corpus execution saw
// (src/ui-theme/golden/golden-derived-retina0.json .darkDefault/.lightDefault).
const darkDefault = {
  color: {
    labelBase: `#e2e3e5`,
    labelFaint: `#565658`,
    labelMuted: `#949597`,
  },
};
const lightDefault = {
  color: {
    labelBase: `#2f2f31`,
    labelFaint: `#9c9c9e`,
    labelMuted: `#5b5c5e`,
  },
};

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

for (const [name, theme] of [[`darkDefault`, darkDefault], [`lightDefault`, lightDefault]] as const) {
  test(`clean module byte-matches the corpus-executed golden (${name})`, () => {
    const ours = serialize(AutomationsEmptyStateIcon(theme));
    assert.equal(
      `${JSON.stringify(ours, null, 2)}\n`,
      `${JSON.stringify(loadGolden(name).output, null, 2)}\n`,
    );
  });
}

test(`theme tokens flow through: a different theme changes exactly the sixteen fills`, () => {
  const other = { color: { labelBase: `#000001`, labelFaint: `#000002`, labelMuted: `#000003` } };
  const a = JSON.stringify(serialize(AutomationsEmptyStateIcon(darkDefault)));
  const b = JSON.stringify(serialize(AutomationsEmptyStateIcon(other)));
  assert.notEqual(a, b);
  assert.equal(
    a.replaceAll(`#949597`, `#000003`).replaceAll(`#e2e3e5`, `#000001`).replaceAll(`#565658`, `#000002`),
    b,
  );
});
