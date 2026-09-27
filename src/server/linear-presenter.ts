/**
 * Linear agent-session presenter (T-604 — golden-goose track B, issue #14).
 *
 * Mirrors a run's events into a NATIVE Linear agent session: our run shows
 * up inside real Linear as a first-class agent session, with our runtime's
 * parts streaming in as Linear agent activities. Linear's session UX is the
 * free surface; the brain stays the user's own harness (T-1105) — zero
 * Linear AI credits touched.
 *
 * Pattern: parallels persistence.ts (subscribe → mirror), and follows the
 * swarm's structural-seam rule — `AgentSessionWriter` mirrors the
 * dataplane's T-305 agent-sessions module (agent-08) field-for-field
 * against the official ops (extracts/linear-official/AGENT-API.md). The
 * composition root binds the real writer once T-305 + OAuth settings land;
 * this module never imports src/dataplane (the orchestrator's
 * CommentWriter pattern). Zero new deps.
 *
 * Part → activity mapping (ratified against the official content union —
 * our ActivityPartContent and Linear's AgentActivityContent are the same
 * vocabulary by design, model/conversation.ts):
 *
 *   thought { text }                    → { type: "thought", body }
 *   action { tool, args, result }       → { type: "action", action: label|tool,
 *                                         parameter, result }
 *   response { text }                   → { type: "response", body }
 *   elicitation { prompt, choices? }    → { type: "elicitation", body } +
 *                                         signal "select" when choices exist
 *   error { message }                   → { type: "error", body }
 *   steered (user-authored)             → SKIPPED: Linear's `prompt` activity
 *                                         is emitted BY Linear for inbound
 *                                         user messages, never by the agent.
 *
 * Terminal statuses: a run `error` emits one final error activity
 * (run.error); `canceled` emits a closing thought (a user cancel is not a
 * failure); `complete` needs nothing — the response activities already
 * carry it. Session state itself auto-derives from activities (digest).
 *
 * Durability / idempotency (the append-only audit log is the record, M5
 * convention): the created session id and every emitted activity id are
 * audited (`linear.session` / `linear.activity`). Re-presenting a run —
 * after a server restart, or a double-attach — consults the audit first
 * and never double-creates: Linear-side, the session + activities appear
 * exactly once. Writer failures never touch the run: they land in the
 * audit (ok:false) and the watch continues; session creation is retried
 * on the next event.
 *
 * Non-goals (documented, later slices): inbound AgentSessionEvent webhooks
 * (`created`/`prompted` → run start) need the server's webhook route + the
 * user's OAuth app (#14); the `stop` signal (user → agent halt) rides that
 * slice; `auth`/`continue` signals arrive with tool-calling.
 *
 * Original code. Official shapes: extracts/linear-official/ (MIT).
 */

import { createHash } from "node:crypto";

import type { Runner } from "../runtime/runner.ts";
import type { EntityId, Part, RunEvent, RunStatus } from "../runtime/types.ts";
import type { Store } from "./store.ts";

// ---------------------------------------------------------------------------
// The structural writer seam (mirror of T-305's module — keep compatible)
// ---------------------------------------------------------------------------

/**
 * Official activity content payloads (schema: content is a JSONObject keyed
 * by `type`; every type carries markdown `body`, action carries
 * action/parameter/result instead).
 */
export type PresentedActivityContent =
  | { type: "thought"; body: string }
  | { type: "action"; action: string; parameter: string; result?: string }
  | { type: "response"; body: string }
  | { type: "elicitation"; body: string }
  | { type: "error"; body: string };

export interface AgentSessionWriter {
  /** agentSessionCreateOnIssue — returns the new session's id. */
  createSessionOnIssue(input: {
    issueId: string;
    externalUrls?: { label: string; url: string }[];
  }): Promise<{ sessionId: string }>;
  /** agentActivityCreate. `id` is the client-provided UUID v4 — the
   *  presenter's replay dedupe rail (recorded in our audit log). */
  createActivity(input: {
    agentSessionId: string;
    content: PresentedActivityContent;
    signal?: "select";
    signalMetadata?: Record<string, unknown>;
    id?: string;
    ephemeral?: boolean;
  }): Promise<{ id: string }>;
}

export interface LinearPresenterOptions {
  writer: AgentSessionWriter;
  store: Store;
  /**
   * Public URL of OUR run view, attached as the session's external URL —
   * points Linear users at our UI and keeps the session from being marked
   * unresponsive (digest §AgentSession).
   */
  runViewUrl: (runId: EntityId) => string;
}

const AUDIT_SESSION = "linear.session";
const AUDIT_ACTIVITY = "linear.activity";
const TERMINAL: ReadonlySet<RunStatus> = new Set(["complete", "error", "canceled"]);

// ---------------------------------------------------------------------------
// Part mapping (exported for tests)
// ---------------------------------------------------------------------------

export interface MappedActivity {
  content: PresentedActivityContent;
  signal?: "select";
  signalMetadata?: Record<string, unknown>;
}

/** Map one runtime part to a Linear activity; null = intentionally skipped. */
export function partToActivity(part: Part): MappedActivity | null {
  switch (part.kind) {
    case "thought":
      return { content: { type: "thought", body: part.text } };
    case "action":
      return {
        content: {
          type: "action",
          action: part.label !== "" ? part.label : part.tool,
          parameter: part.argsSummary ?? "",
          ...(part.resultSummary !== undefined ? { result: part.resultSummary } : {}),
        },
      };
    case "response":
      return { content: { type: "response", body: part.text } };
    case "elicitation": {
      const hasChoices = part.choices !== undefined && part.choices.length > 0;
      return {
        content: { type: "elicitation", body: part.prompt },
        ...(hasChoices
          ? { signal: "select" as const, signalMetadata: { choices: part.choices } }
          : {}),
      };
    }
    case "error":
      return { content: { type: "error", body: part.message } };
    case "steered":
      // Inbound user text: Linear emits `prompt` activities itself (digest).
      return null;
  }
}

// ---------------------------------------------------------------------------
// The presenter
// ---------------------------------------------------------------------------

interface SessionRecord {
  sessionId: string;
}

function readSessionRecord(store: Store, runId: EntityId): SessionRecord | null {
  for (const row of store.listAudit({ runId })) {
    if (row["kind"] !== AUDIT_SESSION) continue;
    const detail = typeof row["detail_json"] === "string" ? JSON.parse(row["detail_json"]) : null;
    if (detail !== null && detail.ok === true && typeof detail.sessionId === "string") {
      return { sessionId: detail.sessionId };
    }
  }
  return null;
}

/** Part keys already emitted (audit-first replay dedupe). */
function readEmittedParts(store: Store, runId: EntityId): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of store.listAudit({ runId })) {
    if (row["kind"] !== AUDIT_ACTIVITY) continue;
    const detail = typeof row["detail_json"] === "string" ? JSON.parse(row["detail_json"]) : null;
    if (detail !== null && detail.ok === true && typeof detail.partKey === "string") {
      out.set(detail.partKey, typeof detail.activityId === "string" ? detail.activityId : "");
    }
  }
  return out;
}

/**
 * Deterministic activity id (UUID v4 FORMAT) from run+part: the second
 * dedupe rail. Linear accepts a client-provided id on agentActivityCreate,
 * so a re-emit racing the audit write (or a replay after a crash between
 * writer call and audit) collides on Linear's side and never double-posts.
 * Hash-derived, formatted as v4 — the op validates format, not provenance.
 */
export function partActivityId(runId: EntityId, partKey: string): string {
  const bytes = createHash("sha256").update(`loops:${runId}:${partKey}`).digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 1
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Present one run as a Linear agent session. Attaches like persistRun
 * (events replay from seq 0, so late attachment loses nothing — the audit
 * dedupe keeps replays idempotent). No-op when the run has no issue target:
 * sessions attach to issues in v1. Returns the unsubscribe function.
 */
export function presentRun(
  runner: Runner,
  runId: EntityId,
  options: LinearPresenterOptions,
): () => void {
  const run = runner.getRun(runId);
  if (run === undefined) return () => {};
  const target = run.target;
  if (target === undefined || target.entity !== "issue") return () => {};
  const { writer, store } = options;

  // Session memo: created lazily on first use, retried after a failure.
  let sessionPromise: Promise<string | null> | null = null;
  const ensureSession = (): Promise<string | null> => {
    if (sessionPromise !== null) return sessionPromise;
    const existing = readSessionRecord(store, runId);
    if (existing !== null) {
      sessionPromise = Promise.resolve(existing.sessionId);
      return sessionPromise;
    }
    const url = options.runViewUrl(runId);
    sessionPromise = writer
      .createSessionOnIssue({ issueId: target.id, externalUrls: [{ label: "Run view", url }] })
      .then((result) => {
        store.appendAudit(AUDIT_SESSION, {
          loopId: run.loopId,
          runId,
          detail: { ok: true, sessionId: result.sessionId },
        });
        return result.sessionId;
      })
      .catch((error: unknown) => {
        store.appendAudit(AUDIT_SESSION, {
          loopId: run.loopId,
          runId,
          detail: { ok: false, error: error instanceof Error ? error.message : String(error) },
        });
        sessionPromise = null; // retry on the next event
        return null;
      });
    return sessionPromise;
  };

  const emit = (partKey: string, mapped: MappedActivity): void => {
    const already = readEmittedParts(store, runId);
    if (already.has(partKey)) return;
    void ensureSession().then((sessionId) => {
      if (sessionId === null) return;
      const activityId = partActivityId(runId, partKey);
      return writer
        .createActivity({
          agentSessionId: sessionId,
          content: mapped.content,
          id: activityId,
          ...(mapped.signal !== undefined ? { signal: mapped.signal } : {}),
          ...(mapped.signalMetadata !== undefined ? { signalMetadata: mapped.signalMetadata } : {}),
        })
        .then(() => {
          store.appendAudit(AUDIT_ACTIVITY, {
            loopId: run.loopId,
            runId,
            detail: { ok: true, partKey, activityId },
          });
        })
        .catch((error: unknown) => {
          store.appendAudit(AUDIT_ACTIVITY, {
            loopId: run.loopId,
            runId,
            detail: {
              ok: false,
              partKey,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        });
    });
  };

  const off = runner.subscribe(runId, (event: RunEvent) => {
    if (event.type === "partAppended") {
      // The appended part is the turn's last; the turn:index key is stable
      // across replays (events re-emit in order), which is what makes the
      // audit dedupe exact.
      const turns = runner.getTurns(runId);
      const turn = turns.find((t) => t.id === event.turnId);
      const index = turn === undefined ? -1 : turn.parts.length - 1;
      if (index < 0) return;
      const mapped = partToActivity(event.part);
      if (mapped === null) return;
      emit(`${event.turnId}:${index}`, mapped);
      return;
    }
    if (event.type === "runStatus" && TERMINAL.has(event.status)) {
      if (event.status === "error") {
        emit("run:error", {
          content: { type: "error", body: event.run.error ?? "run failed" },
        });
      } else if (event.status === "canceled") {
        emit("run:canceled", {
          content: { type: "thought", body: "Run canceled by user." },
        });
      }
      // Let the terminal activity settle, then detach: subscribe replay would
      // otherwise re-emit nothing (audit dedupe) but the listener is dead weight.
      queueMicrotask(() => off());
    }
  });
  return off;
}
