// Hand-written stub for ThemeProvider.BNrg3wTr.js (G10 case; original code).
// `i` is the corpus useTheme hook (ThemeProvider export map: `B as i`; B throws
// outside a provider); `t` is the ThemeProvider component (export map `z as t`),
// stubbed to a string marker so the entry chunk's element tree stays host-tier
// (the ThemeProvider chunk is its own future ledger row).
//
// The pinned elevated-theme values are NOT invented: they identify the H2
// corpus-executed darkDefault ELEVATED derived theme
// (src/ui-theme/golden/golden-derived-retina0.json .darkDefault.derived.elevated,
// hand-verified byte-for-byte vs generateTheme executed FROM the corpus).
// The corpus component computes (useTheme().baseTheme ?? theme).elevatedTheme()
// and passes the RESULT to ThemeProvider — this case pins the `?? theme`
// branch (no baseTheme on the root: reading it yields the pinned undefined;
// any OTHER member read throws loudly).
const elevated = {
  themePin: `H2 golden-derived-retina0.json darkDefault.derived.elevated`,
  hash: `9cc5a10052803f8f8560263e4208bb1e7e59d237`,
  isDark: true,
  bgBase: `#19191b`,
};
const root = new Proxy({
  baseTheme: undefined,
  elevatedTheme: () => elevated,
}, {
  get(target, key) {
    if (key in target) return target[key];
    throw new Error(`G10 stub: unpinned theme member read: ${String(key)} — extend the stub from the H2 golden`);
  },
});
export const i = () => root;
export const t = `stub:ThemeProvider.t`;
