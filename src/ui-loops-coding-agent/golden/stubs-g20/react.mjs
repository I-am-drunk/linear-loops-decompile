// Hand-written stub for react.Bfm_Hgom.js (G20 case; original code). The
// entry (and the real CodingAgentModelSelect / CommitSigningWorkspaceSetting)
// interop the react namespace at MODULE EVAL (`J = interop(S())`); inert
// namespace, member reads throw (the G13/G18 precedent) — the metadata export
// must never need React.
export const t = () => new Proxy({}, {
  get(_t, k) {
    if (k === `default` || k === `__esModule` || typeof k === `symbol`) return undefined;
    throw new Error(`G20 stub: react member read: ${String(k)} — the metadata export must not need React`);
  },
});
