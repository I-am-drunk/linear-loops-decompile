/**
 * loopsManagementPageMetadata — clean reimplementation of export `n` of the
 * corpus chunk `LoopsManagementPage.CVnaEF7c.js` and its re-export through
 * the route shim `LoopsManagementPage.BAhf8Ti3.js` (matrix §A "Loops
 * management page" row). Original code; verified against the committed
 * corpus-executed goldens (`golden/loops-management.metadata.expected.json`
 * + `golden/loops-management.shim.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * The corpus metadata is the pure module-level literal `Q =
 * {id:`loops-management`, title:`Manage loops`, keywords:`automations usage
 * manage`}` (hand-verified at its raw definition), exported `Q as n` from the
 * page chunk and re-exported as `pageMetadata` by the shim (`import{n as e,t}
 * … export{t as Component, e as pageMetadata}` — the shim golden pins the
 * alias map with loaded-target identity checks). Own-key order (id, title,
 * keywords — no description member) is part of the golden bytes.
 *
 * Everything else in the pair (the source-icon renderer, the filter-values
 * helper, the filter panel, the usage page component) is render/effect/
 * store-tier and stays declared GAP pending T2/T3.
 */

export interface LoopsManagementPageMetadata {
  id: string;
  title: string;
  keywords: string;
}

/** LoopsManagementPage.CVnaEF7c.js export `n`, verbatim. */
export const loopsManagementPageMetadata: LoopsManagementPageMetadata = {
  id: `loops-management`,
  title: `Manage loops`,
  keywords: `automations usage manage`,
};

/** The shim's public re-export name — the corpus alias, mirrored. */
export const pageMetadata: LoopsManagementPageMetadata = loopsManagementPageMetadata;
