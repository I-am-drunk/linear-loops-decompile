/**
 * Linear actions (IG5, docs/plan/integrations.md).
 *
 * The actions an automation can take on Linear — comment, update an issue,
 * set its status, create an issue — through the existing hardened client,
 * using mutations from the public MIT schema in
 * extracts/linear-official/schema.graphql (commentCreate, issueUpdate,
 * issueCreate; all three checked to exist there).
 *
 * Every invocation returns an AUDIT record, because the plan says writes
 * are audited: what was done, to which entity, on behalf of which
 * automation, and how it went. `idempotent` is declared per action so a
 * retry policy can tell comment (not safe twice) from setStatus (safe).
 *
 * The client is injected behind the same one-method interface IG3 uses, so
 * every path is testable without a network.
 */

import type { IntegrationAction } from "../integrations/types.ts";
import type { GraphqlClient } from "./entities.ts";

/** The four actions, with the inputs a prompt step or trigger can fill. */
export const LINEAR_ACTIONS: readonly IntegrationAction[] = [
  { kind: `comment`, label: `Comment on issue`, entity: `issue`, idempotent: false,
    inputs: [{ name: `issueId`, type: `ref`, of: `issue`, required: true }, { name: `body`, type: `string`, required: true }] },
  { kind: `setStatus`, label: `Set issue status`, entity: `issue`, idempotent: true,
    inputs: [{ name: `issueId`, type: `ref`, of: `issue`, required: true }, { name: `stateId`, type: `ref`, of: `workflowState`, required: true }] },
  { kind: `updateIssue`, label: `Update issue`, entity: `issue`, idempotent: true,
    inputs: [{ name: `issueId`, type: `ref`, of: `issue`, required: true }, { name: `title`, type: `string` },
      { name: `description`, type: `string` }, { name: `priority`, type: `number` }, { name: `assigneeId`, type: `ref`, of: `user` }] },
  { kind: `createIssue`, label: `Create issue`, entity: `issue`, idempotent: false,
    inputs: [{ name: `teamId`, type: `ref`, of: `team`, required: true }, { name: `title`, type: `string`, required: true },
      { name: `description`, type: `string` }] },
];

/** What a write produced, for the run transcript and the audit log. */
export type AuditRecord = {
  action: string;
  entityId?: string;
  automationId: string;
  at: string;
  ok: boolean;
  /** Linear's own id of the created/updated entity, when it returned one. */
  resultId?: string;
  detail?: string;
};

export type ActionResult = { ok: true; audit: AuditRecord } | { ok: false; audit: AuditRecord };

// Mutations against the public MIT schema. Each payload exposes `success`
// and the entity, which is all the audit record needs.
const COMMENT_CREATE = `mutation CommentCreate($input: CommentCreateInput!) {
  commentCreate(input: $input) { success comment { id } }
}`;
const ISSUE_UPDATE = `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) { success issue { id } }
}`;
const ISSUE_CREATE = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) { success issue { id } }
}`;

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === `object` && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

export function makeLinearActions(client: GraphqlClient, now: () => number = () => Date.now()) {
  /** Run one mutation and shape the audit record from its payload. */
  async function run(action: string, automationId: string, entityId: string | undefined,
    mutation: string, variables: Record<string, unknown>, payloadKey: string, entityKey: string): Promise<ActionResult> {
    const base = { action, automationId, at: new Date(now()).toISOString(), ...(entityId ? { entityId } : {}) };
    let data: unknown;
    try {
      data = await client.query<unknown>(mutation, variables);
    } catch (e) {
      return { ok: false, audit: { ...base, ok: false, detail: e instanceof Error ? e.message : String(e) } };
    }
    const payload = asRecord(asRecord(data)?.[payloadKey]);
    const success = payload?.[`success`] === true;
    const resultId = asRecord(payload?.[entityKey])?.[`id`];
    if (!success) return { ok: false, audit: { ...base, ok: false, detail: `${payloadKey} reported success=false` } };
    return { ok: true, audit: { ...base, ok: true, ...(typeof resultId === `string` ? { resultId } : {}) } };
  }

  const comment = (automationId: string, issueId: string, body: string) =>
    run(`comment`, automationId, issueId, COMMENT_CREATE, { input: { issueId, body } }, `commentCreate`, `comment`);

  const setStatus = (automationId: string, issueId: string, stateId: string) =>
    run(`setStatus`, automationId, issueId, ISSUE_UPDATE, { id: issueId, input: { stateId } }, `issueUpdate`, `issue`);

  /** Only the provided fields are sent; an absent key is not a null write. */
  const updateIssue = (automationId: string, issueId: string,
    fields: { title?: string; description?: string; priority?: number; assigneeId?: string }) => {
    const input = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    return run(`updateIssue`, automationId, issueId, ISSUE_UPDATE, { id: issueId, input }, `issueUpdate`, `issue`);
  };

  const createIssue = (automationId: string, teamId: string, title: string, description?: string) =>
    run(`createIssue`, automationId, undefined, ISSUE_CREATE,
      { input: { teamId, title, ...(description === undefined ? {} : { description }) } }, `issueCreate`, `issue`);

  return { actions: LINEAR_ACTIONS, comment, setStatus, updateIssue, createIssue };
}
