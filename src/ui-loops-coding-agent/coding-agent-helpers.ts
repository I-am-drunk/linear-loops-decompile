/**
 * CodingAgentHelpers — clean reimplementation of the corpus chunk
 * `CodingAgentModelSelect.USYHzowP.js` exports `r` (repo helper, chunk-local
 * `g`) and `n` (settings helper, chunk-local `y`) — matrix §E "Coding
 * harness" row. Original code; every value below is verified byte-for-byte
 * against the committed corpus-executed golden
 * (`golden/coding-agent-model-select.statics.expected.json`) through the
 * tagged-v2 serializer as the declared observation driver — see
 * `corpus-manifest.json` and the golden test.
 *
 * Scope matches the golden exactly: the pure statics. NOT reimplemented here
 * (unpinned regions, staying honest on the ledger): `isAvailable` (the
 * integration-graph predicate), `modelDescription`'s non-ZDR branch (rendered
 * prose + CodingAgentPreferencesHelper), `icon()`'s element output (the
 * golden pins the harness→icon-identity MAPPING; the icon components
 * themselves are separate chunks), and the observer Select component
 * (render-tier).
 */

/** Corpus harness enum (Issue chunk `jO`, verified verbatim). */
export const codingAgentHarness = {
  claude: `claude`,
  codex: `codex`,
  openSource: `open-source`,
} as const;
export type CodingAgentHarness = (typeof codingAgentHarness)[keyof typeof codingAgentHarness];

/** Corpus sandbox-size enum (Issue chunk `DO`, verified verbatim). */
export const sandboxSize = {
  small: `small`,
  medium: `medium`,
  large: `large`,
} as const;
export type SandboxSize = (typeof sandboxSize)[keyof typeof sandboxSize];

/** The three `*Auto` model-preference ids the helper maps to (Issue chunk `H`). */
export const autoModelPreference = {
  claude: `anthropic/auto`,
  codex: `openai/auto`,
  openSource: `open-source/auto`,
} as const;

export interface CodingAgentRepo {
  owner: string;
  name: string;
  baseUrl: string;
}

/** Corpus chunk-local class `g` (export `r`): the repo display helper. */
export const CodingAgentRepoHelper = {
  /** URL host, lowercased (corpus: `new URL(e.baseUrl).hostname.toLowerCase()`). */
  hostName(repo: Pick<CodingAgentRepo, `baseUrl`>): string {
    return new URL(repo.baseUrl).hostname.toLowerCase();
  },
  /** `owner/name` (corpus template literal, verbatim). */
  fullName(repo: Pick<CodingAgentRepo, `owner` | `name`>): string {
    return `${repo.owner}/${repo.name}`;
  },
  /** github.com hides the host; any other host appends ` (host)` — the
   * corpus branch `r === \`github.com\` ? n : \`${n} (${r})\``. */
  label(repo: CodingAgentRepo): string {
    const full = CodingAgentRepoHelper.fullName(repo);
    const host = CodingAgentRepoHelper.hostName(repo);
    return host === `github.com` ? full : `${full} (${host})`;
  },
};

export interface SandboxSizeOption {
  value: SandboxSize;
  label: string;
  description: string;
}

/** Corpus chunk-local class `y` (export `n`): the settings copy + mappings. */
export const CodingAgentSettingsHelper = {
  /** Order is the corpus array `[r.claude, r.codex, r.openSource]`. */
  harnesses: [
    codingAgentHarness.claude,
    codingAgentHarness.codex,
    codingAgentHarness.openSource,
  ] as CodingAgentHarness[],

  /** Corpus `Object.values(v)` over the size-option map — order and copy verbatim. */
  sandboxSizes: [
    { value: sandboxSize.small, label: `Small`, description: `1 vCPU · 8 GB memory` },
    { value: sandboxSize.medium, label: `Medium`, description: `2 vCPU · 16 GB memory` },
    { value: sandboxSize.large, label: `Large`, description: `4 vCPU · 32 GB memory` },
  ] as SandboxSizeOption[],

  /** The nine settings-surface description strings, verbatim corpus copy. */
  descriptions: {
    agent: `Choose which agent Linear uses in coding sessions`,
    model: `May affect quality and cost of code changes`,
    repository: `Choose which repository coding sessions use in this environment`,
    environmentVariables: `Set environment variables for coding sessions. Names and values are visible to the agent`,
    secretEnvironmentVariables: `Secret values are encrypted before saving. Saved secret rows are masked and can’t be changed.`,
    files: `Add files to the environment’s home directory`,
    customGuidance: `Add instructions for the agent to follow in this environment`,
    prepareScript: `Runs while Linear prepares the environment`,
    toolVersions: `Add the tools that Linear should install in this environment`,
  },

  /** Per-harness display label; an unknown value passes through (corpus default). */
  label(harness: string): string {
    switch (harness) {
      case codingAgentHarness.claude:
        return `Claude Code`;
      case codingAgentHarness.codex:
        return `Codex`;
      case codingAgentHarness.openSource:
        return `Open source`;
      default:
        return harness;
    }
  },

  /** Per-harness auto model preference; unknown throws the corpus message. */
  autoPreference(harness: string): string {
    switch (harness) {
      case codingAgentHarness.claude:
        return autoModelPreference.claude;
      case codingAgentHarness.codex:
        return autoModelPreference.codex;
      case codingAgentHarness.openSource:
        return autoModelPreference.openSource;
      default:
        throw new Error(`Unhandled coding agent harness: ${String(harness)}`);
    }
  },

  /** The harness→icon mapping as pinned by the golden: which icon identity
   * each harness resolves to (claude → the ClaudeIcon import, codex → the
   * CodexIcon import, open-source → null, unknown → passthrough). The icon
   * COMPONENTS are separate chunks and out of this module's scope, so the
   * mapping is expressed over caller-supplied icon values. */
  iconFor<T>(harness: string, icons: { claude: T; codex: T }): T | null | string {
    switch (harness) {
      case codingAgentHarness.claude:
        return icons.claude;
      case codingAgentHarness.codex:
        return icons.codex;
      case codingAgentHarness.openSource:
        return null;
      default:
        return harness;
    }
  },

  /** The default (ZDR-safe) model description — the corpus branch taken when
   * no preference is set. The non-ZDR branch is out of scope (unpinned). */
  modelDescriptionDefault(): string {
    return CodingAgentSettingsHelper.descriptions.model;
  },
};
