// G11 stub for lib.3x4I7cm8.js (original code; full name pinned in the case
// file — the `lib` prefix is ambiguous: 3x4I7cm8 vs DHnrUM56; the entry
// chunk's import literal names 3x4I7cm8). `n` (a Link component) is used only
// as a jsx element type inside the out-of-scope descriptionElement. Fail-loud.
const bomb = new Proxy(function () {}, {
  get(_t, key) { throw new Error(`G11 stub: lib.n.${String(key)} read — out of golden scope`); },
  apply() { throw new Error(`G11 stub: lib.n called — out of golden scope`); },
});
export const n = bomb;
