// Hand-written stub for types.7f0h45Sh.js (G20 case; original code; the real
// chunk reads window at module scope). The entry reads `o` (the feature-flag
// registry, raw-source local `Z`) in two module-eval positions:
// - `Z.applicable: () => D.isEnabled(D.codeSandboxSizing)` — a CLOSURE, not a
//   call at eval; the golden PROBES it, so isEnabled is pinned per-probe
//   (returns the probe plan's scripted values below) and codeSandboxSizing is
//   the flag KEY the closure passes back in (identity marker).
// - `G(D....)` flag reads happen only inside component bodies (out of scope).
// Any other member read throws.
// The probe script rides globalThis because the sandbox links its own copy
// of this module — a driver-side import would be a second instance.
export const o = new Proxy({
  codeSandboxSizing: `flag:codeSandboxSizing`,
  isEnabled: (flag) => {
    const script = globalThis.__g20IsEnabledScript;
    if (!script) throw new Error(`G20 stub: types.o.isEnabled called outside a scripted probe`);
    return script(flag);
  },
}, {
  get(t, k) { if (k in t) return t[k]; throw new Error(`G20 stub: types.o.${String(k)} read — out of the metadata scope`); },
});
