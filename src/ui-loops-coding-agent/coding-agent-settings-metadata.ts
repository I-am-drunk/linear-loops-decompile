/**
 * codingAgentSettingsMetadata — clean reimplementation of export `r` of the
 * corpus chunk `CodingAgentSettingsPage.lcMyXnM7.js` (matrix §F "Coding agent
 * settings" row; the coding-sessions settings-registry metadata). Original
 * code; every value below is verified against the committed corpus-executed
 * golden (`golden/coding-agent-settings-metadata.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * The corpus metadata is a MODULE-EVAL literal (hand-verified in the raw
 * chunk) that COMPOSES three chunks:
 *   - its own literals (ids/titles/descriptions/keywords below, verbatim);
 *   - the CodingAgentModelSelect statics (`K.descriptions.agent` /
 *     `K.descriptions.model`) — this module reads OUR golden-backed
 *     `CodingAgentSettingsHelper.descriptions`, mirroring the corpus's
 *     cross-chunk read;
 *   - the CommitSigningWorkspaceSetting metadata export — reproduced verbatim
 *     (its source literal is a 4-key object, hand-verified in that chunk).
 * The descriptionElement fragment carries the description text + a space
 * inside the SAME string (the corpus template ends with a trailing space)
 * followed by the Docs link (href = the raw Issue literal `wJ as Ci`).
 *
 * The three `applicable` closures are reproduced exactly:
 *   - regionPinning: () => featureFlags.isEnabled(featureFlags.codeSandboxSizing)
 *     (the registry is a seam — the corpus reads the types.7f0h45Sh registry);
 *   - loopsRepositoryAccess: canAccess(agentAutomations) && canAccess(codingSessions)
 *     — NOTE the corpus asks agentAutomations FIRST (the golden's askedKeysOnBoth
 *     pins the order);
 *   - environments: canAccess(codingSessions).
 *
 * Own-key order is part of the golden bytes and preserved throughout. The
 * chunk's other exports (`n`/`t`, suspense-observer page components) stay
 * declared GAP (T2/T3).
 */

import { CodingAgentSettingsHelper } from "./coding-agent-helpers.ts";

export const CODING_SESSIONS_DOCS_URL = `https://linear.app/docs/coding-sessions`;

export interface FeatureFlagRegistry {
  codeSandboxSizing: string;
  isEnabled(flag: string): boolean;
}

export interface FeatureAccessOrganization {
  canAccess(feature: string): boolean;
}

export interface SettingsItemMetadata {
  id: string;
  title: string;
  description: string;
  keywords: string;
  applicable?: (ctx: { organization: FeatureAccessOrganization }) => boolean;
}

export interface ProjectedDocsLink {
  element: string;
  key: null;
  props: { href: string; children: string };
}

export interface CodingAgentSettingsMetadata {
  id: string;
  title: string;
  description: string;
  descriptionElement: { fragment: [string, ProjectedDocsLink] };
  keywords: string;
  sections: {
    general: {
      id: string;
      items: {
        enableCodingSessions: SettingsItemMetadata;
        harness: SettingsItemMetadata;
        model: SettingsItemMetadata;
        commitSigning: SettingsItemMetadata;
        regionPinning: SettingsItemMetadata & { applicable: () => boolean };
        loopsRepositoryAccess: SettingsItemMetadata & {
          applicable: (ctx: { organization: FeatureAccessOrganization }) => boolean;
        };
      };
    };
    environments: SettingsItemMetadata & {
      applicable: (ctx: { organization: FeatureAccessOrganization }) => boolean;
    };
  };
}

/** Builds the metadata with the seams injected (the golden's stub markers). */
export function codingAgentSettingsMetadata(
  docsLinkSeam: string,
  featureFlags: FeatureFlagRegistry,
): CodingAgentSettingsMetadata {
  return {
    id: `coding-sessions`,
    title: `Coding sessions`,
    description: `Let Linear Agent write code and open pull requests.`,
    descriptionElement: {
      fragment: [
        `Let Linear Agent write code and open pull requests. `,
        { element: docsLinkSeam, key: null, props: { href: CODING_SESSIONS_DOCS_URL, children: `Docs` } },
      ],
    },
    keywords: `coding sessions agent pull requests implementation model claude codex`,
    sections: {
      general: {
        id: `coding-sessions-settings`,
        items: {
          enableCodingSessions: {
            id: `coding-sessions`,
            title: `Enable coding sessions`,
            description: `Allow Linear Agent to write code and create pull requests when assigned or asked to implement an issue`,
            keywords: `pull requests implementation coding sessions`,
          },
          harness: {
            id: `coding-agent-agent`,
            title: `Agent`,
            description: CodingAgentSettingsHelper.descriptions.agent,
            keywords: `claude codex coding sessions harness`,
          },
          model: {
            id: `coding-agent-model`,
            title: `Model`,
            description: CodingAgentSettingsHelper.descriptions.model,
            keywords: `model claude codex anthropic openai`,
          },
          commitSigning: {
            id: `coding-agent-commit-signing`,
            title: `Require signed commits`,
            description: `Users must upload a signing key before starting a coding session`,
            keywords: `commit signing signed commits ssh`,
          },
          regionPinning: {
            id: `coding-agent-region-pinning`,
            title: `Pin sandbox region`,
            description: `Pin new coding session sandboxes to the US. Region pinning raises the sandbox compute price.`,
            keywords: `coding sessions sandbox region pinning data residency compute`,
            applicable: () => featureFlags.isEnabled(featureFlags.codeSandboxSizing),
          },
          loopsRepositoryAccess: {
            id: `coding-sessions-loops-repository-access`,
            title: `Repository access for Loops`,
            description: `Choose which repos Loops can use for coding sessions`,
            keywords: `loops automations repository access repositories github`,
            applicable: ({ organization }) =>
              organization.canAccess(`agentAutomations`) && organization.canAccess(`codingSessions`),
          },
        },
      },
      environments: {
        id: `coding-environments`,
        title: `Environments`,
        description: `Create reusable environments for coding sessions.`,
        keywords: `coding sessions environments repositories agent model compute`,
        applicable: ({ organization }) => organization.canAccess(`codingSessions`),
      },
    },
  };
}
