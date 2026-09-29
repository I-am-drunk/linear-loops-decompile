// Declared stub for Issue.DRYymPCa.js (G12; original code). The real chunk's
// module-level environment needs (self.FormData via types.7f0h45Sh.js) are
// browser-only, so the model-layer chunk cannot execute under the stock G1
// runner; the entry consumes only six of its exports, five of which are pure
// module-level VALUE constants. Each pin below is hand-verified against the
// raw corpus source (Issue.DRYymPCa.js — the pretty projection cites the same
// literals at `H = {...}`, `DO = {...}`, `jO = {...}`, `MO = ...`):
//
//   Qg -> H     model-preference ids: only the three `*Auto` members the entry
//               reads (autoPreference). Any OTHER member read throws.
//   e_ -> DO    sandbox-size enum {small,medium,large} (verbatim, complete).
//   Zg -> jO    coding-harness enum {claude,codex,open-source} (verbatim, complete).
//   n_ -> MO    the Anthropic data-retention docs URL (verbatim).
//   Sv -> iw    workspace-permission enum: read only inside the (not driven)
//               observer component, so it throws on any read.
//   $g -> FO    the CodingAgentPreferencesHelper class: the driven surface
//               never reaches it (modelDescription's default branch
//               short-circuits on `preference !== undefined` BEFORE touching
//               it), so it throws on any read — corpus drift that adds a read
//               fails loudly instead of silently reusing a fake.
const refuse = (name) =>
  new Proxy({}, { get(_, k) { throw new Error(`unpinned ${name} read: ${String(k)}`); } });

export const Qg = new Proxy(
  { claudeAuto: `anthropic/auto`, codexAuto: `openai/auto`, openSourceAuto: `open-source/auto` },
  { get(t, k) { if (k in t) return t[k]; throw new Error(`unpinned model-preference (H) read: ${String(k)}`); } },
);
export const e_ = { small: `small`, medium: `medium`, large: `large` };
export const Zg = { claude: `claude`, codex: `codex`, openSource: `open-source` };
export const n_ = `https://support.claude.com/en/articles/15425996-data-retention-practices-for-mythos-class-models`;
export const Sv = refuse(`workspace-permission enum (iw)`);
export const $g = refuse(`CodingAgentPreferencesHelper ($g/FO)`);
