/**
 * agentGuidanceSettingsMetadata — clean reimplementation of the corpus chunk
 * `AgentGuidanceSettings.BgeC_uVo.js` export `n` (matrix §F "Agent guidance"
 * row). Original code; every value below is verified against the committed
 * corpus-executed golden
 * (`golden/agent-guidance-settings.metadata.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * The corpus export (`export{p as n, m as t}`; `p` is the factory) is
 * `(scope) => metadata`: a strict ternary on `scope === "team"` — ANY other
 * value (not just "workspace") yields the workspace object, which the golden
 * pins via `nonTeamScopeFallsThroughToWorkspaceId`. Each object carries
 * id/title/description/keywords copy verbatim plus an `applicable` predicate
 * over `organization.agentAppUsers`:
 * `some(u => u.isActive && !!u.oauthClientId)` — the `!!` coercion makes
 * null/undefined/empty-string client ids non-qualifying, pinned by the
 * golden's six probe fixtures.
 *
 * Key ORDER is part of the golden bytes (id, title, description, keywords,
 * applicable), so the literals below preserve it. The chunk's other export
 * `t` (the mobx-wrapped settings page component) is out of this package's
 * scope — see corpus-manifest.json. Zero runtime deps, strip-only TS.
 */

export type AgentGuidanceScope = `team` | `workspace`;

export type AgentAppUser = {
  isActive: boolean;
  /** OAuth client id; null/undefined/empty string means no agent app. */
  oauthClientId?: string | null;
};

export type AgentGuidanceOrganization = { agentAppUsers: AgentAppUser[] };

export type AgentGuidanceSettingsMetadata = {
  id: string;
  title: string;
  description: string;
  keywords: string;
  applicable: (args: { organization: AgentGuidanceOrganization }) => boolean;
};

const applicable = ({ organization }: { organization: AgentGuidanceOrganization }): boolean =>
  organization.agentAppUsers.some((u) => u.isActive && !!u.oauthClientId);

/**
 * The factory. Matches the corpus ternary exactly: `scope === "team"` selects
 * the team metadata; every other value falls through to workspace metadata.
 * A fresh object is returned per call, as in the corpus (the source builds
 * the literal inside the arrow body).
 */
export function agentGuidanceSettingsMetadata(scope: AgentGuidanceScope | string): AgentGuidanceSettingsMetadata {
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
