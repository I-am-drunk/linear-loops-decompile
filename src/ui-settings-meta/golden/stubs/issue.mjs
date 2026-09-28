// G11 stub for Issue.DRYymPCa.js (original code). The entry chunk imports
// {Sv, da, dh, vv}; every one is read only inside the component export `t`
// (permission enums, org URL helper), which is out of golden scope. Each
// binding is a fail-loud bomb: ANY property read or call throws, so corpus
// drift that makes the metadata factory touch Issue cannot silently pass.
const bomb = (name) =>
  new Proxy(function () {}, {
    get(_t, key) { throw new Error(`G11 stub: ${name}.${String(key)} read — the metadata factory must not touch Issue`); },
    apply() { throw new Error(`G11 stub: ${name} called — the metadata factory must not touch Issue`); },
  });
export const Sv = bomb(`Issue.Sv`);
export const da = bomb(`Issue.da`);
export const dh = bomb(`Issue.dh`);
export const vv = bomb(`Issue.vv`);
