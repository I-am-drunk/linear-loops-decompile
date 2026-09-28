// Hand-written stub for Issue.DRYymPCa.js (G11 case; original code). The
// metadata-factory case never renders the observer component, so the four
// imports (Sv/da/dh/vv — permission enums and routing helpers read only
// inside the component body) must merely EXIST for ESM linking. Any actual
// use throws loudly: this case pins ONLY export `n`.
const refuse = (name) => () => {
  throw new Error(`G11 stub: Issue.${name} used — this case pins only the metadata factory (export n)`);
};
export const Sv = refuse(`Sv`);
export const da = refuse(`da`);
export const dh = refuse(`dh`);
export const vv = refuse(`vv`);
