/**
 * useActiveAgents — clean reimplementation of the corpus chunk
 * `useActiveAgents.DsLeeQpq.js` (matrix §F "Account agents" row). Original
 * code; the behavior is verified byte-for-byte against the committed
 * corpus-executed golden (`golden/use-active-agents.behavior.expected.json`)
 * — see `corpus-manifest.json` and the golden test, which replays the exact
 * driver fixtures against this module.
 *
 * Corpus source (export map `export{s as n, c as t}`), reproduced exactly:
 * - export n (the hook, `s`): reads the application store, then
 *   `resolvePromise.a(() => organization.allUsers.hydrate(), {resetKey:
 *   organization.id})` (hydrate called with ZERO args on this path), then the
 *   suspense query `jR(u(store))`, then `useMemo(() =>
 *   data.applicationInfoByIds.reduce((acc, info) => (acc[info.id] = info,
 *   acc), {}), [data])` — deps are exactly `[data]`. Returns
 *   `{activeAgentUsers: l(organization.agentAppUsers), oauthAppById}` (that
 *   own-key order).
 * - export t (the prefetch, `c`): `await store.organization.allUsers
 *   .hydrate(arg)` (the third parameter passed through as the single
 *   argument) THEN `await queryClient.prefetchQuery(u(store))` — order pinned
 *   by the golden.
 * - module-local l: `collection.filter(e => e.isActive && !!e.oauthClientId)
 *   .orderBy('name')` — both conjuncts and the literal ordering key.
 * - module-local u: ids = `l(organization.agentAppUsers)
 *   .map(e => e.oauthClientId).concrete()`; the descriptor is
 *   `{queryKey: ['agentApplicationsInfo', ids.join(',')],
 *   queryFn: () => fetchAgentApplicationsInfo(store.graphQLClient, ids)}` —
 *   key literal, comma join, own-key order, and queryFn argument identity
 *   (the exact graphQLClient object and the concrete ids array) all pinned.
 *
 * The React/store/query/fetch seams are injected here (the corpus binds them
 * by import; injection is the clean module's boundary — the golden test
 * injects the same recording fakes the corpus case's declared stubs used).
 * The store collection surface (filter/orderBy/map/concrete) is typed to
 * exactly the members the corpus chunk touches. Strip-only TS (AGENTS.md).
 */

export interface AgentAppUser {
  isActive: boolean;
  oauthClientId: string | null | undefined;
}

/** The store collection members this chunk consumes (corpus collection class stays its own surface). */
export interface AgentUserCollection<TUser extends AgentAppUser> {
  filter(predicate: (user: TUser) => boolean): AgentUserCollection<TUser>;
  orderBy(key: string): OrderedAgentUsers<TUser>;
}

export interface OrderedAgentUsers<TUser extends AgentAppUser> {
  map<TOut>(f: (user: TUser) => TOut): { concrete(): TOut[] };
}

export interface ApplicationInfo {
  id: string;
}

export interface ActiveAgentsStore<TUser extends AgentAppUser, TClient> {
  organization: {
    id: string;
    allUsers: { hydrate: (...args: unknown[]) => Promise<unknown> };
    agentAppUsers: AgentUserCollection<TUser>;
  };
  graphQLClient: TClient;
}

export interface QueryDescriptor {
  queryKey: [string, string];
  queryFn: () => unknown;
}

/** The injected seams (corpus: useStore/resolvePromise/useQuery-wrapper/Issue-fetch imports). */
export interface ActiveAgentsDeps<TUser extends AgentAppUser, TClient, TInfo extends ApplicationInfo> {
  useStore: () => ActiveAgentsStore<TUser, TClient>;
  resolveWithReset: (thunk: () => unknown, opts: { resetKey: string }) => void;
  useSuspenseQuery: (descriptor: QueryDescriptor) => { data: { applicationInfoByIds: TInfo[] } };
  useMemo: <T>(compute: () => T, deps: unknown[]) => T;
  fetchAgentApplicationsInfo: (client: TClient, ids: string[]) => unknown;
}

function activeAgentUsers<TUser extends AgentAppUser>(collection: AgentUserCollection<TUser>): OrderedAgentUsers<TUser> {
  return collection.filter((user) => user.isActive && !!user.oauthClientId).orderBy(`name`);
}

function agentApplicationsInfoQuery<TUser extends AgentAppUser, TClient, TInfo extends ApplicationInfo>(
  store: ActiveAgentsStore<TUser, TClient>,
  deps: ActiveAgentsDeps<TUser, TClient, TInfo>,
): QueryDescriptor {
  const ids = activeAgentUsers(store.organization.agentAppUsers)
    .map((user) => user.oauthClientId as string)
    .concrete();
  return {
    queryKey: [`agentApplicationsInfo`, ids.join(`,`)],
    queryFn: () => deps.fetchAgentApplicationsInfo(store.graphQLClient, ids),
  };
}

export function useActiveAgents<TUser extends AgentAppUser, TClient, TInfo extends ApplicationInfo>(
  deps: ActiveAgentsDeps<TUser, TClient, TInfo>,
): { activeAgentUsers: OrderedAgentUsers<TUser>; oauthAppById: Record<string, TInfo> } {
  const store = deps.useStore();
  const { organization } = store;
  deps.resolveWithReset(() => organization.allUsers.hydrate(), { resetKey: organization.id });
  const { data } = deps.useSuspenseQuery(agentApplicationsInfoQuery(store, deps));
  const oauthAppById = deps.useMemo(
    () => data.applicationInfoByIds.reduce<Record<string, TInfo>>((acc, info) => ((acc[info.id] = info), acc), {}),
    [data],
  );
  return {
    activeAgentUsers: activeAgentUsers(organization.agentAppUsers),
    oauthAppById,
  };
}

export async function prefetchActiveAgents<TUser extends AgentAppUser, TClient, TInfo extends ApplicationInfo>(
  store: ActiveAgentsStore<TUser, TClient>,
  queryClient: { prefetchQuery: (descriptor: QueryDescriptor) => Promise<unknown> | unknown },
  hydrateArg: unknown,
  deps: ActiveAgentsDeps<TUser, TClient, TInfo>,
): Promise<void> {
  await store.organization.allUsers.hydrate(hydrateArg);
  await queryClient.prefetchQuery(agentApplicationsInfoQuery(store, deps));
}
