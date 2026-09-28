// Linking-only stubs for the remaining import seams of
// useLoopTemplateLauncher.O9-_gagH.js (G22; original code). Every export the
// entry links is a throw-on-use bomb: the driven presenter statics touch none
// of them (mechanically true — the golden run would throw otherwise).
// Throw-on-use bomb factory (inlined per-stub: sandbox stubs may only import
// corpus chunks). The driven presenter statics never touch these seams; any
// drift that adds a read or call fails loudly. Nothing here fakes behavior.
const bomb = (name) => {
  const f = () => { throw new Error(`G22 stub: ${name} used — out of the presenter golden's scope`); };
  return new Proxy(f, {
    get(_t, k) {
      if (typeof k === `symbol` || k === `name` || k === `length` || k === `prototype`) return undefined;
      throw new Error(`G22 stub: ${name}.${String(k)} read — out of the presenter golden's scope`);
    },
  });
};

// ContextualMenuActions.Dlg9Oa2U.js seams ($R AiConversation model API, Lx workflow ACL helper)
export const $R = bomb(`CMA.$R(AiConversation)`);
export const Lx = bomb(`CMA.Lx(workflow ACL helper)`);
// timezone.lphPF5Vd.js (a = current-timezone getter; only buildSchedule uses it — out of scope)
export const a = bomb(`timezone.a(currentTimezone)`);
// ThemeProvider.BNrg3wTr.js (i = useTheme)
export const i = bomb(`ThemeProvider.i(useTheme)`);
// types.7f0h45Sh.js (o = feature-flag registry)
export const o = bomb(`types.o(flag registry)`);
// mobx (E = runInAction) — only the q builders use it
export const E = bomb(`mobx.E(runInAction)`);
// MarkdownTransformer / Logger / hooks / RefreshManager / Toast /
// AgentToolbarState / useUser / useFlag / AgentComposeDraftTracker /
// LoopCreationTracker / AutomationHelper — hook/launcher-scope only.
export const t = bomb(`seam.t`);
export const n = bomb(`seam.n`);
export const S = bomb(`seam.S(Logger)`);
export const W = bomb(`hooks.W`);
export const f = bomb(`hooks.f`);
export const s = bomb(`RefreshManager.s`);
export const r = bomb(`AutomationHelper.r`);
