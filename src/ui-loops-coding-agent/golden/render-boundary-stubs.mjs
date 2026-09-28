// Declared stub for ContextualMenuActions.Dlg9Oa2U.js (G12; original code).
// The entry imports four RENDER-ONLY components from this 1.7 MB barrel:
//   OP -> a workspace-permission Select wrapper (used by the observer
//         component, which this golden does not drive),
//   uP -> the external-link anchor (used inside nonZdrModelDescription,
//         declared out of this golden's scope),
//   vI/yI -> the Claude / Codex icon components (referenced as element TYPES
//         by Helper.icon; never invoked during the drive).
// Each stub is a named function that THROWS if actually rendered; the driver
// projects icon elements to their stub identity, which pins the real fact
// (which import each harness maps to) without executing fake render code.
const stub = (name) => {
  const f = () => { throw new Error(`stubbed render-only component called: ${name}`); };
  f.displayName = name;
  return f;
};
export const OP = stub(`stub:WorkspacePermissionSelect(OP)`);
export const uP = stub(`stub:ExternalLink(uP)`);
export const vI = stub(`stub:ClaudeIcon(vI)`);
export const yI = stub(`stub:CodexIcon(yI)`);
