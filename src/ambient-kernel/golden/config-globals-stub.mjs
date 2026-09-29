// Stub for config.aM1_XCHx.js — the same enabling seam as the merged
// TYPE-LATTICE golden (src/loops-type-lattice/golden/config-bootstrap-stub.mjs,
// PR #301): keep the real chunk's tiny export contract (the injected-config
// proxy + its injector) and, at module scope, install the inert browser-global
// shapes the OTHER boot-spine chunks need before their module scopes run.
//
// Import order in the entry `html.CjyPLfH8.js`: rolldown-runtime (1), core (2),
// config.aM1_XCHx (3, THIS stub), config.Uz-QjVze (4), preload-helper (5), then
// the entry body. ESM executes static imports depth-first in declaration order,
// so this stub runs before config.Uz-QjVze — whose module scope reads
// `window.CLIENT_ENV` (guarded, but `window` itself must exist) — and before
// the entry body, whose modulepreload IIFE touches `document.createElement`,
// `document.querySelectorAll`, and `new MutationObserver`, and whose installer
// tail assigns `window.__toStaticUrl` / `window.requestIdleCallback`.
//
// Unlike the #301 stub this one does NOT pre-install any prototype
// extensions: installing them is exactly the behavior under test — the REAL
// installer functions in html.CjyPLfH8.js must do it. Rolldown-runtime and
// core (positions 1–2) run before this stub, and neither touches globals at
// module scope beyond their guarded sentry IIFEs (read at site).
//
// The real chunk, for contract fidelity (pretty config.aM1_XCHx.js):
//   var e = new Proxy({}, { get(e, t) { if (!n) throw ...; return n[t] } });
//   function t(e) { n = e }  var n;  export { t as n, e as t };
// We reproduce it verbatim in behavior: the proxy throws until injected, and
// the entry body's `o(s)` call injects the REAL config table built by
// config.Uz-QjVze (which runs real, on baked prod fallbacks — CLIENT_ENV is
// deliberately left unset, deterministic).

// (1) window/self as the node global — the boot chunk treats them as the
// global object (`window.__toStaticUrl = …`, `window.requestIdleCallback`).
if (typeof globalThis.window === `undefined`) globalThis.window = globalThis;
if (typeof globalThis.self === `undefined`) globalThis.self = globalThis;

// (2) document — only what the modulepreload IIFE and preload paths read.
if (typeof globalThis.document === `undefined`) {
  globalThis.document = {
    URL: `https://corpus-exec.invalid/`,
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {} }),
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementsByTagName() { return []; },
    head: { appendChild() {} },
    body: { appendChild() {} },
    addEventListener() {},
    visibilityState: `visible`,
  };
}

// (3) MutationObserver — the modulepreload IIFE constructs and observes one.
if (typeof globalThis.MutationObserver === `undefined`) {
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
}

// (4) localStorage — guarded reads in the closure's storage probes.
if (typeof globalThis.localStorage === `undefined`) {
  globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
}

// The real chunk's exact export contract.
let injected;
const proxy = new Proxy({}, {
  get(_target, key) {
    if (!injected) throw Error(`Config has not been injected. Call injectConfig() during client initialization.`);
    return injected[key];
  },
});
function injectConfig(value) {
  injected = value;
}
export { injectConfig as n, proxy as t };
