// Hand-written linking-only stub for types.7f0h45Sh.js (G22 case; original code).
// Read only inside the entry's component/hook bodies (the declared-GAP
// Component export); every use throws loudly.
const o = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G22 stub: types.o.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G22 stub: types.o called — component-body-only`); } });
export { o };
