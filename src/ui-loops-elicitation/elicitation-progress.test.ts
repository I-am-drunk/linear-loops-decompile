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
import { ElicitationProgress } from "./elicitation-progress.ts";

type TaggedObject = { tag: string; properties: Array<{ key: string; value: unknown }> };
const golden = JSON.parse(readFileSync(join(import.meta.dirname, `golden`, `elicitation-progress.states.expected.json`), `utf8`)) as {
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

const cases = [
  [`inProgress`, { answeredCount: 2, elicitationCount: 5, isSubmitting: false }],
  [`none`, { answeredCount: 0, elicitationCount: 3, isSubmitting: false }],
  [`submitting`, { answeredCount: 5, elicitationCount: 5, isSubmitting: true }],
] as const;

for (const [name, props] of cases) {
  test(`clean module byte-matches the corpus-executed golden (${name})`, () => {
    const ours = serialize(ElicitationProgress(props));
    assert.equal(
      `${JSON.stringify(ours, null, 2)}\n`,
      `${JSON.stringify(goldenCase(name), null, 2)}\n`,
    );
  });
}

test(`counts flow through: different counts change exactly the label text`, () => {
  const a = JSON.stringify(serialize(ElicitationProgress({ answeredCount: 1, elicitationCount: 9, isSubmitting: false })));
  const b = JSON.stringify(serialize(ElicitationProgress({ answeredCount: 2, elicitationCount: 9, isSubmitting: false })));
  assert.notEqual(a, b);
  assert.equal(a.replace(`1 of 9 answered`, `2 of 9 answered`), b);
});

test(`isSubmitting hides the counts entirely (corpus ternary)`, () => {
  const out = ElicitationProgress({ answeredCount: 3, elicitationCount: 7, isSubmitting: true });
  const label = ((out.props.children as { props: { children: { props: { children: string } } } }).props.children).props.children;
  assert.equal(label, `Submitting answers…`);
});
