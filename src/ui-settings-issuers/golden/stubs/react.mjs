// Hand-written stub for react.Bfm_Hgom.js (G26 case; original code).
// Module-eval namespace interop (`var E = e(u())` — rolldown interop of the
// react namespace); inert namespace, member reads throw (the
// G13/G18/G20/G22/G23 precedent).
export const t = () => new Proxy({}, {
  get(_t, k) {
    if (k === `default` || k === `__esModule` || typeof k === `symbol`) return undefined;
    throw new Error(`G26 stub: react member read: ${String(k)} — the pageMetadata export must not need React`);
  },
});
