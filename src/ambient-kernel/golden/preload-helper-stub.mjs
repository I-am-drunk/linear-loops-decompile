// Stub for preload-helper.HclGiUj8.js — the boot chunk's LAST statement is
// `c(() => import(`./entry.BGeHYrTB.js`), __vite__mapDeps([0..95]), …)`: the
// preload of the whole application (96 asset URLs resolved through
// window.__toStaticUrl against the baked prod ASSET_URL, then a dynamic
// import of the 35.9 KB entry chunk — the full app closure). That tail is
// OUTSIDE this unit's ground: the installer `b()` and the config injection
// `o(s)` have already run by then (same statement list, earlier positions —
// pretty L168). The stub's no-op preserves the export contract (`t`, the
// preload function) and skips the app boot; nothing the driver sweeps is
// defined after the `c(…)` call.
export const t = () => Promise.resolve();
