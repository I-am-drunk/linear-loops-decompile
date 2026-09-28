// Hand-written linking-only stub for Text.gv7OudGa.js (G25 case; original code).
// Read only inside the entry's component body (the declared-GAP Component
// export); every use throws loudly.
const t = new Proxy(function(){}, { get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G25 stub: Text.t.${String(k)} read — component-body-only`); }, apply(){ throw new Error(`G25 stub: Text.t called — component-body-only`); }, construct(){ throw new Error(`G25 stub: Text.t constructed — component-body-only`); } });
export { t };
