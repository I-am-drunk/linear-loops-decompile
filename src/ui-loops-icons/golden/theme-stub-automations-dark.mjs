// Hand-written stub for ThemeProvider.BNrg3wTr.js (AutomationsEmptyStateIcon
// cases; original code, sibling of theme-stub.mjs). `i` is the corpus useTheme
// hook (ThemeProvider export map: `B as i`). Values are the H2 corpus-executed
// darkDefault golden (src/ui-theme/golden/golden-derived-retina0.json
// .darkDefault.color — hand-verified byte-for-byte vs generateTheme executed
// FROM the corpus, PR #215/#223 lineage). This icon reads FOUR tokens: the
// three labels always, and bgBorderSolidThin only on the animated branch
// (third gradient's bandColor). Reading any other token throws loudly.
const color = new Proxy({
  bgBorderSolidThin: `#27282a`,
  labelBase: `#e2e3e5`,
  labelFaint: `#565658`,
  labelMuted: `#949597`,
}, {
  get(target, key) {
    if (key in target) return target[key];
    throw new Error(`golden stub: unpinned theme token read: ${String(key)} — extend the stub from the H2 golden`);
  },
});
export const i = () => ({ color });
