// Hand-written stub for hooks.D4LfSm6u.js (G26 case; original code).
// Component/hook-body-only in this chunk; linking-only, every use throws.
const refuse = (member) => new Proxy(function(){}, {
  get(_t, k) { if (typeof k === `symbol`) return undefined; throw new Error(`G26 stub: hooks.D4LfSm6u.js ${member}.${String(k)} read — this case pins only pageMetadata`); },
  apply() { throw new Error(`G26 stub: hooks.D4LfSm6u.js ${member} called — this case pins only pageMetadata`); },
});
export const f = refuse(`f`);
