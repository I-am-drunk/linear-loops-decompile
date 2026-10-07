/** AU4: prompt chain operations and the section. Pure; no execution. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, makeRegistry } from "./detail.ts";
import { addStep, modelOptions, moveStep, PROMPTS_KEY, promptsSection, removeStep, stepsOf, type PromptStep } from "./prompts.ts";
import type { Model } from "../inference/types.ts";

const step = (id: string, text = `do ${id}`, model = ``): PromptStep => ({ id, text, model });
const ids = (s: readonly PromptStep[]): string => s.map((x) => x.id).join(``);
const MODELS: Model[] = [{ id: `haiku`, label: `Haiku` }, { id: `opus`, label: `Opus` }];

const chain = (...xs: PromptStep[]): PromptStep[] => {
  let acc: PromptStep[] = [];
  for (const x of xs) { const r = addStep(acc, x); assert.ok(r.ok, x.id); if (r.ok) acc = r.steps; }
  return acc;
};

test(`addStep refuses blank text — an empty prompt burns a call for nothing`, () => {
  const r = addStep([], step(`a`, `   `));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.detail, /needs prompt text/);
});

test(`addStep refuses a duplicate id and returns a NEW list`, () => {
  const one = chain(step(`a`));
  const dup = addStep(one, step(`a`, `again`));
  assert.equal(dup.ok === false && dup.detail, `duplicate step id a`);
  const two = addStep(one, step(`b`));
  assert.ok(two.ok && two.steps.length === 2);
  assert.equal(one.length, 1, `input mutated`);
});

test(`removeStep by id; unknown id is a no-op copy`, () => {
  const s = chain(step(`a`), step(`b`), step(`c`));
  assert.equal(ids(removeStep(s, `b`)), `ac`);
  assert.equal(ids(removeStep(s, `zz`)), `abc`);
});

test(`moveStep reorders — order is MEANING, later steps see earlier output`, () => {
  const s = chain(step(`a`), step(`b`), step(`c`));
  assert.equal(ids(moveStep(s, `c`, 0)), `cab`);
  assert.equal(ids(moveStep(s, `a`, 2)), `bca`);
  assert.equal(ids(s), `abc`, `input mutated`);
});

test(`moveStep clamps past either end instead of throwing or dropping the step`, () => {
  const s = chain(step(`a`), step(`b`), step(`c`));
  assert.equal(ids(moveStep(s, `a`, 99)), `bca`);
  assert.equal(ids(moveStep(s, `c`, -5)), `cab`);
  assert.equal(moveStep(s, `a`, 99).length, 3, `a step vanished`);
});

test(`moveStep with an unknown id or a no-op target returns a copy unchanged`, () => {
  const s = chain(step(`a`), step(`b`));
  assert.equal(ids(moveStep(s, `zz`, 0)), `ab`);
  assert.equal(ids(moveStep(s, `a`, 0)), `ab`);
  assert.notEqual(moveStep(s, `a`, 0), s, `must be a new array`);
});

test(`modelOptions leads with "Automation default" so an unchosen step stays honest`, () => {
  const opts = modelOptions(MODELS);
  assert.deepEqual(opts[0], { value: ``, label: `Automation default` });
  assert.deepEqual(opts.slice(1).map((o) => o.value), [`haiku`, `opus`]);
});

test(`stepsOf tolerates a missing or malformed key`, () => {
  assert.deepEqual(stepsOf({}), []);
  assert.deepEqual(stepsOf({ [PROMPTS_KEY]: `not a list` }), []);
});

test(`the section registers into AU2's frame: single prompt reads "Prompt", a chain reads "Step N"`, () => {
  const reg = makeRegistry();
  reg.register(promptsSection(MODELS));
  const e = makeEditor(reg, { [PROMPTS_KEY]: [] });

  // Empty: one disabled explanatory row, nothing else.
  const empty = e.sections()[0];
  assert.equal(empty?.id, `prompts`);
  assert.equal(empty?.rows.length, 1);
  assert.equal(empty?.rows[0]?.disabled, true);

  // One step: labelled "Prompt", not "Step 1" — a chain of one is a prompt.
  e.set(PROMPTS_KEY, chain(step(`a`, `Summarise`, `haiku`)));
  const single = e.sections()[0]?.rows ?? [];
  assert.equal(single.length, 2, `text + model per step`);
  assert.equal(single[0]?.label, `Prompt`);
  assert.equal(single[1]?.kind === `select` && single[1].value, `haiku`);

  // Two steps: "Step 1"/"Step 2", and the chain is dirty against saved.
  e.set(PROMPTS_KEY, chain(step(`a`, `Summarise`, `haiku`), step(`b`, `Decide`, `opus`)));
  const rows = e.sections()[0]?.rows ?? [];
  assert.equal(rows.length, 4);
  assert.deepEqual([rows[0]?.label, rows[2]?.label], [`Step 1`, `Step 2`]);
  assert.deepEqual(e.dirtySections(), [`prompts`]);
});
