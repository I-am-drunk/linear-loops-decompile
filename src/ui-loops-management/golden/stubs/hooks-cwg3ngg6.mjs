// Hand-written linking-only stub for hooks.CWG3Ngg6.js (G23 case; original code).
// Read only inside the entry's component/hook bodies; every use throws loudly.
const refuse = (name) => new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G23 stub: hooks.CWG3Ngg6.${name}.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G23 stub: hooks.CWG3Ngg6.${name} called — component-body-only`); } });
export const i = refuse(`i`);
export const r = refuse(`r`);
