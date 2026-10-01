// Stub for config.aM1_XCHx.js in the boot-static-url case pair (CACHE_BUST
// branch: ABSENT). Identical to boot-world-bust-stub.mjs except the fixture
// CLIENT_ENV omits CACHE_BUST (an optional key with no baked VITE_CACHE_BUST
// entry, so `s.CACHE_BUST` is undefined and __toStaticUrl's ternary takes
// the bare-URL branch). Both branch values are pinned across the case pair,
// per the corpus-exec stub doctrine. See the bust stub for the full rationale.
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
