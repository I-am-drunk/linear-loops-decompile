// Hand-written drive-mode driver for AgentIssuersSettingsPage.BuFJumP7.js
// (G25; original code — the G14/G17 driver pattern verbatim). The chunk's
// export map is `export{N as Component, M as pageMetadata}`:
//   entry.pageMetadata — chunk-local `M`: a pure module-level metadata
//     literal {id, title, description, sections:{configured:{id,title},
//     add:{id,title}}}. Unlike the G14-family §F shapes it carries NO
//     keywords member, and like them NO applicable member and NO scope
//     parameter — the ownKeys projections at every level pin the absences.
//   entry.Component — chunk-local `N`: the suspenseObserver-wrapped issuers
//     management component (out of this golden's scope; its module-eval
//     `N.displayName = `AgentIssuersSettingsPage`` assignment is projected
//     as a fact).
// pageMetadata is plain serializable data, so the driver projects it
// verbatim (own-key order preserved by the serializer) plus explicit
// ownKeys pins per level and the entry's public export-name surface.
export default async ({ entry }) => {
  const m = entry.pageMetadata;
  return {
    pageMetadata: m,
    ownKeys: Object.keys(m),
    sectionsOwnKeys: Object.keys(m.sections),
    configuredOwnKeys: Object.keys(m.sections.configured),
    addOwnKeys: Object.keys(m.sections.add),
    componentDisplayName: entry.Component.displayName,
    ownExportNames: Object.keys(entry).sort(),
  };
};
