// G11 stub for ContextualMenuActions.Dlg9Oa2U.js (original code; full name
// pinned in the case file — the prefix is ambiguous in this corpus:
// Bcp3eWHc vs Dlg9Oa2U hash-rotated duplicates; the entry chunk's import
// literal names Dlg9Oa2U). Imports {$P, hs, ms} are read only inside the
// out-of-scope component export. Fail-loud bombs.
const bomb = (name) =>
  new Proxy(function () {}, {
    get(_t, key) { throw new Error(`G11 stub: ${name}.${String(key)} read — out of golden scope`); },
    apply() { throw new Error(`G11 stub: ${name} called — out of golden scope`); },
  });
export const $P = bomb(`ContextualMenuActions.$P`);
export const hs = bomb(`ContextualMenuActions.hs`);
export const ms = bomb(`ContextualMenuActions.ms`);
