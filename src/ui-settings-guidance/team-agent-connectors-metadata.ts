/**
 * teamAgentConnectorsPageMetadata — clean reimplementation of the corpus
 * chunk `TeamAgentConnectorsSettingsPage.DcAOUyLv.js` export `pageMetadata`
 * (matrix §F "Team agent settings" row, third chunk). Original code; every
 * value below is verified against the committed corpus-executed golden
 * (`golden/team-agent-connectors.metadata.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * Like the sibling team-agent-skills chunk (G14), the corpus export
 * (`export{d as Component, l as pageMetadata}`; `l` is the metadata) is a
 * pure module-level literal with NO scope parameter and NO `applicable`
 * member — both facts pinned by the golden's ownKeys-verbatim projection.
 *
 * The chunk's other export `Component` (the mobx-wrapped route component
 * reading `useRouteData('/:orgKey/settings/teams/:teamKey/agent-connectors')`
 * and rendering McpConnectorList with service Integration.mcpServer) is out
 * of this golden's scope; its module-eval `displayName` assignment IS
 * observable and golden-pinned, carried by the constant below.
 *
 * Key ORDER is part of the golden bytes (id, title, description, keywords),
 * preserved below. Zero runtime deps, strip-only TS.
 */

import type { TeamAgentSkillsPageMetadata } from "./team-agent-skills-metadata.ts";

export type TeamAgentConnectorsPageMetadata = TeamAgentSkillsPageMetadata;

export const teamAgentConnectorsPageMetadata: TeamAgentConnectorsPageMetadata = {
  id: `team-agent-connectors`,
  title: `Agent connectors`,
  description: `Add MCP connectors that team members can use with Linear Agent`,
  keywords: `agent connectors mcp model context protocol shared linear agent`,
};

/** The route component's module-eval displayName (corpus:
 * `d.displayName = \`TeamAgentConnectorsSettingsPage\``). The component itself
 * is out of this package's scope — see corpus-manifest.json. */
export const teamAgentConnectorsComponentDisplayName = `TeamAgentConnectorsSettingsPage`;
