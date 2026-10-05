/** IG5: Linear actions with audit, over an injected client. No network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { LINEAR_ACTIONS, makeLinearActions } from "./actions.ts";
import type { GraphqlClient } from "./entities.ts";

const NOW = Date.parse(`2026-10-05T12:00:00Z`);

/** A scripted client: records (mutation name, variables), replies by name or throws. */
function client(script: Record<string, unknown | (() => never)>) {
  const calls: { name: string; variables?: Record<string, unknown> }[] = [];
  const c: GraphqlClient = {
    async query<T>(q: string, variables?: Record<string, unknown>): Promise<T> {
      const name = /mutation (\w+)/.exec(q)?.[1] ?? `?`;
      calls.push(variables === undefined ? { name } : { name, variables });
      const r = script[name];
      if (typeof r === `function`) return (r as () => never)();
      return r as T;
    },
  };
  return { c, calls };
}

const actions = (c: GraphqlClient) => makeLinearActions(c, () => NOW);

test(`the four actions are declared with idempotency the retry policy can read`, () => {
  const byKind = Object.fromEntries(LINEAR_ACTIONS.map((a) => [a.kind, a]));
  assert.deepEqual(Object.keys(byKind), [`comment`, `setStatus`, `updateIssue`, `createIssue`]);
  assert.equal(byKind[`comment`]?.idempotent, false, `a comment posted twice is two comments`);
  assert.equal(byKind[`createIssue`]?.idempotent, false);
  assert.equal(byKind[`setStatus`]?.idempotent, true, `setting the same status twice is one state`);
  assert.equal(byKind[`updateIssue`]?.idempotent, true);
  for (const a of LINEAR_ACTIONS) assert.ok(a.inputs.some((i) => i.required), `${a.kind} has a required input`);
});

test(`comment sends CommentCreateInput and returns a success audit with the new id`, async () => {
  const { c, calls } = client({ CommentCreate: { commentCreate: { success: true, comment: { id: `cm-9` } } } });
  const r = await actions(c).comment(`auto-1`, `iss-1`, `Looks good`);
  assert.deepEqual(calls[0], { name: `CommentCreate`, variables: { input: { issueId: `iss-1`, body: `Looks good` } } });
  assert.ok(r.ok);
  assert.deepEqual(r.audit, {
    action: `comment`, automationId: `auto-1`, entityId: `iss-1`, at: new Date(NOW).toISOString(), ok: true, resultId: `cm-9`,
  });
});

test(`setStatus is an issueUpdate carrying ONLY stateId`, async () => {
  const { c, calls } = client({ IssueUpdate: { issueUpdate: { success: true, issue: { id: `iss-1` } } } });
  const r = await actions(c).setStatus(`auto-1`, `iss-1`, `st-done`);
  assert.deepEqual(calls[0], { name: `IssueUpdate`, variables: { id: `iss-1`, input: { stateId: `st-done` } } });
  assert.ok(r.ok && r.audit.resultId === `iss-1`);
});

test(`updateIssue sends only the provided fields — an absent key is not a null write`, async () => {
  const { c, calls } = client({ IssueUpdate: { issueUpdate: { success: true, issue: { id: `iss-1` } } } });
  // Under exactOptionalPropertyTypes a caller cannot even pass
  // `description: undefined` — the type forbids it, which is the stronger
  // guarantee. So this exercises the runtime filter via a widened object.
  const sparse = { title: `New title`, priority: 2, description: undefined } as unknown as { title?: string };
  await actions(c).updateIssue(`auto-1`, `iss-1`, sparse);
  const input = calls[0]?.variables?.[`input`] as Record<string, unknown>;
  assert.deepEqual(input, { title: `New title`, priority: 2 });
  assert.ok(!(`description` in input), `undefined must not become description: null`);
  assert.ok(!(`assigneeId` in input));
});

test(`createIssue has no entityId in its audit — the entity does not exist until the call returns`, async () => {
  const { c, calls } = client({ IssueCreate: { issueCreate: { success: true, issue: { id: `iss-new` } } } });
  const r = await actions(c).createIssue(`auto-1`, `team-eng`, `Add tests`);
  assert.deepEqual(calls[0]?.variables, { input: { teamId: `team-eng`, title: `Add tests` } });
  assert.ok(r.ok);
  assert.ok(!(`entityId` in r.audit), `nothing to point at before creation`);
  assert.equal(r.audit.resultId, `iss-new`, `the created id is the result`);
});

test(`a thrown client error and a success=false payload both yield a FAILED audit, never a throw`, async () => {
  const thrown = client({ CommentCreate: () => { throw new Error(`RATELIMITED`); } });
  const r1 = await actions(thrown.c).comment(`auto-1`, `iss-1`, `x`);
  assert.equal(r1.ok, false);
  assert.equal(r1.audit.ok, false);
  assert.equal(r1.audit.detail, `RATELIMITED`);
  assert.equal(r1.audit.action, `comment`, `the audit still names what was attempted`);

  const refused = client({ IssueUpdate: { issueUpdate: { success: false } } });
  const r2 = await actions(refused.c).setStatus(`auto-1`, `iss-1`, `st-x`);
  assert.equal(r2.ok, false);
  assert.match(r2.audit.detail ?? ``, /success=false/);
  assert.ok(!(`resultId` in r2.audit), `no result id on a refused write`);
});
