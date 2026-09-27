/**
 * Tests for the EntityReader seam (R3's implementation of the runtime's
 * EntityReader contract from issue #40) over FixtureTransport.
 * Style matches the package: compile-then-run (tsc -p tsconfig.build.json && node --test dist/tests/*.test.js).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LinearClient } from "../client.js";
import { FixtureTransport } from "../fixtures.js";
import { DataplaneEntityReader } from "../entityReader.js";
import { ServerError } from "../errors.js";

const page = <T>(nodes: T[], hasNextPage = false, endCursor: string | null = null) => ({
  nodes,
  pageInfo: { hasNextPage, endCursor },
});

const rawIssue = {
  id: "iss-1",
  identifier: "ENG-1",
  title: "Set up CI pipeline",
  description: "We need CI before anything merges.",
  priority: 2,
  estimate: null,
  dueDate: null,
  url: "https://linear.app/demo/issue/ENG-1",
  createdAt: "2026-09-20T10:00:00.000Z",
  updatedAt: "2026-09-25T15:30:00.000Z",
  state: { id: "st-1", name: "In Progress", type: "started" },
  team: { id: "team-1", key: "ENG" },
  assignee: null,
  labels: { nodes: [] },
};

const rawComment = (n: number, user: { id: string; displayName: string } | null) => ({
  id: `cmt-${n}`,
  body: `comment ${n}`,
  createdAt: `2026-09-2${n}T00:00:00.000Z`,
  updatedAt: `2026-09-2${n}T00:00:00.000Z`,
  user,
});

function clientWith(fixtures: ConstructorParameters<typeof FixtureTransport>[0]["fixtures"]) {
  const transport = new FixtureTransport({ fixtures });
  return { client: new LinearClient({ transport }), transport };
}

test("issue target returns title, description, url, and mapped comments", async () => {
  const { client } = clientWith([
    { operationName: "DataplaneIssue", respond: { data: { issue: rawIssue } } },
    {
      operationName: "DataplaneIssueComments",
      respond: {
        data: {
          issue: {
            comments: page([
              rawComment(1, { id: "u-1", displayName: "Ada" }),
              rawComment(2, null),
            ]),
          },
        },
      },
    },
  ]);
  const reader = new DataplaneEntityReader(client);
  const ctx = await reader.readEntity({ entity: "issue", id: "ENG-1" });
  assert.deepEqual(ctx, {
    title: "Set up CI pipeline",
    description: "We need CI before anything merges.",
    url: "https://linear.app/demo/issue/ENG-1",
    comments: [
      { author: "Ada", body: "comment 1" },
      { author: null, body: "comment 2" },
    ],
  });
});

test("issue target: null description stays absent-ish, missing issue → null", async () => {
  const { client } = clientWith([
    { operationName: "DataplaneIssue", respond: { data: { issue: null } } },
  ]);
  const reader = new DataplaneEntityReader(client);
  assert.equal(await reader.readEntity({ entity: "issue", id: "ENG-404" }), null);
});

test("comments cap keeps the MOST RECENT comments", async () => {
  const { client } = clientWith([
    { operationName: "DataplaneIssue", respond: { data: { issue: rawIssue } } },
    {
      operationName: "DataplaneIssueComments",
      respond: {
        data: {
          issue: { comments: page([rawComment(1, null), rawComment(2, null), rawComment(3, null)]) },
        },
      },
    },
  ]);
  const reader = new DataplaneEntityReader(client, { maxComments: 2 });
  const ctx = await reader.readEntity({ entity: "issue", id: "iss-1" });
  assert.deepEqual(
    ctx?.comments?.map((c) => c.body),
    ["comment 2", "comment 3"],
  );
});

test("project target: found by id → title + url; missing → null", async () => {
  const { client } = clientWith([
    {
      operationName: "DataplaneProjects",
      respond: {
        data: {
          projects: page([
            { id: "prj-1", name: "Q4 Launch", state: "started", url: "https://linear.app/demo/project/q4", targetDate: null },
          ]),
        },
      },
    },
  ]);
  const reader = new DataplaneEntityReader(client);
  assert.deepEqual(await reader.readEntity({ entity: "project", id: "prj-1" }), {
    title: "Q4 Launch",
    url: "https://linear.app/demo/project/q4",
  });
  assert.equal(await reader.readEntity({ entity: "project", id: "prj-9" }), null);
});

test("team target: found by key → title; missing → null", async () => {
  const { client } = clientWith([
    {
      operationName: "DataplaneTeams",
      respond: { data: { teams: page([{ id: "team-1", key: "ENG", name: "Engineering" }]) } },
    },
  ]);
  const reader = new DataplaneEntityReader(client);
  assert.deepEqual(await reader.readEntity({ entity: "team", id: "ENG" }), { title: "Engineering" });
  assert.equal(await reader.readEntity({ entity: "team", id: "DESIGN" }), null);
});

test("unsupported entity kinds return null WITHOUT touching the API", async () => {
  const { client, transport } = clientWith([]);
  const reader = new DataplaneEntityReader(client);
  assert.equal(await reader.readEntity({ entity: "document", id: "doc-1" }), null);
  assert.equal(await reader.readEntity({ entity: "comment", id: "cmt-1" }), null);
  assert.equal(transport.calls.length, 0);
});

test("dataplane errors PROPAGATE (the run must fail visibly)", async () => {
  const { client } = clientWith([
    {
      operationName: "DataplaneIssue",
      respond: { error: new ServerError(500, "boom") },
    },
  ]);
  const reader = new DataplaneEntityReader(client);
  await assert.rejects(() => reader.readEntity({ entity: "issue", id: "ENG-1" }), /boom|500/);
});

