/**
 * Typed read operations (T-302) — the Linear entities loops need, nothing more.
 *
 * Field sets are deliberately minimal (YAGNI): enough for trigger evaluation
 * (R4), context assembly (R5), and the UI's pickers (R7/R8). Add fields when a
 * consumer actually needs them. Field names follow Linear's public GraphQL
 * schema, cross-checked against extracts/models.md (client sync models share
 * the same names for these core entities).
 *
 * Everything here is a thin, typed wrapper over `client.request` + `paginate`
 * — no caching, no client-side filtering beyond what the API does.
 */

import type { LinearClient } from "./client.js";
import { paginate, type Connection } from "./pagination.js";

// ---------------------------------------------------------------------------
// Types (minimal read shapes)
// ---------------------------------------------------------------------------

export interface TeamRef {
  id: string;
  key: string;
  name: string;
}

export interface WorkflowState {
  id: string;
  name: string;
  /** backlog | unstarted | started | completed | canceled | triage */
  type: string;
  position: number;
}

export interface IssueLabel {
  id: string;
  name: string;
  color: string;
}

export interface Cycle {
  id: string;
  number: number;
  name?: string | null;
  startsAt: string;
  endsAt: string;
  completedAt?: string | null;
}

export interface Project {
  id: string;
  name: string;
  /** Public API exposes a free-form state name (backlog/planned/started/…). */
  state: string;
  url: string;
  targetDate?: string | null;
}

export interface IssueSummary {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  priority: number;
  estimate?: number | null;
  dueDate?: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  state: { id: string; name: string; type: string };
  team: { id: string; key: string };
  assignee?: { id: string; displayName: string } | null;
  labels: { id: string; name: string }[];
}

export interface IssueComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; displayName: string } | null;
}

// ---------------------------------------------------------------------------
// GraphQL fragments (selection sets in one place so field drift is one edit)
// ---------------------------------------------------------------------------

const ISSUE_FIELDS = /* GraphQL */ `
  id
  identifier
  title
  description
  priority
  estimate
  dueDate
  url
  createdAt
  updatedAt
  state { id name type }
  team { id key }
  assignee { id displayName }
  labels { nodes { id name } }
`;

type RawIssue = Omit<IssueSummary, "labels"> & {
  labels: { nodes: { id: string; name: string }[] };
};

function toIssueSummary(raw: RawIssue): IssueSummary {
  const { labels, ...rest } = raw;
  return { ...rest, labels: labels.nodes };
}

// ---------------------------------------------------------------------------
// Simple list reads (single request; these collections are small)
// ---------------------------------------------------------------------------

/** All teams in the workspace (settings pickers, trigger scoping). */
export async function listTeams(client: LinearClient): Promise<TeamRef[]> {
  const data = await client.request<{ teams: Connection<TeamRef> }>(
    /* GraphQL */ `
      query DataplaneTeams($after: String) {
        teams(after: $after, first: 100) {
          nodes { id key name }
          pageInfo { hasNextPage endCursor }
        }
      }
    `,
    {},
    { operationName: "DataplaneTeams" },
  );
  return data.teams.nodes;
}

/** Workflow states, optionally scoped to one team (state-change targets). */
export async function listWorkflowStates(
  client: LinearClient,
  teamId?: string,
): Promise<WorkflowState[]> {
  const data = await client.request<{ workflowStates: Connection<WorkflowState> }>(
    /* GraphQL */ `
      query DataplaneWorkflowStates($filter: WorkflowStateFilter) {
        workflowStates(first: 100, filter: $filter) {
          nodes { id name type position }
          pageInfo { hasNextPage endCursor }
        }
      }
    `,
    teamId ? { filter: { team: { id: { eq: teamId } } } } : {},
    { operationName: "DataplaneWorkflowStates" },
  );
  return data.workflowStates.nodes;
}

/** Issue labels, optionally scoped to one team (condition matching). */
export async function listLabels(
  client: LinearClient,
  teamId?: string,
): Promise<IssueLabel[]> {
  const data = await client.request<{ issueLabels: Connection<IssueLabel> }>(
    /* GraphQL */ `
      query DataplaneLabels($filter: IssueLabelFilter) {
        issueLabels(first: 100, filter: $filter) {
          nodes { id name color }
          pageInfo { hasNextPage endCursor }
        }
      }
    `,
    teamId ? { filter: { team: { id: { eq: teamId } } } } : {},
    { operationName: "DataplaneLabels" },
  );
  return data.issueLabels.nodes;
}

/** Cycles for a team, newest-ish first; pass `activeOnly` for trigger use. */
export async function listCycles(
  client: LinearClient,
  teamId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<Cycle[]> {
  const data = await client.request<{ cycles: Connection<Cycle> }>(
    /* GraphQL */ `
      query DataplaneCycles($filter: CycleFilter) {
        cycles(first: 50, filter: $filter) {
          nodes { id number name startsAt endsAt completedAt }
          pageInfo { hasNextPage endCursor }
        }
      }
    `,
    {
      filter: {
        team: { id: { eq: teamId } },
        ...(opts.activeOnly ? { isActive: { eq: true } } : {}),
      },
    },
    { operationName: "DataplaneCycles" },
  );
  return data.cycles.nodes;
}

/** Projects, optionally scoped to one team. */
export async function listProjects(
  client: LinearClient,
  opts: { teamId?: string } = {},
): Promise<Project[]> {
  const data = await client.request<{ projects: Connection<Project> }>(
    /* GraphQL */ `
      query DataplaneProjects($filter: ProjectFilter) {
        projects(first: 100, filter: $filter) {
          nodes { id name state url targetDate }
          pageInfo { hasNextPage endCursor }
        }
      }
    `,
    opts.teamId ? { filter: { accessibleTeams: { some: { id: { eq: opts.teamId } } } } } : {},
    { operationName: "DataplaneProjects" },
  );
  return data.projects.nodes;
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export interface IssueFilter {
  teamId?: string;
  /** WorkflowState.type values, e.g. ["started","unstarted"]. */
  stateTypes?: string[];
  /** Only issues updated after this ISO timestamp (poll-based triggers). */
  updatedSince?: string;
  /** Label names (any-match). */
  labelNames?: string[];
}

function buildIssueFilter(f: IssueFilter): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (f.teamId) filter.team = { id: { eq: f.teamId } };
  if (f.stateTypes?.length) filter.state = { type: { in: f.stateTypes } };
  if (f.updatedSince) filter.updatedAt = { gt: f.updatedSince };
  if (f.labelNames?.length) filter.labels = { name: { in: f.labelNames } };
  return filter;
}

/**
 * One issue by UUID **or identifier** ("ENG-123" works in the public API).
 * Returns null when it doesn't exist (lookup, not an error).
 */
export async function getIssue(
  client: LinearClient,
  idOrIdentifier: string,
): Promise<IssueSummary | null> {
  const data = await client.request<{ issue: RawIssue | null }>(
    /* GraphQL */ `
      query DataplaneIssue($id: String!) {
        issue(id: $id) { ${ISSUE_FIELDS} }
      }
    `,
    { id: idOrIdentifier },
    { operationName: "DataplaneIssue" },
  );
  return data.issue ? toIssueSummary(data.issue) : null;
}

/**
 * Stream issues matching a filter, oldest-update first — the poll fallback
 * for event triggers (R4). Yields one issue at a time; the caller decides
 * when to stop (typically: updatedAt < lastPollWatermark).
 */
export async function* listIssues(
  client: LinearClient,
  filter: IssueFilter = {},
  opts: { pageSize?: number; maxPages?: number; signal?: AbortSignal } = {},
): AsyncGenerator<IssueSummary, void, undefined> {
  const pageSize = opts.pageSize ?? 50;
  const apiFilter = buildIssueFilter(filter);
  const fetchPage = async (after: string | null) => {
    const data = await client.request<{ issues: Connection<RawIssue> }>(
      /* GraphQL */ `
        query DataplaneIssues($filter: IssueFilter, $after: String, $first: Int) {
          issues(filter: $filter, after: $after, first: $first) {
            nodes { ${ISSUE_FIELDS} }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
      { filter: apiFilter, after, first: pageSize },
      { operationName: "DataplaneIssues", ...(opts.signal !== undefined ? { signal: opts.signal } : {}) },
    );
    return data.issues;
  };
  for await (const raw of paginate(fetchPage, {
    ...(opts.maxPages !== undefined ? { maxPages: opts.maxPages } : {}),
    ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
  })) {
    yield toIssueSummary(raw);
  }
}

/**
 * Comments on an issue, oldest first. `since` is applied client-side because
 * it's a nested connection (the engine's comment-match triggers use this).
 */
export async function* listComments(
  client: LinearClient,
  issueId: string,
  opts: { since?: string; pageSize?: number; maxPages?: number } = {},
): AsyncGenerator<IssueComment, void, undefined> {
  const pageSize = opts.pageSize ?? 50;
  const fetchPage = async (after: string | null) => {
    const data = await client.request<{
      issue: { comments: Connection<IssueComment> } | null;
    }>(
      /* GraphQL */ `
        query DataplaneIssueComments($id: String!, $after: String, $first: Int) {
          issue(id: $id) {
            comments(after: $after, first: $first) {
              nodes { id body createdAt updatedAt user { id displayName } }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      `,
      { id: issueId, after, first: pageSize },
      { operationName: "DataplaneIssueComments" },
    );
    if (!data.issue) return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    return data.issue.comments;
  };
  for await (const c of paginate(fetchPage, {
    ...(opts.maxPages !== undefined ? { maxPages: opts.maxPages } : {}),
  })) {
    if (opts.since && c.createdAt <= opts.since) continue;
    yield c;
  }
}

