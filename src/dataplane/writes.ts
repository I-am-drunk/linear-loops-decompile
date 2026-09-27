/**
 * Typed write operations (T-303) — the loop-output surface of the dataplane.
 *
 * Behavioral contract (target-architecture §server): every write is an audited,
 * idempotent command. How each write honors that:
 *
 * - `updateIssue` is field-setting (set semantics): sending the same input twice
 *   is a no-op the second time, so it is safe to retry after ambiguous failures
 *   (`idempotent: true` on the transport).
 * - `createComment` is NOT naturally idempotent — Linear will happily store the
 *   same comment twice. When the caller (the engine's run queue, T-403) supplies
 *   an `idempotencyKey`, we embed a hidden marker in the body and check the
 *   issue's recent comments for that marker first; a hit returns the existing
 *   comment instead of double-posting. The marker also makes retries safe, so
 *   keyed comments go out with `idempotent: true`.
 * - `setIssueState` is a name-resolving convenience over `updateIssue` — the
 *   two extra reads it costs are idempotent and budget-cheap.
 *
 * Approval gating and the audit log live one layer up (the server); this
 * package only guarantees the transport-level semantics above.
 */

import type { LinearClient } from "./client.js";
import {
  getIssue,
  listComments,
  listWorkflowStates,
  ISSUE_FIELDS,
  toIssueSummary,
  type IssueSummary,
  type RawIssue,
} from "./reads.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of any loop write. `deduplicated` marks an idempotency-key hit. */
export interface WriteResult<T> {
  value: T;
  /** True when an idempotency check found the write already applied. */
  deduplicated: boolean;
}

export interface CreatedComment {
  id: string;
  body: string;
  createdAt: string;
  url?: string | null;
}

export interface CreateCommentInput {
  issueId: string;
  body: string;
  /** Reply under an existing comment (threading for run output). */
  parentId?: string;
  /**
   * Engine-supplied key (e.g. `run:<runId>:comment`). Presence switches on
   * dedupe-before-post and safe retries. Without it a retry could double-post,
   * so unkeyed comments are sent exactly once (no retry).
   */
  idempotencyKey?: string;
}

/** Subset of Linear's IssueUpdateInput a loop may touch. */
export interface UpdateIssueInput {
  title?: string;
  description?: string;
  priority?: number;
  estimate?: number | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  stateId?: string;
  labelIds?: string[];
  projectId?: string | null;
  cycleId?: string | null;
}

/** Hidden marker embedded in keyed comments; survives Linear's markdown. */
export function idempotencyMarker(key: string): string {
  return `<!-- loops:write=${key} -->`;
}

// ---------------------------------------------------------------------------
// commentCreate — with optional dedupe-before-post
// ---------------------------------------------------------------------------

const CREATE_COMMENT = /* GraphQL */ `
  mutation DataplaneCreateComment($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment { id body createdAt url }
    }
  }
`;

/**
 * Post a comment on an issue. With `idempotencyKey`, an existing comment
 * carrying the same marker is returned instead (`deduplicated: true`) and no
 * mutation is sent — the engine can re-run a crashed run without spamming the
 * issue. Without a key the mutation goes out exactly once (transport default:
 * mutations are never retried).
 */
export async function createComment(
  client: LinearClient,
  input: CreateCommentInput,
): Promise<WriteResult<CreatedComment>> {
  const key = input.idempotencyKey;
  const marker = key !== undefined ? idempotencyMarker(key) : null;
  const body = marker ? `${input.body}\n\n${marker}` : input.body;

  if (marker) {
    for await (const c of listComments(client, input.issueId, { maxPages: 3 })) {
      if (c.body.includes(marker)) {
        return {
          value: { id: c.id, body: c.body, createdAt: c.createdAt },
          deduplicated: true,
        };
      }
    }
  }

  const data = await client.request<{
    commentCreate: { success: boolean; comment: CreatedComment | null };
  }>(
    CREATE_COMMENT,
    {
      input: {
        issueId: input.issueId,
        body,
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      },
    },
    { operationName: "DataplaneCreateComment", ...(marker ? { idempotent: true } : {}) },
  );
  if (!data.commentCreate.success || !data.commentCreate.comment) {
    throw new Error("commentCreate returned success=false");
  }
  return { value: data.commentCreate.comment, deduplicated: false };
}

// ---------------------------------------------------------------------------
// issueUpdate — set semantics, naturally idempotent
// ---------------------------------------------------------------------------

const UPDATE_ISSUE = /* GraphQL */ `
  mutation DataplaneUpdateIssue($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) {
      success
      issue { ${ISSUE_FIELDS} }
    }
  }
`;

/**
 * Set fields on an issue. Only the keys present in `input` are sent, so
 * partial updates never clobber untouched fields. Safe to retry.
 */
export async function updateIssue(
  client: LinearClient,
  issueId: string,
  input: UpdateIssueInput,
): Promise<WriteResult<IssueSummary>> {
  const data = await client.request<{
    issueUpdate: { success: boolean; issue: RawIssue | null };
  }>(
    UPDATE_ISSUE,
    { id: issueId, input },
    { operationName: "DataplaneUpdateIssue", idempotent: true },
  );
  if (!data.issueUpdate.success || !data.issueUpdate.issue) {
    throw new Error("issueUpdate returned success=false");
  }
  return { value: toIssueSummary(data.issueUpdate.issue), deduplicated: false };
}

/**
 * Move an issue to a named workflow state ("In Progress", "Done", …).
 * Resolves the name against the issue's team states (case-insensitive), then
 * delegates to `updateIssue`. Throws when the team has no such state — that is
 * a caller bug (bad loop config), not an API failure, hence a plain Error.
 */
export async function setIssueState(
  client: LinearClient,
  issueId: string,
  stateName: string,
): Promise<WriteResult<IssueSummary>> {
  const issue = await getIssue(client, issueId);
  if (!issue) throw new Error(`setIssueState: issue "${issueId}" not found`);
  const states = await listWorkflowStates(client, issue.team.id);
  const wanted = stateName.trim().toLowerCase();
  const state = states.find((s) => s.name.toLowerCase() === wanted);
  if (!state) {
    const known = states.map((s) => s.name).join(", ");
    throw new Error(
      `setIssueState: team ${issue.team.key} has no state "${stateName}" (known: ${known})`,
    );
  }
  return updateIssue(client, issueId, { stateId: state.id });
}

