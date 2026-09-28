// Hand-written stub for react.Bfm_Hgom.js (G25 case; original code). The
// entry interops the namespace at module eval (`var A = e(h())`); inert
// namespace, member reads throw (the G13/G18/G20/G22 precedent) — the
// pageMetadata export must never need React.
export const t = () => new Proxy({}, {
  get(_t, k) {
    if (k === `default` || k === `__esModule` || typeof k === `symbol`) return undefined;
    throw new Error(`G25 stub: react member read: ${String(k)} — the pageMetadata export must not need React`);
  },
});
