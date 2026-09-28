/**
 * agentGuidanceSettingsMetadata — clean reimplementation of export `n` of the
 * corpus chunk `AgentGuidanceSettings.BgeC_uVo.js` (matrix §F "Agent
 * guidance" row). Original code; every value below is verified against the
 * committed corpus-executed golden
 * (`golden/agent-guidance-metadata.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * The corpus factory (`export{p as n}`) takes a scope discriminator and
 * returns the settings-registry metadata object for the agent-guidance
 * section:
 *   - `scope === "team"` (STRICT equality; any other value, including
 *     "Team" or undefined, takes the workspace branch — pinned in the
 *     golden) → id `team-agent-guidance`, title `Additional guidance`,
 *     the team description copy, keywords
 *     `team guidance instructions rules prompt`;
 *   - otherwise → id `workspace-agent-guidance`, title
 *     `Workspace guidance`, the workspace description copy, keywords
 *     `guidance instructions rules prompt`.
 * Both branches carry the SAME applicability predicate: the section shows
 * iff the organization has at least one agent app user that is active AND
 * carries an oauthClientId (`agentAppUsers.some(u => u.isActive &&
 * !!u.oauthClientId)`).
 *
 * Own-key ORDER is part of the golden bytes (id, title, description,
 * keywords, applicable), so the literals below preserve it. Zero runtime
 * deps, strip-only TS.
 *
 * The chunk's other export (`t`, the mobx-observer settings component) is
 * NOT reimplemented here: it needs the T3 store-fixture tier and stays on
 * the coverage ledger as a gap for this chunk's component half.
 */

export type AgentGuidanceScope = `team` | `workspace`;

export type AgentAppUser = {
  isActive: boolean;
  oauthClientId: string | null;
};

export type OrganizationWithAgentAppUsers = {
  agentAppUsers: AgentAppUser[];
};

export type AgentGuidanceSettingsMetadata = {
  id: string;
  title: string;
  description: string;
  keywords: string;
  applicable: (ctx: { organization: OrganizationWithAgentAppUsers }) => boolean;
};

const applicable = ({ organization }: { organization: OrganizationWithAgentAppUsers }): boolean =>
  organization.agentAppUsers.some((u) => u.isActive && !!u.oauthClientId);

export function agentGuidanceSettingsMetadata(scope: AgentGuidanceScope | (string & {}) | undefined): AgentGuidanceSettingsMetadata {
  return scope === `team`
    ? {
        id: `team-agent-guidance`,
        title: `Additional guidance`,
        description: `When working on an issue, an agent automatically receives the full issue context and any added workspace guidance. You can also provide team-level guidance, though adherence is controlled by the agent integration.`,
        keywords: `team guidance instructions rules prompt`,
        applicable,
      }
    : {
        id: `workspace-agent-guidance`,
        title: `Workspace guidance`,
        description: `An agent automatically receives the full issue context when working on an issue. You can provide additional workspace-wide guidance, though adherence is controlled by the agent integration.`,
        keywords: `guidance instructions rules prompt`,
        applicable,
      };
}
