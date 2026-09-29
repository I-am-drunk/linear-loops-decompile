// Hand-written linking-only stub for ContextualMenuActions.Dlg9Oa2U.js
// (shared by the G25 + G26 cases; original code). Read only inside the
// entries' component bodies (the declared-GAP Component exports); every use
// throws loudly. Member union of both entries' import maps:
// G25 (AgentIssuersSettingsPage): $P, HP, PP, jI, oF, qP, sF, vI, wP, xP, yP
// G26 (NewAgentIssuerSettingsPage): GI, VP, oF, sF, tL
const refuse = (member) => new Proxy(function(){}, {
  get(_t, k) { if (typeof k === `symbol` || k === `displayName`) return undefined; throw new Error(`issuers stub: ContextualMenuActions.${member}.${String(k)} read — component-body-only`); },
  apply() { throw new Error(`issuers stub: ContextualMenuActions.${member} called — component-body-only`); },
  construct() { throw new Error(`issuers stub: ContextualMenuActions.${member} constructed — component-body-only`); },
});
const $P = refuse(`$P`), GI = refuse(`GI`), HP = refuse(`HP`), PP = refuse(`PP`), VP = refuse(`VP`), jI = refuse(`jI`), oF = refuse(`oF`), qP = refuse(`qP`), sF = refuse(`sF`), tL = refuse(`tL`), vI = refuse(`vI`), wP = refuse(`wP`), xP = refuse(`xP`), yP = refuse(`yP`);
export { $P, GI, HP, PP, VP, jI, oF, qP, sF, tL, vI, wP, xP, yP };
