// Hand-written linking-only stub for Link.B583WaeA.js (G23 case; original code).
// Read only inside the entry's component/hook bodies (the declared-GAP
// page/component exports); every use throws loudly.
const i = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G23 stub: Link.i.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G23 stub: Link.i called — component-body-only`); } });
export { i };
