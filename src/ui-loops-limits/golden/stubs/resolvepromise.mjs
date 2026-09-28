// Hand-written linking-only stub for resolvePromise.B8FauNXm.js (G22 case; original code).
// Read only inside the entry's component/hook bodies (the declared-GAP
// Component export); every use throws loudly.
const a = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G22 stub: resolvePromise.a.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G22 stub: resolvePromise.a called — component-body-only`); } });
export { a };
