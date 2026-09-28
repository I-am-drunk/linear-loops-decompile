// Hand-written drive-mode driver for TeamAgentSkillsSettingsPage.C2EeluTr.js
// (G14; original code). The chunk's export map is
// `export{d as Component, l as pageMetadata}`:
//   entry.pageMetadata — chunk-local `l`: a pure module-level metadata
//     literal {id, title, description, keywords}. Unlike G11's factory this
//     one has NO applicable member and NO scope parameter — both worth
//     pinning as facts (ownKeys is the pin).
//   entry.Component — chunk-local `d`: the mobx-wrapped route component
//     (out of this golden's scope; its displayName assignment runs at module
//     eval and is projected below as a fact).
// pageMetadata is plain serializable data, so the driver projects it verbatim
// (own-key order preserved by the serializer) plus the Component's
// displayName string (module-eval fact; the function itself is not
// serializable and stays out of scope).
export default async ({ entry }) => {
  return {
    pageMetadata: entry.pageMetadata,
    componentDisplayName: entry.Component.displayName,
  };
};
