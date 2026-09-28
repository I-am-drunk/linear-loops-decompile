// Hand-written stub for react.Bfm_Hgom.js (G23 case; original code).
// Module-eval namespace interop; inert namespace, member reads throw
// (the G13/G18/G20/G22 precedent).
export const t = () => new Proxy({}, {
  get(_t, k) {
    if (k === `default` || k === `__esModule` || typeof k === `symbol`) return undefined;
    throw new Error(`G23 stub: react member read: ${String(k)} — the pageMetadata export must not need React`);
  },
});
