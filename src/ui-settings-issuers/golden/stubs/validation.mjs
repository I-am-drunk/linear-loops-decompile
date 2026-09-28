// Hand-written linking-only stub for validation.DM_YZW7p.js (G25 case; original code).
// Read only inside the entry's component body (the declared-GAP Component
// export); every use throws loudly.
const Ut = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G25 stub: validation.Ut.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G25 stub: validation.Ut called — component-body-only`); }, construct(){ throw new Error(`G25 stub: validation.Ut constructed — component-body-only`); } });
export { Ut };
