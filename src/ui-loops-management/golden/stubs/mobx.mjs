// Hand-written linking-only stub for mobx.BEIB-Y2s.js (G23 case; original code).
// Read only inside the entry's component/hook bodies (the declared-GAP
// page/component exports); every use throws loudly.
const E = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G23 stub: mobx.E.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G23 stub: mobx.E called — component-body-only`); } });
const _ = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G23 stub: mobx._.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G23 stub: mobx._ called — component-body-only`); } });
export { E, _ };
