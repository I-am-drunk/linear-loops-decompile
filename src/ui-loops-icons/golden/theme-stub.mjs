// Hand-written stub for ThemeProvider.BNrg3wTr.js (G4 case; original code).
// `i` is the corpus useTheme hook (ThemeProvider export map: `B as i`; B throws
// outside a provider). The returned color values are NOT invented: they are the
// H2 corpus-executed darkDefault golden (src/ui-theme/golden/
// golden-derived-retina0.json, hand-verified byte-for-byte vs generateTheme
// executed FROM the corpus, PR #215/#223 lineage). Only the three tokens this
// component reads are pinned; reading any other token throws loudly.
const color = new Proxy({
  labelBase: `#e2e3e5`,
  labelFaint: `#565658`,
  labelMuted: `#949597`,
}, {
  get(target, key) {
    if (key in target) return target[key];
    throw new Error(`G4 stub: unpinned theme token read: ${String(key)} — extend the stub from the H2 golden`);
  },
});
export const i = () => ({ color });
