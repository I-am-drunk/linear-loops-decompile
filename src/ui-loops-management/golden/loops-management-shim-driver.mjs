// Hand-written drive-mode driver for the RE-EXPORT SHIM
// LoopsManagementPage.BAhf8Ti3.js (G23; original code; the G21 alias-map
// pattern). The raw shim is `import{n as e,t}from"./LoopsManagementPage.
// CVnaEF7c.js";export{t as Component, e as pageMetadata}`. The driver pins
// the alias map with loaded-target identity checks (the #276 finding — a
// swap of n/t would otherwise pass on names+types) and re-projects the
// surfaced metadata, whose region must byte-match the target golden's.
export default async ({ entry, load }) => {
  const target = await load(`LoopsManagementPage.CVnaEF7c.js`);
  return {
    pageMetadata: entry.pageMetadata,
    ownKeys: Object.keys(entry.pageMetadata),
    aliasIdentity: {
      pageMetadataIsTargetN: entry.pageMetadata === target.n,
      componentIsTargetT: entry.Component === target.t,
    },
    ownExportNames: Object.keys(entry).sort(),
  };
};
