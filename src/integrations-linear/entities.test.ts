/** IG3: Linear entity reads over an injected GraphQL client. No network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { LINEAR_ENTITIES, makeLinearEntities, PAGE_MAX, type GraphqlClient } from "./entities.ts";

/** A scripted client: records (query, variables) and replies by query name. */
function client(script: Record<string, unknown | (() => never)>) {
  const calls: { name: string; variables?: Record<string, unknown> }[] = [];
  const c: GraphqlClient = {
    async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
      const name = /query (\w+)/.exec(query)?.[1] ?? `?`;
      calls.push(variables === undefined ? { name } : { name, variables });
      const r = script[name];
      if (typeof r === `function`) return (r as () => never)();
      return r as T;
    },
  };
  return { c, calls };
}

const conn = (nodes: unknown[], endCursor?: string) => ({
  nodes, pageInfo: { hasNextPage: endCursor !== undefined, endCursor: endCursor ?? null },
});

test(`the six plan entities are declared, each with at least one required field`, () => {
  assert.deepEqual(LINEAR_ENTITIES.map((e) => e.kind), [`issue`, `project`, `team`, `cycle`, `document`, `initiative`]);
  for (const e of LINEAR_ENTITIES) {
    assert.ok(e.fields.some((f) => f.required), `${e.kind} needs a required field for an action input`);
  }
});

test(`listIssues clamps page size to [1, PAGE_MAX] and passes the cursor only when given`, async () => {
  const { c, calls } = client({ Issues: { issues: conn([]) } });
  const e = makeLinearEntities(c);
  await e.listIssues(500);
  await e.listIssues(0, `cur`);
  await e.listIssues();
  assert.deepEqual(calls.map((x) => x.variables), [{ first: PAGE_MAX }, { first: 1, after: `cur` }, { first: PAGE_MAX }]);
});

test(`issue rows are shaped from the connection; malformed nodes are dropped, never invented`, async () => {
  const { c } = client({ Issues: { issues: conn([
    { id: `1`, identifier: `ENG-1`, title: `Fix`, priority: 2, state: { name: `Todo` }, team: { key: `ENG` } },
    { id: `2`, identifier: `ENG-2`, title: `` },            // no state/team: optional, kept
    { bogus: true },                                        // no id: dropped
  ], `cursor-1`) } });
  const r = await makeLinearEntities(c).listIssues();
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.nodes.length, 2);
    assert.deepEqual(r.value.nodes[0], { id: `1`, identifier: `ENG-1`, title: `Fix`, priority: 2, stateName: `Todo`, teamKey: `ENG` });
    assert.deepEqual(r.value.nodes[1], { id: `2`, identifier: `ENG-2`, title: ``, priority: 0 });
    assert.equal(r.value.endCursor, `cursor-1`);
  }
});

test(`getIssue and getProject return one row; a missing one is a shape failure, not a crash`, async () => {
  const { c, calls } = client({
    Issue: { issue: { id: `1`, identifier: `ENG-1`, title: `Fix` } },
    Project: { project: null },
  });
  const e = makeLinearEntities(c);
  const got = await e.getIssue(`1`);
  assert.ok(got.ok && got.value.identifier === `ENG-1`);
  assert.deepEqual(calls[0]?.variables, { id: `1` });
  const none = await e.getProject(`nope`);
  assert.equal(none.ok, false);
  if (!none.ok) assert.match(none.detail, /project nope: unexpected response shape/);
});

test(`a thrown client error (rate limit, network, not connected) becomes a value naming the call`, async () => {
  const { c } = client({ Issues: () => { throw new Error(`RATELIMITED: retry after 12s`); } });
  const r = await makeLinearEntities(c).listIssues();
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.detail, `issues: RATELIMITED: retry after 12s`);
});

test(`reachable() proves the token works via viewer, and carries the account name`, async () => {
  const up = makeLinearEntities(client({ Viewer: { viewer: { id: `u`, name: `tj` } } }).c);
  assert.deepEqual(await up.reachable(), { state: `connected`, account: `tj` });
  const dead = makeLinearEntities(client({ Viewer: () => { throw new Error(`HTTP 401`); } }).c);
  const s = await dead.reachable();
  assert.equal(s.state, `error`);
  assert.match(s.state === `error` ? s.detail : ``, /viewer: HTTP 401/);
});

test(`the last page has no cursor; a page with hasNextPage but no cursor is treated as last`, async () => {
  const last = makeLinearEntities(client({ Projects: { projects: conn([{ id: `p`, name: `P`, state: `started` }]) } }).c);
  const r = await last.listProjects();
  assert.ok(r.ok && !(`endCursor` in r.value));
  const odd = makeLinearEntities(client({ Projects: { projects: { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } } } }).c);
  const o = await odd.listProjects();
  assert.ok(o.ok && !(`endCursor` in o.value), `no cursor to continue with means stop`);
});
