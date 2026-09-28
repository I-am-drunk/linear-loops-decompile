// Hand-written stub for Issue.DRYymPCa.js (G34 case; original code). The
// entry consumes exactly one member, `ni` (raw export map: `C1 as ni`) — the
// agentApplicationsInfo GraphQL fetch. It is never executed here (the fetch
// op's body is the Issue chunk's own ledger row): the stub RECORDS argument
// identity (the exact graphQLClient object and the concrete ids array the
// entry's queryFn closes over) and returns a marker.
export const calls = [];
export const ni = (client, ids) => {
  calls.push({ client, ids });
  return `stub:Issue.ni(agentApplicationsInfo)`;
};
