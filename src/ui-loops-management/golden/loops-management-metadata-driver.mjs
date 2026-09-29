// Hand-written drive-mode driver for LoopsManagementPage.CVnaEF7c.js export
// `n` (the loops-management page metadata, chunk-local `Q`) — G23; original
// code. `Q` is a pure module-level literal (`{id:`loops-management`,
// title:`Manage loops`, keywords:`automations usage manage`}`, hand-verified
// at its raw definition). The driver projects it verbatim (own-key order) and
// pins the entry's public export-name surface; every component/page export
// (a/i/r/t — providers, filter panels, the usage page) is render/effect-tier
// and stays declared GAP.
export default async ({ entry }) => ({
  pageMetadata: entry.n,
  ownKeys: Object.keys(entry.n),
  ownExportNames: Object.keys(entry).sort(),
});
