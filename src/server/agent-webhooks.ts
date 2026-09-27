/**
 * AgentSessionEvent inbound webhooks (T-605 — golden-goose track B, the
 * INBOUND half; issue #14). Linear's native agent UX drives OUR loops: a
 * user @-mentioning or delegating an issue to our agent in real Linear hits
 * this endpoint, and our server starts (or steers) a run whose brain is the
 * user's own harness (T-1105). Zero Linear AI credits; Linear supplies the
 * chat surface and its own pre-assembled `promptContext` (issue + comments
 * + guidance — the digest: "usable verbatim as our brain's context").
 *
 * Rails (official digest, extracts/linear-official/AGENT-API.md §Webhooks):
 * - ACK within 5s → verify + enqueue synchronously; the run executes async.
 * - Signature: HMAC-SHA256 over the RAW body with the app's webhook signing
 *   secret, hex-compared in constant time. The secret is settings-held and
 *   write-only (secrets.ts rail) via the WebhookSecrets seam — this module
 *   never sees a settings store, only the getter.
 * - Retry-storm discipline: everything except auth failures (401) and an
 *   unconfigured endpoint (503) answers 200-and-skip with an audit row —
 *   Linear retries non-2xx, and a permanently malformed/unknown delivery
 *   must never double-run or error-storm.
 * - Dedupe, two rails: the delivery id (`Linear-Delivery` header) audited
 *   (`linear.inbound`), and the run request itself keyed
 *   `agentSession:{id}` so the engine's idempotency collapses repeat
 *   `created` deliveries of the same session for free.
 *
 * Session ↔ run mapping rides the same audit rail as the T-604 presenter
 * (kind `linear.inbound`): `created` records sessionId→runId; `prompted`
 * resolves it and steers/answers the mapped run.
 *
 * Mounting: the http.ts caller-passed-handler pattern (the
 * environmentHandler precedent) — compose wires it with one line after
 * #113 lands (hot file, not touched here).
 *
 * Non-goals (documented): OAuth app provisioning + live probe (the user's
 * gate, #14); `stop`/`auth` signal handling (T-504's StopSignal seam is
 * ready for the signal slice); `AgentSessionEvent` actions beyond
 * created/prompted (200-and-skip).
 *
 * Original code. Official shapes: extracts/linear-official/ (MIT).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { EntityId } from "../runtime/types.ts";
import type { Store } from "./store.ts";

// ---------------------------------------------------------------------------
// Seams (composition root binds the real ones; tests fake them)
// ---------------------------------------------------------------------------

/** Settings-held secrets, write-only — only the getter crosses the seam. */
export interface WebhookSecrets {
  /** The Linear webhook signing secret, or null when not configured. */
  getSigningSecret(): string | null;
}

/** Which loop receives inbound agent runs (operator choice, settings-held). */
export interface InboundLoopConfig {
  /** The loop id for agent-mention runs, or null when not configured. */
  getInboundLoopId(): EntityId | null;
}

/** The run commands the composition root provides (orchestrator + rpc). */
export interface AgentRunCommands {
  /** orchestrator.requestRun — returns the started/queued run id. */
  requestRun(req: {
    loopId: EntityId;
    kind: "event";
    requestedAt: string;
    triggerEventId: string;
    target: { entityType: string; entityId: string };
  }): Promise<{ runId?: EntityId | undefined }>;
  /** steer on an active run / answer on a parked one (rpc.ts's mapping). */
  steerRun(runId: EntityId, text: string): void;
}

export interface AgentWebhookDeps {
  secrets: WebhookSecrets;
  inboundLoop: InboundLoopConfig;
  commands: AgentRunCommands;
  store: Store;
  now?: (() => Date) | undefined;
}

const AUDIT_INBOUND = "linear.inbound";

// ---------------------------------------------------------------------------
// Payload reading (Developer Preview shapes — parse defensively)
// ---------------------------------------------------------------------------

interface AgentSessionEvent {
  action: string;
  sessionId: string;
  issueId?: string | undefined;
  promptContext?: string | undefined;
  /** prompted: the new user message text. */
  promptBody?: string | undefined;
  guidance?: string | undefined;
}

/** Extract what we need; null = unusable for any action (skip). */
export function readAgentSessionEvent(payload: unknown): AgentSessionEvent | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const action = typeof p["action"] === "string" ? p["action"] : null;
  const data = (typeof p["data"] === "object" && p["data"] !== null ? p["data"] : p) as Record<string, unknown>;
  const session = (typeof data["agentSession"] === "object" && data["agentSession"] !== null
    ? data["agentSession"]
    : data) as Record<string, unknown>;
  const sessionId = typeof session["id"] === "string" ? session["id"] : null;
  if (action === null || sessionId === null) return null;

  const issue = (typeof session["issue"] === "object" && session["issue"] !== null
    ? session["issue"]
    : undefined) as Record<string, unknown> | undefined;
  const issueId = typeof issue?.["id"] === "string" ? issue["id"] : undefined;
  const promptContext =
    typeof session["promptContext"] === "string" && session["promptContext"].trim() !== ""
      ? session["promptContext"]
      : undefined;
  const guidance =
    typeof session["guidance"] === "string" && session["guidance"].trim() !== ""
      ? session["guidance"]
      : undefined;

  // prompted: the inbound user message rides agentActivity.body (digest).
  const activity = (typeof data["agentActivity"] === "object" && data["agentActivity"] !== null
    ? data["agentActivity"]
    : undefined) as Record<string, unknown> | undefined;
  const promptBody =
    typeof activity?.["body"] === "string" && activity["body"].trim() !== ""
      ? activity["body"]
      : undefined;

  return { action, sessionId, issueId, promptContext, promptBody, guidance };
}

// ---------------------------------------------------------------------------
// Signature + body
// ---------------------------------------------------------------------------

/** Constant-time HMAC-SHA256 check (hex digests; length-mismatch safe). */
export function verifyLinearSignature(
  secret: string,
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (signatureHeader === undefined) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader.trim().toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The signing input Linear uses (documented in the digest header note). */
export function signForTest(secret: string, rawBody: Buffer): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

function readBody(req: IncomingMessage, capBytes = 1_000_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > capBytes) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// The handler
// ---------------------------------------------------------------------------

/**
 * Build the POST /webhooks/linear-agent handler (mount via the http.ts
 * caller-passed-handler pattern). Never throws: Linear must see 2xx for
 * everything but auth/config failures.
 */
export function createAgentWebhookHandler(
  deps: AgentWebhookDeps,
): (req: IncomingMessage, res: ServerResponse) => void {
  const now = deps.now ?? (() => new Date());
  const skip = (deliveryId: string | null, reason: string): void => {
    deps.store.appendAudit(AUDIT_INBOUND, {
      runId: undefined,
      detail: { ok: true, skipped: true, reason, deliveryId },
    });
  };

  return (req, res) => {
    void (async (): Promise<void> => {
      if (req.method !== "POST") {
        res.writeHead(405, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "method not allowed" }));
        return;
      }
      const secret = deps.secrets.getSigningSecret();
      if (secret === null) {
        // Operator must configure the signing secret — a loud 503, never
        // accept unsigned traffic.
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "webhook signing secret not configured" }));
        return;
      }
      const raw = await readBody(req);
      const signature = req.headers["linear-signature"];
      if (!verifyLinearSignature(secret, raw, typeof signature === "string" ? signature : undefined)) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "bad signature" }));
        return;
      }

      const deliveryHeader = req.headers["linear-delivery"];
      const deliveryId = typeof deliveryHeader === "string" ? deliveryHeader : null;
      const ack = (): void => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      };

      // Delivery replay rail: a re-delivered id never re-runs.
      if (deliveryId !== null) {
        const seen = deps.store
          .listAudit({})
          .some((row) => {
            if (row["kind"] !== AUDIT_INBOUND) return false;
            const detail = typeof row["detail_json"] === "string" ? JSON.parse(row["detail_json"]) : null;
            return detail !== null && detail.deliveryId === deliveryId;
          });
        if (seen) {
          ack();
          return;
        }
      }

      let event: AgentSessionEvent | null = null;
      try {
        event = readAgentSessionEvent(JSON.parse(raw.toString("utf8")));
      } catch {
        event = null;
      }
      if (event === null) {
        skip(deliveryId, "unparseable payload");
        ack();
        return;
      }

      if (event.action === "created") {
        const loopId = deps.inboundLoop.getInboundLoopId();
        if (loopId === null) {
          skip(deliveryId, `no inbound loop configured (session ${event.sessionId})`);
          ack();
          return;
        }
        const message =
          event.promptContext ??
          [event.guidance, event.issueId !== undefined ? `Issue: ${event.issueId}` : null]
            .filter((s) => s !== null)
            .join("\n\n");
        if (message.trim() === "") {
          skip(deliveryId, `created without usable context (session ${event.sessionId})`);
          ack();
          return;
        }
        const result = await deps.commands.requestRun({
          loopId,
          kind: "event",
          requestedAt: now().toISOString(),
          triggerEventId: `agentSession:${event.sessionId}`,
          target: {
            entityType: "issue",
            entityId: event.issueId ?? event.sessionId,
          },
        });
        deps.store.appendAudit(AUDIT_INBOUND, {
          loopId,
          runId: result.runId,
          detail: {
            ok: true,
            action: "created",
            deliveryId,
            sessionId: event.sessionId,
            runId: result.runId ?? null,
          },
        });
        ack();
        return;
      }

      if (event.action === "prompted") {
        const runId = readRunForSession(deps.store, event.sessionId);
        if (runId === null || event.promptBody === undefined) {
          skip(deliveryId, `prompted with no mapped run (session ${event.sessionId})`);
          ack();
          return;
        }
        deps.commands.steerRun(runId, event.promptBody);
        deps.store.appendAudit(AUDIT_INBOUND, {
          runId,
          detail: { ok: true, action: "prompted", deliveryId, sessionId: event.sessionId, runId },
        });
        ack();
        return;
      }

      skip(deliveryId, `unhandled action: ${event.action}`);
      ack();
    })().catch(() => {
      // Last-ditch: never hang Linear's 5s ACK window on an internal fault.
      if (!res.headersSent) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, note: "internal skip" }));
      } else {
        res.end();
      }
    });
  };
}

/** sessionId → runId from the audit rail (latest created wins). */
export function readRunForSession(store: Store, sessionId: string): EntityId | null {
  let found: EntityId | null = null;
  for (const row of store.listAudit({})) {
    if (row["kind"] !== AUDIT_INBOUND) continue;
    const detail = typeof row["detail_json"] === "string" ? JSON.parse(row["detail_json"]) : null;
    if (
      detail !== null &&
      detail.action === "created" &&
      detail.sessionId === sessionId &&
      typeof detail.runId === "string"
    ) {
      found = detail.runId;
    }
  }
  return found;
}
