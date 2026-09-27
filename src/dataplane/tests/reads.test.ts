/**
 * Tests for typed reads (T-302) over FixtureTransport.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LinearClient } from "../client.js";
import { FixtureTransport } from "../fixtures.js";
import {
  listTeams,
  getIssue,
  listIssues,
  listComments,
  listWorkflowStates,
} from "../reads.js";

const page = <T>(nodes: T[], hasNextPage = false, endCursor: string | null = null) => ({
  nodes,
  pageInfo: { hasNextPage, endCursor },
});

const rawIssue = (n: number, updatedAt: string) => ({
  id: `iss-${n}`,
  identifier: `ENG-${n}`,
  title: `Issue ${n}`,
  description: null,
  priority: 2,
  estimate: null,
  dueDate: null,
  url: `https://linear.app/demo/issue/ENG-${n}`,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt,
  state: { id: "st-1", name: "Todo", type: "unstarted" },
  team: { id: "team-1", key: "ENG" },
  assignee: null,
  labels: { nodes: [{ id: "lb-1", name: "Bug" }] },
});

test("listTeams returns team refs", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneTeams",
        respond: { data: { teams: page([{ id: "team-1", key: "ENG", name: "Engineering" }]) } },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const teams = await listTeams(client);
  assert.deepEqual(teams, [{ id: "team-1", key: "ENG", name: "Engineering" }]);
});

test("getIssue finds by identifier and flattens labels; null when missing", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneIssue",
        when: (v) => v.id === "ENG-7",
        respond: { data: { issue: rawIssue(7, "2026-09-25T00:00:00.000Z") } },
      },
      {
        operationName: "DataplaneIssue",
        respond: { data: { issue: null } },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const found = await getIssue(client, "ENG-7");
  assert.equal(found?.identifier, "ENG-7");
  assert.deepEqual(found?.labels, [{ id: "lb-1", name: "Bug" }]);
  const missing = await getIssue(client, "NOPE-1");
  assert.equal(missing, null);
});

test("listIssues paginates and sends the mapped API filter", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneIssues",
        when: (v) => v.after == null,
        respond: { data: { issues: page([rawIssue(1, "2026-09-24T00:00:00.000Z")], true, "cur-1") } },
      },
      {
        operationName: "DataplaneIssues",
        when: (v) => v.after === "cur-1",
        respond: { data: { issues: page([rawIssue(2, "2026-09-25T00:00:00.000Z")]) } },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const out = [];
  for await (const i of listIssues(client, {
    teamId: "team-1",
    stateTypes: ["unstarted"],
    updatedSince: "2026-09-23T00:00:00.000Z",
    labelNames: ["Bug"],
  })) {
    out.push(i);
  }
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((i) => i.identifier), ["ENG-1", "ENG-2"]);
  const sent = t.calls[0]!.variables;
  assert.deepEqual(sent.filter, {
    team: { id: { eq: "team-1" } },
    state: { type: { in: ["unstarted"] } },
    updatedAt: { gt: "2026-09-23T00:00:00.000Z" },
    labels: { name: { in: ["Bug"] } },
  });
});

test("listComments reads the nested connection and applies `since` client-side", async () => {
  const mk = (id: string, at: string) => ({
    id,
    body: `c-${id}`,
    createdAt: at,
    updatedAt: at,
    user: { id: "u1", displayName: "demo" },
  });
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneIssueComments",
        respond: {
          data: {
            issue: {
              comments: page([
                mk("1", "2026-09-24T10:00:00.000Z"),
                mk("2", "2026-09-25T10:00:00.000Z"),
              ]),
            },
          },
        },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const all = [];
  for await (const c of listComments(client, "ENG-1")) all.push(c);
  assert.equal(all.length, 2);
  const fresh = [];
  for await (const c of listComments(client, "ENG-1", { since: "2026-09-24T12:00:00.000Z" })) {
    fresh.push(c);
  }
  assert.deepEqual(fresh.map((c) => c.id), ["2"]);
});

test("listWorkflowStates passes team filter only when given (YAGNI variables)", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneWorkflowStates",
        respond: {
          data: {
            workflowStates: page([{ id: "st-1", name: "Todo", type: "unstarted", position: 1 }]),
          },
        },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  await listWorkflowStates(client);
  assert.deepEqual(t.calls[0]!.variables, {});
  await listWorkflowStates(client, "team-1");
  assert.deepEqual(t.calls[1]!.variables, { filter: { team: { id: { eq: "team-1" } } } });
});

