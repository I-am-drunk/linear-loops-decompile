// Hand-written stub for ThemeProvider.BNrg3wTr.js — lightDefault case sibling
// of theme-stub.mjs (same provenance discipline; see that file). This case
// pins the OTHER branch of the corpus's `useTheme().baseTheme ?? theme`:
// the root theme carries a baseTheme, and elevatedTheme() lives ONLY on the
// baseTheme — a component that wrongly derived from the root would throw.
// Pinned values identify the H2 lightDefault ELEVATED derived theme
// (src/ui-theme/golden/golden-derived-retina0.json .lightDefault.derived.elevated).
const elevated = {
  themePin: `H2 golden-derived-retina0.json lightDefault.derived.elevated`,
  hash: `f5f7dd376d410d6c1212def26b3905d01a6cfabb`,
  isDark: false,
  bgBase: `#ffffff`,
};
const guard = (name) => ({
  get(target, key) {
    if (key in target) return target[key];
    throw new Error(`G10 stub: unpinned ${name} member read: ${String(key)} — extend the stub from the H2 golden`);
  },
});
const base = new Proxy({ elevatedTheme: () => elevated }, guard(`baseTheme`));
const root = new Proxy({ baseTheme: base }, guard(`theme`));
export const i = () => root;
export const t = `stub:ThemeProvider.t`;
