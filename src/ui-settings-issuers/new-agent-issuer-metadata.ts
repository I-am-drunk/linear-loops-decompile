/**
 * newAgentIssuerPageMetadata — clean reimplementation of the corpus chunk
 * `NewAgentIssuerSettingsPage.iSpIpxtS.js` export `pageMetadata` (matrix §F
 * "Issuers" row, second chunk). Original code; every value below is verified
 * against the committed corpus-executed golden
 * (`golden/new-agent-issuer.metadata.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * The corpus export (`export{A as Component, k as pageMetadata}`; `k` is the
 * metadata) is a pure module-level TWO-key literal — no description, no
 * keywords, no sections: the smallest metadata shape in the §F family so far.
 * Each absence is a fact pinned by the golden's ownKeys-verbatim projection.
 *
 * The chunk's other export `Component` (the outer route component keying the
 * suspenseObserver-wrapped issuer form on `${organization.id}:${search}`,
 * plus the module-local callback-params class with its URL-validation
 * branches) is out of this golden's scope and stays declared GAP pending
 * T2/T3; its module-eval `displayName` assignment IS observable and
 * golden-pinned, carried by the constant below.
 *
 * Key ORDER is part of the golden bytes (id, title), preserved below.
 * Zero runtime deps, strip-only TS.
 */

export interface NewAgentIssuerPageMetadata {
  id: string;
  title: string;
}

export const newAgentIssuerPageMetadata: NewAgentIssuerPageMetadata = {
  id: `new-agent-issuer`,
  title: `Add approved issuer`,
};

/** The route component's module-eval displayName (corpus:
 * `A.displayName = \`NewAgentIssuerSettingsPage\``). The component itself is
 * out of this package's scope — see corpus-manifest.json. */
export const newAgentIssuerComponentDisplayName = `NewAgentIssuerSettingsPage`;
