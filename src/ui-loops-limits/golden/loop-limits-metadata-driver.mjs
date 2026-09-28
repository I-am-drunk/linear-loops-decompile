// Hand-written drive-mode driver for LoopLimitsPage.BrXlWYB3.js export
// `pageMetadata` (G22; original code). The export is a pure ALIAS (`Z=V`,
// hand-verified in the raw entry) of UsageSubpageMetadata.DzyygjFb.js export
// `t` — the zero-import pure-value metadata chunk, which executes REAL in
// this golden. The driver projects the aliased literal verbatim (own-key
// order preserved by the serializer) and pins the alias identity against the
// loaded target module (the G21 pattern — an alias retarget breaks the
// golden). The page Component export (hydration effects, GraphQL spend
// query, filters, table columns) is render/effect-tier and stays declared
// GAP.
export default async ({ entry, load }) => {
  const target = await load(`UsageSubpageMetadata.DzyygjFb.js`);
  return {
    pageMetadata: entry.pageMetadata,
    ownKeys: Object.keys(entry.pageMetadata),
    aliasIdentity: {
      pageMetadataIsUsageSubpageT: entry.pageMetadata === target.t,
    },
    ownExportNames: Object.keys(entry).sort(),
  };
};
