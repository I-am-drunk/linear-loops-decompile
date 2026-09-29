/**
 * teamAgentSkillsPageMetadata — clean reimplementation of the corpus chunk
 * `TeamAgentSkillsSettingsPage.C2EeluTr.js` export `pageMetadata` (matrix §F
 * "Team agent settings" row). Original code; every value below is verified
 * against the committed corpus-executed golden
 * (`golden/team-agent-skills.metadata.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * The corpus export (`export{d as Component, l as pageMetadata}`; `l` is the
 * metadata) is a pure module-level literal — unlike the sibling
 * agent-guidance chunk's factory it takes NO scope parameter and carries NO
 * `applicable` member (the section is always applicable); both facts are
 * pinned by the golden's ownKeys-verbatim projection.
 *
 * The chunk's other export `Component` (the mobx + suspenseObserver-wrapped
 * route component reading
 * `useRouteData('/:orgKey/settings/teams/:teamKey/agent-skills')`) is out of
 * this golden's scope, but its module-eval `displayName` assignment
 * (`TeamAgentSkillsSettingsPage`) IS observable and golden-pinned, so the
 * constant below carries it too.
 *
 * Key ORDER is part of the golden bytes (id, title, description, keywords),
 * preserved below. Zero runtime deps, strip-only TS.
 */

export type TeamAgentSkillsPageMetadata = {
  id: string;
  title: string;
  description: string;
  keywords: string;
};

export const teamAgentSkillsPageMetadata: TeamAgentSkillsPageMetadata = {
  id: `team-agent-skills`,
  title: `Agent skills`,
  description: `Add reusable instructions team members can use with Linear Agent`,
  keywords: `agent skills shared prompt linear agent`,
};

/** The route component's module-eval displayName (corpus:
 * `d.displayName = \`TeamAgentSkillsSettingsPage\``). The component itself is
 * out of this package's scope — see corpus-manifest.json. */
export const teamAgentSkillsComponentDisplayName = `TeamAgentSkillsSettingsPage`;
