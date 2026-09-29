// Hand-written stub for Button.DD4dEZh7.js (G26 case; original code).
// Component/hook-body-only in this chunk; linking-only, every use throws.
const refuse = (member) => new Proxy(function(){}, {
  get(_t, k) { if (typeof k === `symbol`) return undefined; throw new Error(`G26 stub: Button.DD4dEZh7.js ${member}.${String(k)} read — this case pins only pageMetadata`); },
  apply() { throw new Error(`G26 stub: Button.DD4dEZh7.js ${member} called — this case pins only pageMetadata`); },
});
export const t = refuse(`t`);
