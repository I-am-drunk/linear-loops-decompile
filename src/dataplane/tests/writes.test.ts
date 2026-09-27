/**
 * Tests for typed writes (T-303) over FixtureTransport.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { LinearClient } from "../client.js";
import { FixtureTransport } from "../fixtures.js";
import { createComment, updateIssue, setIssueState, idempotencyMarker } from "../writes.js";

const page = <T>(nodes: T[]) => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });

const rawIssue = {
  id: "iss-1",
  identifier: "ENG-1",
  title: "Old title",
  description: null,
  priority: 2,
  estimate: null,
  dueDate: null,
  url: "https://linear.app/demo/issue/ENG-1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-25T00:00:00.000Z",
  state: { id: "st-1", name: "Todo", type: "unstarted" },
  team: { id: "team-1", key: "ENG" },
  assignee: null,
  labels: { nodes: [] },
};

test("createComment without a key posts once, no marker, no pre-check read", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneCreateComment",
        respond: {
          data: {
            commentCreate: {
              success: true,
              comment: { id: "c-1", body: "hi", createdAt: "2026-09-26T00:00:00Z", url: null },
            },
          },
        },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const res = await createComment(client, { issueId: "iss-1", body: "hi" });
  assert.equal(res.value.id, "c-1");
  assert.equal(res.deduplicated, false);
  assert.equal(t.calls.length, 1); // mutation only — no comment scan
  const sent = t.calls[0]!.variables as { input: { body: string } };
  assert.equal(sent.input.body, "hi"); // unkeyed: body untouched
});

test("createComment with an idempotency key embeds a marker and posts when absent", async () => {
  const t = new FixtureTransport({
    fixtures: [
      { operationName: "DataplaneIssueComments", respond: { data: { issue: { comments: page([]) } } } },
      {
        operationName: "DataplaneCreateComment",
        respond: (v) => ({
          data: {
            commentCreate: {
              success: true,
              comment: {
                id: "c-9",
                body: (v.input as { body: string }).body,
                createdAt: "2026-09-26T00:00:00Z",
                url: null,
              },
            },
          },
        }),
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const res = await createComment(client, { issueId: "iss-1", body: "run output", idempotencyKey: "run:r1:c1" });
  assert.equal(res.deduplicated, false);
  assert.equal(t.calls.length, 2); // dedupe scan + mutation
  assert.ok(res.value.body.includes(idempotencyMarker("run:r1:c1")));
});

test("createComment with a key dedupes: marker found → no mutation sent", async () => {
  const existing = {
    id: "c-old",
    body: `run output\n\n${idempotencyMarker("run:r1:c1")}`,
    createdAt: "2026-09-26T00:00:00Z",
    updatedAt: "2026-09-26T00:00:00Z",
    user: null,
  };
  const t = new FixtureTransport({
    fixtures: [
      { operationName: "DataplaneIssueComments", respond: { data: { issue: { comments: page([existing]) } } } },
    ],
  });
  const client = new LinearClient({ transport: t });
  const res = await createComment(client, { issueId: "iss-1", body: "run output", idempotencyKey: "run:r1:c1" });
  assert.equal(res.deduplicated, true);
  assert.equal(res.value.id, "c-old");
  assert.equal(t.calls.length, 1); // only the scan — no double post
});

test("updateIssue sends only the given fields and maps the summary", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneUpdateIssue",
        respond: { data: { issueUpdate: { success: true, issue: { ...rawIssue, title: "New title" } } } },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const res = await updateIssue(client, "iss-1", { title: "New title", stateId: "st-9" });
  const sent = t.calls[0]!.variables as { id: string; input: Record<string, unknown> };
  assert.equal(sent.id, "iss-1");
  assert.deepEqual(sent.input, { title: "New title", stateId: "st-9" });
  assert.equal(res.value.title, "New title");
  assert.equal(res.value.identifier, "ENG-1");
});

test("setIssueState resolves the state name within the issue's team", async () => {
  const t = new FixtureTransport({
    fixtures: [
      { operationName: "DataplaneIssue", respond: { data: { issue: rawIssue } } },
      {
        operationName: "DataplaneWorkflowStates",
        respond: {
          data: {
            workflowStates: page([
              { id: "st-1", name: "Todo", type: "unstarted", position: 1 },
              { id: "st-2", name: "In Progress", type: "started", position: 2 },
            ]),
          },
        },
      },
      {
        operationName: "DataplaneUpdateIssue",
        respond: {
          data: {
            issueUpdate: {
              success: true,
              issue: { ...rawIssue, state: { id: "st-2", name: "In Progress", type: "started" } },
            },
          },
        },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const res = await setIssueState(client, "iss-1", "in progress"); // case-insensitive
  assert.equal(res.value.state.name, "In Progress");
  const sent = t.calls[2]!.variables as { input: { stateId: string } };
  assert.equal(sent.input.stateId, "st-2");
});

test("setIssueState throws a naming error (not an API error) for unknown states", async () => {
  const t = new FixtureTransport({
    fixtures: [
      { operationName: "DataplaneIssue", respond: { data: { issue: rawIssue } } },
      {
        operationName: "DataplaneWorkflowStates",
        respond: { data: { workflowStates: page([{ id: "st-1", name: "Todo", type: "unstarted", position: 1 }]) } },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  await assert.rejects(() => setIssueState(client, "iss-1", "Nope"), /no state "Nope"/);
});

test("setIssueState throws when the issue does not exist", async () => {
  const t = new FixtureTransport({
    fixtures: [{ operationName: "DataplaneIssue", respond: { data: { issue: null } } }],
  });
  const client = new LinearClient({ transport: t });
  await assert.rejects(() => setIssueState(client, "ghost", "Todo"), /not found/);
});

