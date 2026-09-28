// Hand-written stub for Issue.DRYymPCa.js (G20 case; original code; the real
// 4.7MB chunk reads window at module scope — the G7 finding). Union of the
// three consumers' imports (entry + real CodingAgentModelSelect + real
// CommitSigningWorkspaceSetting):
// - ENTRY module eval reads `Ci` (the coding-sessions docs URL — pinned to
//   its raw-source literal `wJ = `https://linear.app/docs/coding-sessions``,
//   exported `wJ as Ci`, hand-verified) — everything else the entry imports
//   ($g/Lh/Ra/Sv/Vd/Zg/ha/r_/t_/xn) is component-body-only.
// - CodingAgentModelSelect: the G12-pinned value constants, carried over
//   verbatim from the merged issue-enums-stub (Qg/e_/Zg/n_ + refusing Sv/$g).
// - CommitSigningWorkspaceSetting: Sv, component-body-only.
// Every unpinned member read throws.
export const Ci = `https://linear.app/docs/coding-sessions`;
export const Qg = new Proxy(
  { claudeAuto: `anthropic/auto`, codexAuto: `openai/auto`, openSourceAuto: `open-source/auto` },
  { get(t, k) { if (k in t) return t[k]; throw new Error(`G20 stub: unpinned model-preference (Qg) read: ${String(k)}`); } },
);
export const e_ = { small: `small`, medium: `medium`, large: `large` };
export const Zg = { claude: `claude`, codex: `codex`, openSource: `open-source` };
export const n_ = `https://support.claude.com/en/articles/15425996-data-retention-practices-for-mythos-class-models`;
const refuse = (name) => new Proxy(function(){}, {
  get(_t, k) { throw new Error(`G20 stub: Issue.${name}.${String(k)} read — component-body-only`); },
  apply() { throw new Error(`G20 stub: Issue.${name} called — component-body-only`); },
});
export const $g = refuse(`$g`);
export const Lh = refuse(`Lh`);
export const Ra = refuse(`Ra`);
export const Sv = refuse(`Sv`);
export const Vd = refuse(`Vd`);
export const ha = refuse(`ha`);
export const r_ = refuse(`r_`);
export const t_ = refuse(`t_`);
export const xn = refuse(`xn`);
