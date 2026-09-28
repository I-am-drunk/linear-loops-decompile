// Hand-written linking-only stub for mobx.BEIB-Y2s.js (G20 case; original code).
// Read only inside the entry's component bodies (declared-GAP exports);
// every use throws loudly.
export const E = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G20 stub: mobx.E.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G20 stub: mobx.E called — component-body-only`); } });
