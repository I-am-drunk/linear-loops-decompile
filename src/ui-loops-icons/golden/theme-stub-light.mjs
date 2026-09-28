// Hand-written stub for ThemeProvider.BNrg3wTr.js (G4 light case; original
// code, sibling of theme-stub.mjs). `i` is the corpus useTheme hook
// (ThemeProvider export map: `B as i`). Values are the H2 corpus-executed
// lightDefault golden (src/ui-theme/golden/golden-derived-retina0.json
// .lightDefault.color — hand-verified byte-for-byte vs generateTheme executed
// FROM the corpus, PR #215/#223 lineage). Only the three tokens this component
// reads are pinned; reading any other token throws loudly.
const color = new Proxy({
  labelBase: `#2f2f31`,
  labelFaint: `#9c9c9e`,
  labelMuted: `#5b5c5e`,
}, {
  get(target, key) {
    if (key in target) return target[key];
    throw new Error(`G4 stub: unpinned theme token read: ${String(key)} — extend the stub from the H2 golden`);
  },
});
export const i = () => ({ color });
