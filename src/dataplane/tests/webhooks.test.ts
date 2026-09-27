/**
 * Tests for webhook registration/verification + the poll fallback (T-303).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { LinearClient } from "../client.js";
import { FixtureTransport } from "../fixtures.js";
import {
  registerWebhook,
  listWebhooks,
  deleteWebhook,
  verifyWebhookSignature,
  pollIssueChanges,
  LOOP_WEBHOOK_RESOURCES,
} from "../webhooks.js";

const page = <T>(nodes: T[]) => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });

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
  labels: { nodes: [] },
});

test("registerWebhook sends a generated secret and defaults to the loop resources", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneCreateWebhook",
        respond: {
          data: {
            webhookCreate: {
              success: true,
              webhook: {
                id: "wh-1",
                url: "https://loops.example.com/hooks/linear",
                label: "loops",
                resourceTypes: [...LOOP_WEBHOOK_RESOURCES],
                enabled: true,
              },
            },
          },
        },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const wh = await registerWebhook(client, { url: "https://loops.example.com/hooks/linear", label: "loops" });
  assert.equal(wh.id, "wh-1");
  assert.match(wh.secret, /^[0-9a-f]{48}$/); // 24 random bytes, hex
  const sent = t.calls[0]!.variables as { input: { secret: string; resourceTypes: string[] } };
  assert.equal(sent.input.secret, wh.secret); // we tell Linear the secret, so we always know it
  assert.deepEqual(sent.input.resourceTypes, [...LOOP_WEBHOOK_RESOURCES]);
});

test("registerWebhook honors a caller-supplied secret (rotation)", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneCreateWebhook",
        respond: {
          data: {
            webhookCreate: {
              success: true,
              webhook: { id: "wh-2", url: "u", label: null, resourceTypes: ["Issue"], enabled: true },
            },
          },
        },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const wh = await registerWebhook(client, { url: "u", resourceTypes: ["Issue"], secret: "known-secret" });
  assert.equal(wh.secret, "known-secret");
});

test("listWebhooks + deleteWebhook round-trip the workspace registry", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneWebhooks",
        respond: {
          data: {
            webhooks: {
              nodes: [{ id: "wh-1", url: "u", label: "loops", resourceTypes: ["Issue"], enabled: true }],
            },
          },
        },
      },
      { operationName: "DataplaneDeleteWebhook", respond: { data: { webhookDelete: { success: true } } } },
    ],
  });
  const client = new LinearClient({ transport: t });
  const list = await listWebhooks(client);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.id, "wh-1");
  assert.equal(await deleteWebhook(client, "wh-1"), true);
});

test("verifyWebhookSignature accepts a genuine delivery (bare hex and sha256= forms)", () => {
  const secret = "s3cret";
  const body = JSON.stringify({ action: "create", type: "Comment", data: { id: "c-1" } });
  const hex = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyWebhookSignature(secret, body, hex), true);
  assert.equal(verifyWebhookSignature(secret, body, `sha256=${hex}`), true);
  assert.equal(verifyWebhookSignature(secret, Buffer.from(body), hex), true);
});

test("verifyWebhookSignature rejects wrong secret, tampered body, missing/garbage header", () => {
  const body = "{}";
  const hex = createHmac("sha256", "right").update(body).digest("hex");
  assert.equal(verifyWebhookSignature("wrong", body, hex), false);
  assert.equal(verifyWebhookSignature("right", `{"tampered":true}`, hex), false);
  assert.equal(verifyWebhookSignature("right", body, undefined), false);
  assert.equal(verifyWebhookSignature("right", body, "not-hex"), false);
  assert.equal(verifyWebhookSignature("right", body, ""), false);
});

test("pollIssueChanges returns post-watermark issues and advances the watermark", async () => {
  const t = new FixtureTransport({
    fixtures: [
      {
        operationName: "DataplaneIssues",
        respond: {
          data: { issues: page([rawIssue(2, "2026-09-26T01:00:00Z"), rawIssue(5, "2026-09-26T03:00:00Z")]) },
        },
      },
    ],
  });
  const client = new LinearClient({ transport: t });
  const res = await pollIssueChanges(client, { since: "2026-09-26T00:00:00Z", teamId: "team-1" });
  assert.deepEqual(res.issues.map((i) => i.identifier), ["ENG-2", "ENG-5"]);
  assert.equal(res.watermark, "2026-09-26T03:00:00Z"); // newest seen
  const sent = t.calls[0]!.variables as { filter: { team?: { id: { eq: string } } } };
  assert.equal(sent.filter.team?.id.eq, "team-1"); // filter really reached the query
});

test("pollIssueChanges with no changes keeps the watermark (never moves backward)", async () => {
  const t = new FixtureTransport({
    fixtures: [{ operationName: "DataplaneIssues", respond: { data: { issues: page([]) } } }],
  });
  const client = new LinearClient({ transport: t });
  const res = await pollIssueChanges(client, { since: "2026-09-26T05:00:00Z" });
  assert.deepEqual(res.issues, []);
  assert.equal(res.watermark, "2026-09-26T05:00:00Z");
});

