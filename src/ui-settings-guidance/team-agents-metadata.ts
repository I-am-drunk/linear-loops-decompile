/**
 * teamAgentsPageMetadata — clean reimplementation of export `pageMetadata` of
 * the corpus chunk `TeamAgentsSettingsPage.BJ-fHoBc.js` (matrix §F "Team
 * agents" settings row). Original code; every value below is verified against
 * the committed corpus-executed golden
 * (`golden/team-agents.metadata.expected.json`) — see `corpus-manifest.json`
 * and the golden test.
 *
 * The corpus metadata is a MODULE-EVAL literal (hand-verified in the raw
 * chunk): id `team-agents`, title `Team agents`, the description copy, a
 * `descriptionElement` JSX FRAGMENT (the description text, a single space,
 * and a Docs link whose href is the `Issue.mi` constant
 * `https://linear.app/docs/agents-in-linear`), keywords `ai delegate team`,
 * and a `sections` map: `activeAgents` (an inline literal) and
 * `agentGuidance` — the OUTPUT of the golden-backed AgentGuidanceSettings
 * factory called with `"team"` at module eval (this module calls OUR
 * golden-backed reimplementation of that factory, mirroring the corpus's
 * cross-chunk call).
 *
 * The golden observes the fragment through the declared projection
 * ({fragment: [children]}; the Docs-link seam as a string marker); this
 * module produces that projected shape directly, parameterized over the same
 * seam so the test drives it with the golden's own marker. Own-key order is
 * part of the golden bytes and is preserved. Zero runtime deps, strip-only
 * TS.
 *
 * The chunk's other exports (`Component`/`TeamAgentsSettingsPage`, the
 * suspense-observer page components reading the active-agents store) are NOT
 * reimplemented here: render/effect-tier, declared GAP in the manifest.
 */

import {
  agentGuidanceSettingsMetadata,
  type AgentGuidanceSettingsMetadata,
} from "./agent-guidance-metadata.ts";

export const TEAM_AGENTS_DOCS_URL = `https://linear.app/docs/agents-in-linear`;

export interface ProjectedDocsLink {
  element: string;
  key: null;
  props: { href: string; children: string };
}

export interface ProjectedFragment {
  fragment: [string, string, ProjectedDocsLink];
}

export interface TeamAgentsSection {
  id: string;
  title: string;
  keywords: string;
}

export interface TeamAgentsPageMetadata {
  id: string;
  title: string;
  description: string;
  descriptionElement: ProjectedFragment;
  keywords: string;
  sections: {
    activeAgents: TeamAgentsSection;
    agentGuidance: AgentGuidanceSettingsMetadata;
  };
}

const DESCRIPTION = `AI agents can work alongside you as teammates. Tackle complex tasks together or delegate entire issues end-to-end.`;

/** Builds the metadata with the Docs-link seam injected (the golden's stub marker). */
export function teamAgentsPageMetadata(docsLinkSeam: string): TeamAgentsPageMetadata {
  return {
    id: `team-agents`,
    title: `Team agents`,
    description: DESCRIPTION,
    descriptionElement: {
      fragment: [
        DESCRIPTION,
        ` `,
        { element: docsLinkSeam, key: null, props: { href: TEAM_AGENTS_DOCS_URL, children: `Docs` } },
      ],
    },
    keywords: `ai delegate team`,
    sections: {
      activeAgents: {
        id: `team-active-agents`,
        title: `Active agents`,
        keywords: `agent user access enable disable`,
      },
      agentGuidance: agentGuidanceSettingsMetadata(`team`),
    },
  };
}
