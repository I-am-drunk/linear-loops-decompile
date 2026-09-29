// Hand-written drive-mode driver for NewAgentIssuerSettingsPage.iSpIpxtS.js
// (G26; original code — the G14/G17 driver pattern verbatim). The chunk's
// export map is `export{A as Component, k as pageMetadata}`:
//   entry.pageMetadata — chunk-local `k`: a pure module-level two-key literal
//     {id: `new-agent-issuer`, title: `Add approved issuer`} — NO description,
//     NO keywords, NO sections (the smallest metadata shape in the family so
//     far; the ownKeys-verbatim projection pins each absence as a fact).
//   entry.Component — chunk-local `A`: the outer route component (its
//     module-eval `displayName` assignment is projected as a fact; the body —
//     useSearchParams/useStore + the suspenseObserver-wrapped form component —
//     is out of T1 scope and stays declared GAP).
// The module-local callback-params class `D` (static parse/redirect) and the
// sx table `M` evaluate at import but are unexported — unreachable from the
// module surface, so their pins ride a future Component-tier golden (the
// AiConversationCancel precedent, #225 14:58Z).
export default async ({ entry }) => {
  return {
    pageMetadata: entry.pageMetadata,
    ownKeys: Object.keys(entry.pageMetadata),
    componentDisplayName: entry.Component.displayName,
    ownExportNames: Object.keys(entry).sort(),
  };
};
