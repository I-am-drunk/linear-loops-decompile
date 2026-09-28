/**
 * loopLimitsPageMetadata — clean reimplementation of export `pageMetadata` of
 * the corpus chunk `LoopLimitsPage.BrXlWYB3.js` (matrix §C "Credit metering
 * surface" row; the loop spend-limits settings subpage metadata). Original
 * code; verified against the committed corpus-executed golden
 * (`golden/loop-limits.metadata.expected.json`) — see `corpus-manifest.json`
 * and the golden test.
 *
 * The corpus export is a pure ALIAS (`Z = V`, hand-verified in the raw entry)
 * of `UsageSubpageMetadata.DzyygjFb.js` export `t` — the loop-spend-limits
 * metadata literal, reproduced verbatim below with its own-key order (id,
 * title, keywords; note: NO description member, unlike the §F metadata
 * shapes — the golden's ownKeys region pins that). This module mirrors the
 * corpus structure: the literal lives here as the usage-subpage constant and
 * the page-level name is an alias of it, so the golden's alias-identity pin
 * has a reimplementation-side counterpart the test asserts.
 *
 * The chunk's Component export (the suspense-observer credit-metering page:
 * hydration effects, usageLimitSpendQuery, filter/table state) stays declared
 * GAP pending T2/T3.
 */

export interface UsageSubpageMetadata {
  id: string;
  title: string;
  keywords: string;
}

/** UsageSubpageMetadata.DzyygjFb.js export `t`, verbatim. */
export const loopSpendLimitsMetadata: UsageSubpageMetadata = {
  id: `loop-spend-limits`,
  title: `Usage`,
  keywords: `ai usage spend limits caps budget cost billing loops agent automation custom`,
};

/** LoopLimitsPage export `pageMetadata` — the corpus alias, mirrored. */
export const loopLimitsPageMetadata: UsageSubpageMetadata = loopSpendLimitsMetadata;
