/**
 * Webhook registration + verification, and the poll fallback (T-303).
 *
 * Why both paths exist: event triggers (R4) want Linear webhooks, but a
 * webhook needs a public URL for Linear to reach — a self-hosted box behind
 * NAT often has none. So the engine picks per environment:
 *
 * - `registerWebhook` once per deployment when the server is reachable;
 *   deliveries are authenticated with `verifyWebhookSignature` (Linear signs
 *   the raw body with the webhook's secret, HMAC-SHA256 hex in the
 *   `Linear-Signature` header).
 * - Otherwise `pollIssueChanges` on the engine's schedule — the same
 *   "what changed since" question answered by reads. `listIssues` already
 *   filters `updatedAt` server-side, so the fallback stays budget-cheap.
 *
 * The engine owns diffing (collectionChanged vs watchedPropertyChanged) and
 * the poll loop itself; this file is the plumbing, not the policy.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { LinearClient } from "./client.js";
import { listIssues, type IssueSummary } from "./reads.js";
import { collect } from "./pagination.js";

// ---------------------------------------------------------------------------
// Registration (public API: webhookCreate / webhooks / webhookDelete)
// ---------------------------------------------------------------------------

/** Resource categories loops listen to. Linear accepts these strings verbatim. */
export const LOOP_WEBHOOK_RESOURCES = [
  "Issue",
  "Comment",
  "IssueLabel",
  "Project",
  "Cycle",
] as const;

export interface RegisteredWebhook {
  id: string;
  url: string;
  label?: string | null;
  resourceTypes: string[];
  enabled: boolean;
  /**
   * The signing secret. We always generate one and send it at creation, so it
   * is known locally without trusting the response to echo it.
   */
  secret: string;
}

export interface RegisterWebhookInput {
  url: string;
  /** Defaults to LOOP_WEBHOOK_RESOURCES. */
  resourceTypes?: string[];
  /** Scope to one team; omit for workspace-wide. */
  teamId?: string;
  label?: string;
  /** Override the generated secret (rotation, tests). */
  secret?: string;
}

const CREATE_WEBHOOK = /* GraphQL */ `
  mutation DataplaneCreateWebhook($input: WebhookCreateInput!) {
    webhookCreate(input: $input) {
      success
      webhook { id url label resourceTypes enabled }
    }
  }
`;

/** Create a webhook, generating its signing secret unless one is supplied. */
export async function registerWebhook(
  client: LinearClient,
  input: RegisterWebhookInput,
): Promise<RegisteredWebhook> {
  const secret = input.secret ?? randomBytes(24).toString("hex");
  const data = await client.request<{
    webhookCreate: {
      success: boolean;
      webhook: Omit<RegisteredWebhook, "secret"> | null;
    };
  }>(
    CREATE_WEBHOOK,
    {
      input: {
        url: input.url,
        resourceTypes: input.resourceTypes ?? [...LOOP_WEBHOOK_RESOURCES],
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        secret,
      },
    },
    { operationName: "DataplaneCreateWebhook" }, // unkeyed create: send once
  );
  if (!data.webhookCreate.success || !data.webhookCreate.webhook) {
    throw new Error("webhookCreate returned success=false");
  }
  return { ...data.webhookCreate.webhook, secret };
}

const LIST_WEBHOOKS = /* GraphQL */ `
  query DataplaneWebhooks {
    webhooks {
      nodes { id url label resourceTypes enabled }
    }
  }
`;

/** All webhooks in the workspace (settings page, orphan cleanup). */
export async function listWebhooks(
  client: LinearClient,
): Promise<Omit<RegisteredWebhook, "secret">[]> {
  const data = await client.request<{
    webhooks: { nodes: Omit<RegisteredWebhook, "secret">[] };
  }>(LIST_WEBHOOKS, {}, { operationName: "DataplaneWebhooks" });
  return data.webhooks.nodes;
}

const DELETE_WEBHOOK = /* GraphQL */ `
  mutation DataplaneDeleteWebhook($id: String!) {
    webhookDelete(id: $id) { success }
  }
`;

/** Delete by id. Returns false (not throw) when it was already gone. */
export async function deleteWebhook(
  client: LinearClient,
  id: string,
): Promise<boolean> {
  const data = await client.request<{ webhookDelete: { success: boolean } }>(
    DELETE_WEBHOOK,
    { id },
    { operationName: "DataplaneDeleteWebhook", idempotent: true },
  );
  return data.webhookDelete.success;
}

// ---------------------------------------------------------------------------
// Delivery verification (server side, no client needed)
// ---------------------------------------------------------------------------

/**
 * Verify a Linear webhook delivery. `rawBody` must be the exact bytes received
 * (pre-JSON-parse) — HMAC covers bytes, not objects. Accepts the bare hex
 * digest and the `sha256=<hex>` form. Constant-time compare.
 */
export function verifyWebhookSignature(
  secret: string,
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;
  const given = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(given.toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Poll fallback
// ---------------------------------------------------------------------------

export interface PollResult {
  /** Issues whose updatedAt is after `since`, oldest first. */
  issues: IssueSummary[];
  /**
   * The watermark to pass as `since` on the next poll: the newest updatedAt
   * seen, or the incoming `since` when nothing changed (never moves backward).
   */
  watermark: string;
}

/**
 * One round of "what changed since <watermark>" for the engine's poll loop.
 * Reads are idempotent and budgeted, so calling this on a cron is safe. The
 * engine diffs the returned issues against its last snapshot to decide
 * collectionChanged vs watchedPropertyChanged.
 */
export async function pollIssueChanges(
  client: LinearClient,
  opts: { since: string; teamId?: string; maxPages?: number },
): Promise<PollResult> {
  const issues = await collect(
    listIssues(
      client,
      {
        updatedSince: opts.since,
        ...(opts.teamId !== undefined ? { teamId: opts.teamId } : {}),
      },
      { ...(opts.maxPages !== undefined ? { maxPages: opts.maxPages } : {}) },
    ),
  );
  let watermark = opts.since;
  for (const issue of issues) {
    if (issue.updatedAt > watermark) watermark = issue.updatedAt;
  }
  return { issues, watermark };
}

