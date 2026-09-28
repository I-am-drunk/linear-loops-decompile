/**
 * Golden test (the G0 acceptance bar): our clean module's output, projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the DECLARED observation driver, #225
 * 23:41Z red-team), must byte-match the committed corpus-executed golden.
 *
 * The theme values fed in are the golden's own stub pins (H2 darkDefault,
 * golden/theme-stub.mjs) — the same inputs the corpus component received.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { AgentAutomationEmptyStateIcon } from "./agent-automation-empty-state-icon.ts";

const goldenPath = join(
  import.meta.dirname,
  `golden`,
  `agent-automation-empty-state-icon.darkDefault.expected.json`,
);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: unknown;
};

// The H2 darkDefault pins — identical to golden/theme-stub.mjs, the values the
// corpus execution saw (src/ui-theme/golden/golden-derived-retina0.json).
const darkDefault = {
  color: {
    labelBase: `#e2e3e5`,
    labelFaint: `#565658`,
    labelMuted: `#949597`,
  },
};

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (darkDefault)`, () => {
  const ours = serialize(AgentAutomationEmptyStateIcon(darkDefault));
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
});

test(`theme tokens flow through: a different theme changes exactly the three fills`, () => {
  const other = { color: { labelBase: `#000001`, labelFaint: `#000002`, labelMuted: `#000003` } };
  const a = JSON.stringify(serialize(AgentAutomationEmptyStateIcon(darkDefault)));
  const b = JSON.stringify(serialize(AgentAutomationEmptyStateIcon(other)));
  assert.notEqual(a, b);
  assert.equal(
    a.replaceAll(`#949597`, `#000003`).replaceAll(`#e2e3e5`, `#000001`).replaceAll(`#565658`, `#000002`),
    b,
  );
});
