// Hand-written drive-mode driver for useActiveAgents.DsLeeQpq.js (G34;
// original code). The chunk's export map is `export{s as n, c as t}`:
//   n = the active-agents hook (store read, allUsers hydrate-with-reset,
//       suspense query over the agent-applications info fetch, useMemo
//       reduce of applicationInfoByIds into an id-keyed map, and the
//       filter/orderBy projection of organization.agentAppUsers);
//   t = the prefetch (await allUsers.hydrate(arg) THEN await
//       queryClient.prefetchQuery(<the same descriptor>)).
// Corpus source, verified by hand in both trees (module-locals):
//   l(e) = e.filter(e => e.isActive && !!e.oauthClientId).orderBy(`name`)
//   u(e) = { queryKey: [`agentApplicationsInfo`, ids.join(`,`)],
//            queryFn: () => ni(e.graphQLClient, ids) }
//     with ids = l(e.organization.agentAppUsers).map(e => e.oauthClientId).concrete()
// The store's collection surface (filter/orderBy/map/concrete) is a DRIVER
// FIXTURE, not a stub: the corpus collection class is its own ledger row, so
// the fixture implements only the members this chunk touches (filter applies
// the chunk's predicate; orderBy records its argument and preserves filter
// order) and anything else is absent — an unexpected read fails loudly.
const collection = (items) => ({
  filter(pred) {
    return collection(items.filter(pred));
  },
  orderBy(key) {
    return {
      orderedBy: key,
      items,
      map(f) {
        const mapped = items.map(f);
        return { concrete: () => mapped };
      },
    };
  },
});

export default async ({ entry, load }) => {
  const useStoreStub = await load(`useStore`);
  const resolvePromiseStub = await load(`resolvePromise`);
  const queryStub = await load(`ContextualMenuActions`);
  const issueStub = await load(`Issue`);
  const reactStub = await load(`react`);

  // --- fixtures -------------------------------------------------------------
  // Four agentAppUsers pin both filter conjuncts independently:
  //   kept:    isActive && oauthClientId
  //   dropped: isActive && !oauthClientId   (the !! coercion arm)
  //   dropped: !isActive && oauthClientId   (the isActive arm)
  //   kept:    second keeper — the ids join needs >1 element to pin the comma
  const users = [
    { id: `au-1`, name: `Zeta Agent`, isActive: true, oauthClientId: `oc-zeta` },
    { id: `au-2`, name: `NoClient Agent`, isActive: true, oauthClientId: null },
    { id: `au-3`, name: `Inactive Agent`, isActive: false, oauthClientId: `oc-inactive` },
    { id: `au-4`, name: `Alpha Agent`, isActive: true, oauthClientId: `oc-alpha` },
  ];
  const hydrateCalls = [];
  const graphQLClient = { pinned: `graphql-client-fixture` };
  const store = {
    organization: {
      id: `org-fixture-1`,
      allUsers: { hydrate: (...args) => { hydrateCalls.push({ args }); return Promise.resolve(`hydrated`); } },
      agentAppUsers: collection(users),
    },
    graphQLClient,
  };
  const appInfoA = { id: `oc-zeta`, name: `Zeta App` };
  const appInfoB = { id: `oc-alpha`, name: `Alpha App` };
  const queryData = { applicationInfoByIds: [appInfoA, appInfoB] };

  // --- probe 1: the hook (export n) ----------------------------------------
  useStoreStub.setStore(store);
  queryStub.setQueryData(queryData);
  const hook = entry.n();

  const resolveCall = resolvePromiseStub.calls[0];
  const descriptor = queryStub.queries[0];
  // The descriptor's queryFn closes over the Issue seam; invoke it once to
  // record the argument identity the corpus code passes.
  const queryFnResult = descriptor.queryFn();
  const issueCall = issueStub.calls[0];

  const projectOrdered = (r) => ({ orderedBy: r.orderedBy, items: r.items });

  const hookProbe = {
    resolvePromise: {
      calls: resolvePromiseStub.calls.length,
      resetKeyIsOrgId: resolveCall.resetKey === store.organization.id,
      optsKeys: resolveCall.optsKeys,
      thunkHydrated: { calls: hydrateCalls.length, args: hydrateCalls[0].args },
    },
    query: {
      descriptors: queryStub.queries.length,
      queryKey: descriptor.queryKey,
      descriptorKeys: Object.keys(descriptor),
      queryFnResult,
      issueCall: {
        calls: issueStub.calls.length,
        clientIsStoreGraphQLClient: issueCall.client === graphQLClient,
        ids: issueCall.ids,
      },
    },
    useMemo: {
      calls: reactStub.memoCalls.length,
      depsLength: reactStub.memoCalls[0].deps.length,
      depsIsQueryData: reactStub.memoCalls[0].deps[0] === queryData,
    },
    returnKeys: Object.keys(hook),
    activeAgentUsers: projectOrdered(hook.activeAgentUsers),
    oauthAppById: {
      keys: Object.keys(hook.oauthAppById),
      zetaIsSameObject: hook.oauthAppById[`oc-zeta`] === appInfoA,
      alphaIsSameObject: hook.oauthAppById[`oc-alpha`] === appInfoB,
    },
  };

  // --- probe 2: the prefetch (export t) -------------------------------------
  const order = [];
  const prefetchHydrateCalls = [];
  const prefetchStore = {
    organization: {
      id: `org-fixture-2`,
      allUsers: { hydrate: (...args) => { order.push(`hydrate`); prefetchHydrateCalls.push({ args }); return Promise.resolve(`hydrated-2`); } },
      agentAppUsers: collection(users),
    },
    graphQLClient,
  };
  const prefetched = [];
  const queryClient = { prefetchQuery: (d) => { order.push(`prefetchQuery`); prefetched.push(d); return Promise.resolve(`prefetched`); } };
  const teamsArg = { pinned: `hydrate-arg-fixture` };
  await entry.t(prefetchStore, queryClient, teamsArg);

  const prefetchDescriptor = prefetched[0];
  const issueCallsBefore = issueStub.calls.length;
  const prefetchQueryFnResult = prefetchDescriptor.queryFn();
  const prefetchIssueCall = issueStub.calls[issueCallsBefore];

  const prefetchProbe = {
    order,
    hydrate: { calls: prefetchHydrateCalls.length, argIsTeamsArg: prefetchHydrateCalls[0].args[0] === teamsArg, argCount: prefetchHydrateCalls[0].args.length },
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
};
