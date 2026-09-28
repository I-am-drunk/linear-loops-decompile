// Hand-written stub for react.Bfm_Hgom.js (G18 case; original code). The
// entry calls `o()` bare at MODULE EVAL (a side-effect-positioned namespace
// call, same shape the merged G13 case pinned) — the factory must return an
// inert namespace; any member READ throws (no hook belongs in this case's
// scope: the component exports are declared GAP).
export const t = () => new Proxy({}, {
  get(_t, k) {
    if (k === `default` || k === `__esModule` || typeof k === `symbol`) return undefined;
    throw new Error(`G18 stub: react member read: ${String(k)} — the pageMetadata export must not need React`);
  },
});
