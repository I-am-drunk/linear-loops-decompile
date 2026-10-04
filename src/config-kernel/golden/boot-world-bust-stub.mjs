// Stub for config.aM1_XCHx.js in the boot-static-url case pair (CACHE_BUST
// branch: SET). Two jobs, both forced by ESM import order — the boot chunk
// `html.CjyPLfH8.js` imports {rolldown-runtime, core, config.aM1_XCHx,
// config.Uz-QjVze, preload-helper} in that order, so this stub is the last
// module that runs before the CONFIG table chunk evaluates:
//   1. the environment bootstrap (browser-global shapes + fixture CLIENT_ENV)
//      that config.Uz-QjVze.js and the boot body need at module eval — the
//      #301 config-bootstrap seam recipe, world values chosen for THIS case:
//      ASSET_URL + CACHE_BUST set, CLIENT_URL a fixture origin;
//   2. a RECORDING injectConfig: the real aM1 contract chunk is the SUBJECT
//      of the sibling config-contract case and stays real there; here it is
//      replaced so the golden can pin WHAT boot injects (B3) — the recorder
//      keeps the real setter semantics (unconditional replace) and exposes
//      the injected object to the driver via globalThis.__injectedConfig.
// Everything else in the boot chunk executes REAL: the prototype installers,
// __toStaticUrl (B4, the case's subject), the idle-callback polyfills, and
// the entry dynamic import (the entry chunk itself is stubbed empty — a
// 500-chunk app closure is not this unit; declared below in the case).
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = {
  URL: `https://loops.example.test/`,
  createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {} }),
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementsByTagName: () => [],
  head: { appendChild() {} },
  body: { appendChild() {} },
};
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};
globalThis.window.CLIENT_ENV = {
  ASSET_URL: `https://assets.example.test/client/`,
  CACHE_BUST: `bust-7`,
  CLIENT_URL: `https://loops.example.test`,
};

let injected;
export function n(value) {
  injected = value;
  globalThis.__injectedConfig = value;
}
export const t = new Proxy(
  {},
  {
    get(_target, key) {
      if (!injected) throw Error(`Config has not been injected. Call injectConfig() during client initialization.`);
      return injected[key];
    },
  },
);
