/**
 * Golden test (G0 acceptance bar): our clean module's observable behavior,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver), must byte-match the committed corpus-executed golden. Fixtures
 * mirror the golden driver (golden/type-lattice-driver.mjs) line-for-line.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  WorkflowDefinitionType,
  TriggerEntityType,
  isTriage,
  isAutomation,
  isViewSubscription,
  resolveTypeForTrigger,
  type TriggerLike,
} from "./type-lattice.ts";

const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, `golden`, `type-lattice.grid.expected.json`), `utf8`),
) as { provenance: { serializer: string }; output: unknown };

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (enum + predicates + conversion grid)`, () => {
  const types = [`sla`, `automation`, `viewSubscription`, `triage`, `triageAutomation`, `release`];
  const sweep = (fn: (t: string) => boolean): Record<string, boolean> =>
    Object.fromEntries(types.map((t) => [t, fn(t)]));

  const triggers: Record<string, TriggerLike> = {
    issueInTriage: { type: TriggerEntityType.issue, event: `entityInTriage` },
    issueUpdated: { type: TriggerEntityType.issue, event: `entityUpdated` },
    projectInTriage: { type: TriggerEntityType.project, event: `entityInTriage` },
    scheduleNoEvent: { type: TriggerEntityType.schedule },
  };

  const resolveGrid = Object.fromEntries(
    Object.entries(triggers).map(([name, trigger]) => [
      name,
      Object.fromEntries(types.map((t) => [t, resolveTypeForTrigger(t, trigger)])),
    ]),
  );

  const ours = serialize({
    typeEnum: { ...WorkflowDefinitionType },
    entityTypeEnum: { ...TriggerEntityType },
    isTriage: sweep(isTriage),
    isAutomation: sweep(isAutomation),
    isViewSubscription: sweep(isViewSubscription),
    resolveTypeForTrigger: resolveGrid,
  });
  assert.equal(bytes(ours), bytes(golden.output));
});

test(`the dual-species fact: triageAutomation is BOTH a triage type and a loop type`, () => {
  assert.equal(isTriage(WorkflowDefinitionType.triageAutomation), true);
  assert.equal(isAutomation(WorkflowDefinitionType.triageAutomation), true);
  assert.equal(isTriage(WorkflowDefinitionType.automation), false);
  assert.equal(isAutomation(WorkflowDefinitionType.triage), false);
});

test(`conversion is trigger-derived and issue-scoped (the two negative pins)`, () => {
  // project/entityInTriage never converts automation upward…
  assert.equal(
    resolveTypeForTrigger(`automation`, { type: TriggerEntityType.project, event: `entityInTriage` }),
    `automation`,
  );
  // …and it reverts triageAutomation, exactly like any non-triage trigger.
  assert.equal(
    resolveTypeForTrigger(`triageAutomation`, { type: TriggerEntityType.project, event: `entityInTriage` }),
    `automation`,
  );
  // A missing event never converts.
  assert.equal(resolveTypeForTrigger(`automation`, { type: TriggerEntityType.schedule }), `automation`);
});

test(`unlisted strings never match a predicate and never convert (CodeRabbit thread on this PR)`, () => {
  for (const value of [`unknown`, ``]) {
    assert.equal(isTriage(value), false);
    assert.equal(isAutomation(value), false);
    assert.equal(isViewSubscription(value), false);
  }
  // An unlisted type is identity through the conversion even on the triage trigger.
  assert.equal(
    resolveTypeForTrigger(`unknown`, { type: TriggerEntityType.issue, event: `entityInTriage` }),
    `unknown`,
  );
  // An issue trigger with NO event never converts (the guard needs both conjuncts).
  assert.equal(resolveTypeForTrigger(`automation`, { type: TriggerEntityType.issue }), `automation`);
});
