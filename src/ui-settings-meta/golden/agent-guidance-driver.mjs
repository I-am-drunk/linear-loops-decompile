// Hand-written drive-mode driver for AgentGuidanceSettings.BgeC_uVo.js (G11;
// original code). The chunk's export map is `export{p as n, m as t}`:
//   entry.n — chunk-local `p`: the settings-metadata factory,
//             (scope) => scope === `team` ? teamMetadata : workspaceMetadata.
//   entry.t — chunk-local `m`: the mobx-wrapped settings page component. It
//             renders composite child elements ($P/ms from
//             ContextualMenuActions) — NOT T1-coverable; declared out of
//             golden scope in corpus-manifest.json, never touched here.
// Each metadata object carries the copy facts verbatim (id, title,
// description, keywords — own-key order preserved by the serializer) plus a
// function-valued `applicable` predicate over organization.agentAppUsers
// (`some(u => u.isActive && !!u.oauthClientId)`). Functions are not
// serializable in the tagged-v2 grammar, so the driver projects explicitly:
// the data keys verbatim, and `applicable` probed on the fixture combinations
// that pin both sides of each conjunct (active+clientId is the ONLY true;
// inactive, missing/null/empty clientId, empty list, and a mixed list where
// one user qualifies document the `some`).
const probeOrgs = {
  activeWithOauthClientId: [{ isActive: true, oauthClientId: `oauth-client-1` }],
  activeWithNullOauthClientId: [{ isActive: true, oauthClientId: null }],
  activeWithEmptyOauthClientId: [{ isActive: true, oauthClientId: `` }],
  inactiveWithOauthClientId: [{ isActive: false, oauthClientId: `oauth-client-1` }],
  noAgentAppUsers: [],
  mixedListOneQualifies: [
    { isActive: false, oauthClientId: `oauth-client-1` },
    { isActive: true, oauthClientId: null },
    { isActive: true, oauthClientId: `oauth-client-2` },
  ],
};

export default async ({ entry }) => {
  const factory = entry.n;
  const project = (metadata) => {
    const { applicable, ...data } = metadata;
    return {
      data,
      applicable: Object.fromEntries(
        Object.entries(probeOrgs).map(([name, agentAppUsers]) => [
          name,
          applicable({ organization: { agentAppUsers } }),
        ]),
      ),
    };
  };
  return {
    team: project(factory(`team`)),
    workspace: project(factory(`workspace`)),
    // the conditional is `scope === "team" ? … : …` — any other value falls
    // through to the workspace object; pin that with the id (full projection
    // would duplicate the workspace bytes above).
    nonTeamScopeFallsThroughToWorkspaceId: factory(`anything-else`).id,
  };
};
