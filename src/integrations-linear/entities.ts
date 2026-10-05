/**
 * Linear entity reads (IG3, docs/plan/integrations.md).
 *
 * The entities Linear contributes, and list/get for them through the
 * hardened GraphQL client in src/server/linear-client.ts — header-driven rate
 * budget, RATELIMITED-on-400 handling, kept unchanged. Queries are written
 * against the public MIT schema in extracts/linear-official/schema.graphql;
 * every type and field named here was checked to exist there.
 *
 * The client is injected behind a one-method interface, so this file is
 * testable without a network and the real LinearClient satisfies it as-is.
 * `reachable()` lives here: the `viewer` query is what proves a stored token
 * actually works, which IG2 deliberately does not claim.
 */

import type { IntegrationEntity, IntegrationStatus } from "../integrations/types.ts";

/** What we need from LinearClient, structurally. */
export type GraphqlClient = {
  query<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
};

/** The six entity kinds the plan names, with the fields a trigger filter or action input can use. */
export const LINEAR_ENTITIES: readonly IntegrationEntity[] = [
  { kind: `issue`, label: `Issue`, fields: [
    { name: `identifier`, type: `string` }, { name: `title`, type: `string`, required: true },
    { name: `priority`, type: `number` }, { name: `state`, type: `ref`, of: `workflowState` },
    { name: `team`, type: `ref`, of: `team` }, { name: `assignee`, type: `ref`, of: `user` },
  ] },
  { kind: `project`, label: `Project`, fields: [
    { name: `name`, type: `string`, required: true }, { name: `state`, type: `string` },
    { name: `lead`, type: `ref`, of: `user` },
  ] },
  { kind: `team`, label: `Team`, fields: [
    { name: `key`, type: `string`, required: true }, { name: `name`, type: `string`, required: true },
  ] },
  { kind: `cycle`, label: `Cycle`, fields: [
    { name: `number`, type: `number`, required: true }, { name: `name`, type: `string` },
    { name: `startsAt`, type: `string` }, { name: `endsAt`, type: `string` },
    { name: `team`, type: `ref`, of: `team` },
  ] },
  { kind: `document`, label: `Document`, fields: [
    { name: `title`, type: `string`, required: true }, { name: `project`, type: `ref`, of: `project` },
  ] },
  { kind: `initiative`, label: `Initiative`, fields: [
    { name: `name`, type: `string`, required: true }, { name: `status`, type: `string` },
  ] },
];

/** A page of entities. `endCursor` is Linear's own; absent on the last page. */
export type Page<T> = { nodes: T[]; endCursor?: string };

export type IssueRow = { id: string; identifier: string; title: string; priority: number; stateName?: string; teamKey?: string };
export type ProjectRow = { id: string; name: string; state: string };

/** Cursor-paginated issue list. `first` is capped at 50: the client's rate budget is per complexity, and 50 is what Linear's own UI pages at. */
const ISSUES_QUERY = `query Issues($first: Int!, $after: String) {
  issues(first: $first, after: $after) {
    nodes { id identifier title priority state { name } team { key } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const ISSUE_QUERY = `query Issue($id: String!) {
  issue(id: $id) { id identifier title priority state { name } team { key } }
}`;

const PROJECTS_QUERY = `query Projects($first: Int!, $after: String) {
  projects(first: $first, after: $after) {
    nodes { id name state }
    pageInfo { hasNextPage endCursor }
  }
}`;

const PROJECT_QUERY = `query Project($id: String!) { project(id: $id) { id name state } }`;

/** The viewer query: the cheapest call that proves a token works. */
const VIEWER_QUERY = `query Viewer { viewer { id name } }`;

/** Linear's own page cap for list views; also keeps per-call complexity bounded. */
export const PAGE_MAX = 50;

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === `object` && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

const str = (v: unknown): string | undefined => (typeof v === `string` ? v : undefined);

/** Shape a raw issue node. Unknown shapes are dropped, never invented. */
function issueRow(v: unknown): IssueRow | undefined {
  const r = asRecord(v);
  const id = str(r?.[`id`]), identifier = str(r?.[`identifier`]), title = str(r?.[`title`]);
  if (!id || !identifier || title === undefined) return undefined;
  const priority = typeof r?.[`priority`] === `number` ? (r[`priority`] as number) : 0;
  const stateName = str(asRecord(r?.[`state`])?.[`name`]);
  const teamKey = str(asRecord(r?.[`team`])?.[`key`]);
  return { id, identifier, title, priority, ...(stateName ? { stateName } : {}), ...(teamKey ? { teamKey } : {}) };
}

function projectRow(v: unknown): ProjectRow | undefined {
  const r = asRecord(v);
  const id = str(r?.[`id`]), name = str(r?.[`name`]);
  if (!id || name === undefined) return undefined;
  return { id, name, state: str(r?.[`state`]) ?? `` };
}

/** Read a Relay-style connection into a Page, dropping malformed nodes. */
function page<T>(conn: unknown, row: (v: unknown) => T | undefined): Page<T> {
  const c = asRecord(conn);
  const nodes = (Array.isArray(c?.[`nodes`]) ? c[`nodes`] : []).map(row).filter((x): x is T => x !== undefined);
  const info = asRecord(c?.[`pageInfo`]);
  const more = info?.[`hasNextPage`] === true;
  const cursor = str(info?.[`endCursor`]);
  return more && cursor ? { nodes, endCursor: cursor } : { nodes };
}

/** Clamp a requested page size to [1, PAGE_MAX]. */
const clamp = (first: number | undefined): number => Math.max(1, Math.min(PAGE_MAX, first ?? PAGE_MAX));

export type EntityResult<T> = { ok: true; value: T } | { ok: false; detail: string };

export function makeLinearEntities(client: GraphqlClient) {
  /** Run a query, turning a thrown client error into a value the caller can record. */
  async function run<T>(q: string, vars: Record<string, unknown>, shape: (data: unknown) => T | undefined, what: string):
    Promise<EntityResult<T>> {
    let data: unknown;
    try {
      data = await client.query<unknown>(q, vars);
    } catch (e) {
      return { ok: false, detail: `${what}: ${e instanceof Error ? e.message : String(e)}` };
    }
    const v = shape(data);
    return v === undefined ? { ok: false, detail: `${what}: unexpected response shape` } : { ok: true, value: v };
  }

  const listIssues = (first?: number, after?: string) =>
    run(ISSUES_QUERY, { first: clamp(first), ...(after ? { after } : {}) },
      (d) => page(asRecord(d)?.[`issues`], issueRow), `issues`);

  const getIssue = (id: string) =>
    run(ISSUE_QUERY, { id }, (d) => issueRow(asRecord(d)?.[`issue`]), `issue ${id}`);

  const listProjects = (first?: number, after?: string) =>
    run(PROJECTS_QUERY, { first: clamp(first), ...(after ? { after } : {}) },
      (d) => page(asRecord(d)?.[`projects`], projectRow), `projects`);

  const getProject = (id: string) =>
    run(PROJECT_QUERY, { id }, (d) => projectRow(asRecord(d)?.[`project`]), `project ${id}`);

  /**
   * The viewer query proves a stored token WORKS, which IG2 deliberately does
   * not claim. The returned name is what the connection row shows as account.
   */
  async function reachable(): Promise<IntegrationStatus> {
    const r = await run(VIEWER_QUERY, {}, (d) => str(asRecord(asRecord(d)?.[`viewer`])?.[`name`]) ?? ``, `viewer`);
    if (!r.ok) return { state: `error`, detail: r.detail };
    return r.value ? { state: `connected`, account: r.value } : { state: `connected` };
  }

  return { entities: LINEAR_ENTITIES, listIssues, getIssue, listProjects, getProject, reachable };
}
