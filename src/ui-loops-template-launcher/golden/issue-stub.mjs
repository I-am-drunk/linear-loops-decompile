// Linking-only stub for Issue.DRYymPCa.js (G22; original code). The
// model-layer chunk cannot execute (module-level browser globals, the
// G7/G12 finding); the presenter statics driven by this golden touch NONE of
// its twenty imported names, so every one is a throw-on-use bomb.
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

export const E_ = bomb(`Issue.E_(activation-mode enum)`);
export const G = bomb(`Issue.G(Team model)`);
export const Gt = bomb(`Issue.Gt`);
export const Hg = bomb(`Issue.Hg`);
export const Kf = bomb(`Issue.Kf`);
export const Nu = bomb(`Issue.Nu(DocumentContent)`);
export const Pa = bomb(`Issue.Pa`);
export const T_ = bomb(`Issue.T_(trigger-type enum)`);
export const Tn = bomb(`Issue.Tn(Project model)`);
export const Ug = bomb(`Issue.Ug(status enum)`);
export const Vd = bomb(`Issue.Vd`);
export const W_ = bomb(`Issue.W_`);
export const bl = bomb(`Issue.bl`);
export const ip = bomb(`Issue.ip(part-type enum)`);
export const ka = bomb(`Issue.ka`);
export const xC = bomb(`Issue.xC(schedule-type enum)`);
export const yC = bomb(`Issue.yC(schedule helper)`);
export const y_ = bomb(`Issue.y_(definition-type enum)`);
export const yc = bomb(`Issue.yc`);
export const zm = bomb(`Issue.zm(starter message)`);
