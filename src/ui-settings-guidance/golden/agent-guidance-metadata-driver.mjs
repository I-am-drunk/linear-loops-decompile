// Hand-written drive-mode driver for AgentGuidanceSettings.BgeC_uVo.js (G11;
// original code). The chunk's export map is `export{p as n, m as t}`:
//   entry.n — the settings-metadata factory: (scope) => scope === `team`
//             ? {id:`team-agent-guidance`, title, description, keywords, applicable}
//             : {id:`workspace-agent-guidance`, …}
//   entry.t — the mobx-observer settings component (NOT this case's subject;
//             its imports are linking-only throw-on-use stubs).
// The metadata objects carry an `applicable` PREDICATE (a function — the
// tagged-v2 serializer rightly refuses it), so the driver projects it
// explicitly: its value on the four organization shapes that span the
// predicate's condition `organization.agentAppUsers.some(u => u.isActive &&
// !!u.oauthClientId)` — no agents / active-with-client / active-without-client
// / inactive-with-client. Both scope branches (`team`, `workspace`) plus the
// factory's else-branch behavior on a non-`team` string are projected, so one
// case pins the whole observable factory surface.
export default async ({ entry }) => {
  const factory = entry.n;
  const orgs = {
    noAgents: { agentAppUsers: [] },
    activeWithClient: { agentAppUsers: [{ isActive: true, oauthClientId: `client-1` }] },
    activeWithoutClient: { agentAppUsers: [{ isActive: true, oauthClientId: null }] },
    inactiveWithClient: { agentAppUsers: [{ isActive: false, oauthClientId: `client-2` }] },
    mixedSecondQualifies: { agentAppUsers: [{ isActive: false, oauthClientId: `client-3` }, { isActive: true, oauthClientId: `client-4` }] },
  };
  const project = (metadata) => ({
    id: metadata.id,
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    ownKeys: Object.keys(metadata),
    applicable: Object.fromEntries(
      Object.entries(orgs).map(([name, organization]) => [name, metadata.applicable({ organization })]),
    ),
  });
  return {
    team: project(factory(`team`)),
    workspace: project(factory(`workspace`)),
    // the factory branches on STRICT equality with `team`; any other value
    // takes the workspace branch — pinned via the id of a representative
    nonTeamStringTakesWorkspaceBranch: factory(`Team`).id,
    undefinedTakesWorkspaceBranch: factory(undefined).id,
  };
};
