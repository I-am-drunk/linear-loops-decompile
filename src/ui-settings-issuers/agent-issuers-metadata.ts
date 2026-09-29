/**
 * agentIssuersPageMetadata — clean reimplementation of the corpus chunk
 * `AgentIssuersSettingsPage.BuFJumP7.js` export `pageMetadata` (matrix §F
 * "Issuers" row, first golden on that row). Original code; every value below
 * is verified against the committed corpus-executed golden
 * (`golden/agent-issuers.metadata.expected.json`) — see `corpus-manifest.json`
 * and the golden test.
 *
 * The corpus export (`export{N as Component, M as pageMetadata}`; `M` is the
 * metadata) is a pure module-level literal. Its shape is a §F variation
 * worth naming: it carries a nested `sections` map of two `{id, title}`
 * groups but NO keywords member (unlike the G14-family shapes), NO
 * `applicable`, and NO scope parameter — all pinned by the golden's
 * per-level ownKeys projections.
 *
 * The chunk's other export `Component` (the suspenseObserver-wrapped issuers
 * management page: workloadIssuers hydration, sorted issuer list, max-issuer
 * limit gating, remove-issuer AlertDialog flow) is out of this golden's
 * scope; its module-eval `displayName` assignment IS observable and
 * golden-pinned, carried by the constant below.
 *
 * Key ORDER is part of the golden bytes (id, title, description, sections;
 * sections: configured, add; each group: id, title), preserved below. Zero
 * runtime deps, strip-only TS.
 */

export interface AgentIssuersSectionMetadata {
  id: string;
  title: string;
}

export interface AgentIssuersPageMetadata {
  id: string;
  title: string;
  description: string;
  sections: {
    configured: AgentIssuersSectionMetadata;
    add: AgentIssuersSectionMetadata;
  };
}

export const agentIssuersPageMetadata: AgentIssuersPageMetadata = {
  id: `agent-issuers`,
  title: `Agent issuers`,
  description: `Every subject matching an approved issuer and tenant can create an app user with access to all public teams. Apps can request read and write access. Private teams are not accessible. Removing a binding retains attribution. Adding it again does not unsuspend users.`,
  sections: {
    configured: {
      id: `configured-agent-issuers`,
      title: `Configured agent issuers`,
    },
    add: {
      id: `add-agent-issuers`,
      title: `Available issuers`,
    },
  },
};

/** The page component's module-eval displayName (corpus:
 * `N.displayName = \`AgentIssuersSettingsPage\``). The component itself is
 * out of this package's scope — see corpus-manifest.json. */
export const agentIssuersComponentDisplayName = `AgentIssuersSettingsPage`;
