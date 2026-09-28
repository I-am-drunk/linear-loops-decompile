/**
 * Golden test (the G0 acceptance bar): our clean module, driven through the
 * SAME fixtures the committed drive-mode driver used
 * (golden/use-active-agents-driver.mjs, mirrored line-for-line) and projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the declared observation driver), must
 * byte-match the committed corpus-executed golden.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  useActiveAgents,
  prefetchActiveAgents,
  type ActiveAgentsDeps,
  type ActiveAgentsStore,
  type AgentUserCollection,
  type OrderedAgentUsers,
  type QueryDescriptor,
} from "./use-active-agents.ts";

const goldenPath = join(import.meta.dirname, `golden`, `use-active-agents.behavior.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: unknown;
};

interface FixtureUser {
  id: string;
  name: string;
  isActive: boolean;
  oauthClientId: string | null;
}

interface FixtureInfo {
  id: string;
  name: string;
}

type FixtureClient = { pinned: string };

/** The driver's collection fixture, mirrored: filter applies the module's predicate; orderBy records its argument and preserves filter order. */
interface OrderedFixture extends OrderedAgentUsers<FixtureUser> {
  orderedBy: string;
  items: FixtureUser[];
}

function collection(items: FixtureUser[]): AgentUserCollection<FixtureUser> {
  return {
    filter(pred: (user: FixtureUser) => boolean): AgentUserCollection<FixtureUser> {
      return collection(items.filter(pred));
    },
    orderBy(key: string): OrderedFixture {
      return {
        orderedBy: key,
        items,
        map<TOut>(f: (user: FixtureUser) => TOut): { concrete(): TOut[] } {
          const mapped = items.map(f);
          return { concrete: (): TOut[] => mapped };
        },
      };
    },
  };
}

/** Replays the corpus-side driver's exact fixture lifecycle against the clean module. */
async function surface(): Promise<unknown> {
  const users: FixtureUser[] = [
    { id: `au-1`, name: `Zeta Agent`, isActive: true, oauthClientId: `oc-zeta` },
    { id: `au-2`, name: `NoClient Agent`, isActive: true, oauthClientId: null },
    { id: `au-3`, name: `Inactive Agent`, isActive: false, oauthClientId: `oc-inactive` },
    { id: `au-4`, name: `Alpha Agent`, isActive: true, oauthClientId: `oc-alpha` },
  ];
  const hydrateCalls: { args: unknown[] }[] = [];
  const graphQLClient: FixtureClient = { pinned: `graphql-client-fixture` };
  const store: ActiveAgentsStore<FixtureUser, FixtureClient> = {
    organization: {
      id: `org-fixture-1`,
      allUsers: { hydrate: (...args: unknown[]): Promise<unknown> => { hydrateCalls.push({ args }); return Promise.resolve(`hydrated`); } },
      agentAppUsers: collection(users),
    },
    graphQLClient,
  };
  const appInfoA: FixtureInfo = { id: `oc-zeta`, name: `Zeta App` };
  const appInfoB: FixtureInfo = { id: `oc-alpha`, name: `Alpha App` };
  const queryData = { applicationInfoByIds: [appInfoA, appInfoB] };

  // The recording seams, mirroring the corpus case's declared stubs.
  const resolveCalls: { thunk: () => unknown; resetKey: string; optsKeys: string[] }[] = [];
  const queries: QueryDescriptor[] = [];
  const issueCalls: { client: FixtureClient; ids: string[] }[] = [];
  const memoCalls: { deps: unknown[] }[] = [];
  const deps: ActiveAgentsDeps<FixtureUser, FixtureClient, FixtureInfo> = {
    useStore: () => store,
    resolveWithReset: (thunk, opts) => {
      resolveCalls.push({ thunk, resetKey: opts.resetKey, optsKeys: Object.keys(opts) });
      thunk();
    },
    useSuspenseQuery: (descriptor) => {
      queries.push(descriptor);
      return { data: queryData };
    },
    useMemo: (compute, memoDeps) => {
      memoCalls.push({ deps: memoDeps });
      return compute();
    },
    fetchAgentApplicationsInfo: (client, ids) => {
      issueCalls.push({ client, ids });
      return `stub:Issue.ni(agentApplicationsInfo)`;
    },
  };

  // --- probe 1: the hook ------------------------------------------------------
  const hook = useActiveAgents(deps);

  const resolveCall = resolveCalls[0]!;
  const descriptor = queries[0]!;
  const queryFnResult = descriptor.queryFn();
  const issueCall = issueCalls[0]!;

  const projectOrdered = (r: OrderedAgentUsers<FixtureUser>): unknown => {
    const o = r as OrderedFixture;
    return { orderedBy: o.orderedBy, items: o.items };
  };

  const hookProbe = {
    resolvePromise: {
      calls: resolveCalls.length,
      resetKeyIsOrgId: resolveCall.resetKey === store.organization.id,
      optsKeys: resolveCall.optsKeys,
      thunkHydrated: { calls: hydrateCalls.length, args: hydrateCalls[0]!.args },
    },
    query: {
      descriptors: queries.length,
      queryKey: descriptor.queryKey,
      descriptorKeys: Object.keys(descriptor),
      queryFnResult,
      issueCall: {
        calls: issueCalls.length,
        clientIsStoreGraphQLClient: issueCall.client === graphQLClient,
        ids: issueCall.ids,
      },
    },
    useMemo: {
      calls: memoCalls.length,
      depsLength: memoCalls[0]!.deps.length,
      depsIsQueryData: memoCalls[0]!.deps[0] === queryData,
    },
    returnKeys: Object.keys(hook),
    activeAgentUsers: projectOrdered(hook.activeAgentUsers),
    oauthAppById: {
      keys: Object.keys(hook.oauthAppById),
      zetaIsSameObject: hook.oauthAppById[`oc-zeta`] === appInfoA,
      alphaIsSameObject: hook.oauthAppById[`oc-alpha`] === appInfoB,
    },
  };

  // --- probe 2: the prefetch --------------------------------------------------
  const order: string[] = [];
  const prefetchHydrateCalls: { args: unknown[] }[] = [];
  const prefetchStore: ActiveAgentsStore<FixtureUser, FixtureClient> = {
    organization: {
      id: `org-fixture-2`,
      allUsers: { hydrate: (...args: unknown[]): Promise<unknown> => { order.push(`hydrate`); prefetchHydrateCalls.push({ args }); return Promise.resolve(`hydrated-2`); } },
      agentAppUsers: collection(users),
    },
    graphQLClient,
  };
  const prefetched: QueryDescriptor[] = [];
  const queryClient = {
    prefetchQuery: (d: QueryDescriptor): Promise<unknown> => { order.push(`prefetchQuery`); prefetched.push(d); return Promise.resolve(`prefetched`); },
  };
  const teamsArg = { pinned: `hydrate-arg-fixture` };
  await prefetchActiveAgents(prefetchStore, queryClient, teamsArg, deps);

  const prefetchDescriptor = prefetched[0]!;
  const issueCallsBefore = issueCalls.length;
  const prefetchQueryFnResult = prefetchDescriptor.queryFn();
  const prefetchIssueCall = issueCalls[issueCallsBefore]!;

  const prefetchProbe = {
    order,
    hydrate: { calls: prefetchHydrateCalls.length, argIsTeamsArg: prefetchHydrateCalls[0]!.args[0] === teamsArg, argCount: prefetchHydrateCalls[0]!.args.length },
    descriptor: {
      queryKey: prefetchDescriptor.queryKey,
      descriptorKeys: Object.keys(prefetchDescriptor),
      queryFnResult: prefetchQueryFnResult,
      issueCall: {
        clientIsStoreGraphQLClient: prefetchIssueCall.client === graphQLClient,
        ids: prefetchIssueCall.ids,
      },
    },
  };

  return { hookProbe, prefetchProbe };
}

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (both exports)`, async () => {
  const ours = serialize(await surface());
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
});
