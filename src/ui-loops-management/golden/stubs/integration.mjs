// Hand-written linking-only stub for Integration.B02xjlHD.js (G23 case; original code).
// Read only inside the entry's component/hook bodies (the declared-GAP
// page/component exports); every use throws loudly.
const l = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G23 stub: Integration.l.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G23 stub: Integration.l called — component-body-only`); } });
export { l };
