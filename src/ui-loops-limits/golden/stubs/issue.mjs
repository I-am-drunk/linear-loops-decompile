// Hand-written linking-only stub for Issue.DRYymPCa.js (G22 case; original code).
// Read only inside the entry's component/hook bodies (the declared-GAP
// Component export); every use throws loudly.
const HS = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G22 stub: Issue.HS.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G22 stub: Issue.HS called — component-body-only`); } });
const hs = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G22 stub: Issue.hs.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G22 stub: Issue.hs called — component-body-only`); } });
const ol = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G22 stub: Issue.ol.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G22 stub: Issue.ol called — component-body-only`); } });
export { HS, hs, ol };
