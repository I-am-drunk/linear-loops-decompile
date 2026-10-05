/** AU7: environment / parameters / memories. Pure. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, makeRegistry } from "./detail.ts";
import {
  CONTEXT_SECTIONS, ENV_KEY, environmentOf, MEMORIES_KEY, PARAMS_KEY, PARAMETERS_SECTION, type Parameter,
} from "./context.ts";

const editor = (draft: Record<string, unknown>) => {
  const reg = makeRegistry();
  for (const s of CONTEXT_SECTIONS) reg.register(s);
  return makeEditor(reg, draft);
};
const rowsOf = (e: ReturnType<typeof editor>, id: string) => e.sections().find((s) => s.id === id)?.rows ?? [];

test(`environmentOf defaults scope to read and drops empty repo/branch`, () => {
  assert.deepEqual(environmentOf({}), { scope: `read` });
  assert.deepEqual(environmentOf({ [ENV_KEY]: { scope: `nonsense`, repo: `` } }), { scope: `read` });
  assert.deepEqual(environmentOf({ [ENV_KEY]: { scope: `write`, repo: `acme/app` } }), { scope: `write`, repo: `acme/app` });
});

test(`parameters: the TYPE decides the row — boolean toggle, enum select, text input`, () => {
  const ps: Parameter[] = [
    { name: `dryRun`, type: `boolean`, value: true },
    { name: `tier`, type: `enum`, value: `gold`, options: [`gold`, `silver`] },
    { name: `label`, type: `text`, value: `nightly` },
  ];
  const rows = PARAMETERS_SECTION.build({ [PARAMS_KEY]: ps });
  assert.deepEqual(rows.map((r) => r.kind), [`toggle`, `select`, `text`]);
  assert.ok(rows[0]?.kind === `toggle` && rows[0].on === true);
  assert.ok(rows[1]?.kind === `select` && rows[1].value === `gold` && rows[1].options.length === 2);
  assert.ok(rows[2]?.kind === `text` && rows[2].value === `nightly`);
});

test(`memories are newest first and read-only`, () => {
  const e = editor({ [MEMORIES_KEY]: [
    { at: `2026-10-04T09:00:00Z`, note: `older` }, { at: `2026-10-05T09:00:00Z`, note: `newer` },
  ] });
  const rows = rowsOf(e, `memories`);
  assert.deepEqual(rows.map((r) => (r.kind === `text` ? r.value : `?`)), [`newer`, `older`]);
  assert.ok(rows.every((r) => r.disabled === true), `a memory a user can edit is no longer a record`);
});

test(`the three sections register into AU2's frame in plan order, after tools`, () => {
  const e = editor({});
  assert.deepEqual(e.sections().map((s) => s.id), [`environment`, `parameters`, `memories`]);
  assert.ok(CONTEXT_SECTIONS.every((s) => s.order > 30), `must sort after Tools (30)`);
});

test(`empty states are disabled explanatory rows, one per section`, () => {
  const e = editor({});
  for (const id of [`parameters`, `memories`]) {
    const rows = rowsOf(e, id);
    assert.equal(rows.length, 1, id);
    assert.equal(rows[0]?.disabled, true, id);
  }
  // Environment always has its three rows; empty values, not an empty state.
  assert.equal(rowsOf(e, `environment`).length, 3);
});
