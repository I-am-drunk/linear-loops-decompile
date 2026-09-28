// Hand-written stub for useStore.BpZDR8VN.js (G26 case; original code).
// Component/hook-body-only in this chunk; linking-only, every use throws.
const refuse = (member) => new Proxy(function(){}, {
  get(_t, k) { if (typeof k === `symbol`) return undefined; throw new Error(`G26 stub: useStore.BpZDR8VN.js ${member}.${String(k)} read — this case pins only pageMetadata`); },
  apply() { throw new Error(`G26 stub: useStore.BpZDR8VN.js ${member} called — this case pins only pageMetadata`); },
});
export const t = refuse(`t`);
