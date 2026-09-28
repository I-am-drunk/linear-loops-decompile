/**
 * workspaceAgentsPageMetadata — clean reimplementation of export
 * `pageMetadata` of the corpus chunk `WorkspaceAgentsSettingsPage.B-7Wg92g.js`
 * (matrix §F "Workspace agent settings" row). Original code; every value below
 * is verified against the committed corpus-executed golden
 * (`golden/workspace-agents.metadata.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * The corpus metadata is a MODULE-EVAL literal (hand-verified in the raw
 * chunk): id `agents`, title `Agents`, the description copy, a
 * `descriptionElement` JSX FRAGMENT (the description text, a single space,
 * and a Docs link whose href is the `Issue.mi` constant
 * `https://linear.app/docs/agents-in-linear`), keywords
 * `ai delegate installed`, and a `sections` map with EXACTLY ONE member:
 * `agentGuidance` — the OUTPUT of the golden-backed AgentGuidanceSettings
 * factory called with `"workspace"` at module eval (this module calls OUR
 * golden-backed reimplementation of that factory, mirroring the corpus's
 * cross-chunk call; G18's sibling pinned the `team` branch, this one pins
 * `workspace`). There is NO activeAgents section literal here, unlike the
 * team-agents shape — the golden's sectionsOwnKeys pins that absence.
 *
 * The golden observes the fragment through the declared projection
 * ({fragment: [children]}; the Docs-link seam as a string marker); this
 * module produces that projected shape directly, parameterized over the same
 * seam so the test drives it with the golden's own marker. Own-key order is
 * part of the golden bytes and is preserved. Zero runtime deps, strip-only
 * TS.
 *
 * The chunk's other export (`Component`, the suspenseObserver-wrapped page:
 * useStore + useActiveAgents store reads, ActiveAgentsSection + conditional
 * AgentGuidanceSettings render) is NOT reimplemented here: render/effect
 * tier, declared GAP in the manifest. Its module-eval displayName
 * (`WorkspaceAgentsSettingsPage`) IS golden-pinned and exported below as a
 * constant.
 */

import {
  agentGuidanceSettingsMetadata,
  type AgentGuidanceSettingsMetadata,
} from "./agent-guidance-metadata.ts";
import { TEAM_AGENTS_DOCS_URL, type ProjectedFragment } from "./team-agents-metadata.ts";

/** The corpus Component export's module-eval displayName (golden-pinned). */
export const WORKSPACE_AGENTS_DISPLAY_NAME = `WorkspaceAgentsSettingsPage`;

export interface WorkspaceAgentsPageMetadata {
  id: string;
  title: string;
  description: string;
  descriptionElement: ProjectedFragment;
  keywords: string;
  sections: {
    agentGuidance: AgentGuidanceSettingsMetadata;
  };
}

const DESCRIPTION = `AI agents can work alongside you as teammates. Tackle complex tasks together or delegate entire issues end-to-end.`;

/** Builds the metadata with the Docs-link seam injected (the golden's stub marker). */
export function workspaceAgentsPageMetadata(docsLinkSeam: string): WorkspaceAgentsPageMetadata {
  return {
    id: `agents`,
    title: `Agents`,
    description: DESCRIPTION,
    descriptionElement: {
      fragment: [
        DESCRIPTION,
        ` `,
        { element: docsLinkSeam, key: null, props: { href: TEAM_AGENTS_DOCS_URL, children: `Docs` } },
      ],
    },
    keywords: `ai delegate installed`,
    sections: {
      agentGuidance: agentGuidanceSettingsMetadata(`workspace`),
    },
  };
}
