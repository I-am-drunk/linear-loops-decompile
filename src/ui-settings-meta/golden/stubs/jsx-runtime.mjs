// G11 stub for jsx-runtime.BH9nBM82.js (original code). The entry chunk runs
// `var f = s()` at MODULE level, so `t` must be callable during import; the
// returned runtime object (f.jsx/f.jsxs) is only used inside the out-of-scope
// component bodies, so it is a fail-loud bomb.
export const t = () =>
  new Proxy({}, {
    get(_t, key) { throw new Error(`G11 stub: jsx-runtime.${String(key)} read — the metadata factory must not build elements`); },
  });
