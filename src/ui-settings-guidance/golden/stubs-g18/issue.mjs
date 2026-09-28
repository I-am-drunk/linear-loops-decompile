// Hand-written stub for Issue.DRYymPCa.js (G18 case; original code). Two
// consumers link against it here:
// - the ENTRY reads `mi` at MODULE EVAL as the Docs link href. The pinned
//   value is the raw-source literal, hand-verified in Issue.DRYymPCa.js
//   (`NJ = `https://linear.app/docs/agents-in-linear``, exported `NJ as mi`).
// - the REAL AgentGuidanceSettings chunk (executing unstubbed, the G11
//   cross-chunk chain) links Sv/da/dh/vv — read only inside its observer
//   component body; linking-only, throw-on-use (the G11 stub, verbatim).
export const mi = `https://linear.app/docs/agents-in-linear`;
const refuse = (name) => () => {
  throw new Error(`G18 stub: Issue.${name} used — this case pins only the pageMetadata export`);
};
export const Sv = refuse(`Sv`);
export const da = refuse(`da`);
export const dh = refuse(`dh`);
export const vv = refuse(`vv`);
