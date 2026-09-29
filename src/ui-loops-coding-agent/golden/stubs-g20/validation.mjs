// Hand-written linking-only stub for validation.DM_YZW7p.js (G20 case;
// original code). Read only inside the entry's component bodies
// (declared-GAP exports); every use throws loudly. The chunk exports the
// RESERVED WORD `in` (aliased at the import site as `oe`), so the export
// uses the alias-export form.
const refuse = (name) => new Proxy(function(){}, {
  get(_t, k){ if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`G20 stub: validation.${name}.${String(k)} read — component-body-only`); },
  apply(){ throw new Error(`G20 stub: validation.${name} called — component-body-only`); },
});
const _in = refuse(`in`);
const sn = refuse(`sn`);
export { _in as in, sn };
