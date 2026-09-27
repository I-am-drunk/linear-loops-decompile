/**
 * Fixture mode: a Transport that never touches the network.
 *
 * Two uses (target-architecture: "fixture mode for offline tests"):
 * - Engine/runtime/inference roles develop against canned Linear data without
 *   a PAT or network access.
 * - Tests assert on exactly which operations were sent (`calls` records every
 *   request) and script failures (rate limits, auth errors, flaky 500s).
 *
 * Matching: a fixture registers on { operationName } or a substring of the
 * query text, optionally with a variables predicate. First matching fixture
 * wins. Responses can be static, a function of the variables, or an error to
 * throw (already-typed dataplane errors).
 */

import type { ExecuteOptions, GraphQLRequest, Transport } from "./transport.js";
import { RateLimitError, ServerError, type LinearApiError } from "./errors.js";

export interface RecordedCall {
  query: string;
  variables: Record<string, unknown>;
  operationName: string | undefined;
  at: number;
}

export type FixtureResponse =
  | { data: unknown }
  | { error: LinearApiError }
  | ((variables: Record<string, unknown>) => { data: unknown } | { error: LinearApiError });

export interface Fixture {
  /** Match on GraphQL operationName (exact)… */
  operationName?: string;
  /** …or on a substring of the query text (e.g. "query Issues"). */
  queryIncludes?: string;
  /** Optional extra guard on variables. */
  when?: (variables: Record<string, unknown>) => boolean;
  respond: FixtureResponse;
  /** Simulated latency in ms (default 0). */
  latencyMs?: number;
}

export interface FixtureTransportOptions {
  fixtures: Fixture[];
  /** Behavior when nothing matches: throw (default) or return empty data. */
  onUnmatched?: "throw" | "empty";
  now?: () => number;
}

export class UnmatchedFixtureError extends Error {
  constructor(req: GraphQLRequest) {
    super(
      `FixtureTransport: no fixture matched ` +
        `${req.operationName ?? req.query.slice(0, 80)}`,
    );
    this.name = "UnmatchedFixtureError";
  }
}

export class FixtureTransport implements Transport {
  readonly calls: RecordedCall[] = [];
  private readonly fixtures: Fixture[];
  private readonly onUnmatched: "throw" | "empty";
  private readonly now: () => number;

  constructor(options: FixtureTransportOptions) {
    this.fixtures = [...options.fixtures];
    this.onUnmatched = options.onUnmatched ?? "throw";
    this.now = options.now ?? (() => Date.now());
  }

  /** Add a fixture at runtime (tests script scenarios step by step). */
  add(fixture: Fixture): void {
    this.fixtures.push(fixture);
  }

  async execute<T>(req: GraphQLRequest, _opts: ExecuteOptions = {}): Promise<T> {
    const variables = req.variables ?? {};
    this.calls.push({
      query: req.query,
      variables,
      operationName: req.operationName,
      at: this.now(),
    });

    const fixture = this.fixtures.find((f) => {
      if (f.operationName !== undefined && f.operationName !== req.operationName) return false;
      if (f.queryIncludes !== undefined && !req.query.includes(f.queryIncludes)) return false;
      if (f.when !== undefined && !f.when(variables)) return false;
      return true;
    });

    if (!fixture) {
      if (this.onUnmatched === "empty") return {} as T;
      throw new UnmatchedFixtureError(req);
    }
    if (fixture.latencyMs && fixture.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, fixture.latencyMs));
    }

    const outcome =
      typeof fixture.respond === "function" ? fixture.respond(variables) : fixture.respond;
    if ("error" in outcome) throw outcome.error;
    return outcome.data as T;
  }
}

/**
 * A small, realistic canned workspace for offline dev and smoke tests.
 * Field names follow Linear's public schema (factual, not copied code) —
 * enough for the loops engine to evaluate triggers against.
 */
export function createDemoWorkspace(): FixtureTransport {
  const team = {
    id: "team-eng-01",
    key: "ENG",
    name: "Engineering",
  };
  const states = [
    { id: "st-backlog", name: "Backlog", type: "backlog", position: 0 },
    { id: "st-todo", name: "Todo", type: "unstarted", position: 1 },
    { id: "st-progress", name: "In Progress", type: "started", position: 2 },
    { id: "st-review", name: "In Review", type: "started", position: 3 },
    { id: "st-done", name: "Done", type: "completed", position: 4 },
  ];
  const labels = [
    { id: "lb-bug", name: "Bug", color: "#eb5757" },
    { id: "lb-feat", name: "Feature", color: "#bb87fc" },
  ];
  const issues = [
    {
      id: "iss-0001",
      identifier: "ENG-1",
      title: "Set up CI pipeline",
      priority: 2,
      state: states[2],
      team,
      labels: { nodes: [labels[1]] },
      url: "https://linear.app/demo/issue/ENG-1",
      createdAt: "2026-09-20T10:00:00.000Z",
      updatedAt: "2026-09-25T15:30:00.000Z",
    },
    {
      id: "iss-0002",
      identifier: "ENG-2",
      title: "Fix flaky login test",
      priority: 1,
      state: states[1],
      team,
      labels: { nodes: [labels[0]] },
      url: "https://linear.app/demo/issue/ENG-2",
      createdAt: "2026-09-21T09:00:00.000Z",
      updatedAt: "2026-09-26T08:15:00.000Z",
    },
  ];

  const page = <T>(nodes: T[]) => ({
    nodes,
    pageInfo: { hasNextPage: false, endCursor: null },
  });

  return new FixtureTransport({
    fixtures: [
      {
        operationName: "VerifyCredential",
        respond: {
          data: {
            viewer: {
              id: "user-demo-01",
              name: "Demo User",
              displayName: "demo",
              email: "demo@example.com",
            },
          },
        },
      },
      { queryIncludes: "teams", respond: { data: { teams: page([team]) } } },
      {
        queryIncludes: "workflowStates",
        respond: { data: { workflowStates: page(states) } },
      },
      {
        queryIncludes: "issues",
        respond: { data: { issues: page(issues) } },
      },
      {
        queryIncludes: "issueLabels",
        respond: { data: { issueLabels: page(labels) } },
      },
    ],
    onUnmatched: "throw",
  });
}

/** Prebuilt failure fixtures for retry/budget tests. */
export const failureFixtures = {
  rateLimited: (retryAfterMs = 1000): Fixture => ({
    queryIncludes: "", // matches everything
    respond: { error: new RateLimitError("fixture: rate limited", retryAfterMs) },
  }),
  flakyThenOk: (
    transport: FixtureTransport,
    match: Omit<Fixture, "respond">,
    okData: unknown,
    failuresBeforeOk = 2,
  ): void => {
    let remaining = failuresBeforeOk;
    transport.add({
      ...match,
      respond: () =>
        remaining-- > 0
          ? { error: new ServerError(500, "fixture: flaky 500") }
          : { data: okData },
    });
  },
};

