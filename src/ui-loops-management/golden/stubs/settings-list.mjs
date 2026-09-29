// Hand-written stub for SettingsList.BezKBffa.js (G23 case; original code).
// The entry reads `G.GROUP_HEIGHT` / `G.ROW_HEIGHT` at MODULE EVAL
// (`Re=[G.GROUP_HEIGHT, G.ROW_HEIGHT, G.ROW_HEIGHT]`). The pinned values are
// the raw-source literals, hand-verified in SettingsList.BezKBffa.js
// (`be=32`, `ye=44`, `q={ROW_HEIGHT:ye, GROUP_HEIGHT:be, …}` exported
// `q as t`). Any OTHER member read throws; the row-component export `n`
// (De) is component-body-only and throws on any use.
export const t = new Proxy({ GROUP_HEIGHT: 32, ROW_HEIGHT: 44 }, {
  get(target, k) {
    if (Object.hasOwn(target, k)) return target[k];
    throw new Error(`G23 stub: SettingsList.t.${String(k)} read — extend the stub from the raw source`);
  },
});
export const n = new Proxy(function(){}, {
  get(_t, k) { if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G23 stub: SettingsList.n.${String(k)} read — component-body-only`); },
  apply() { throw new Error(`G23 stub: SettingsList.n called — component-body-only`); },
});
