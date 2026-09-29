// Stub for config.aM1_XCHx.js — the same injection seam TYPE-LATTICE used
// (src/loops-type-lattice/golden/config-bootstrap-stub.mjs), adapted for the
// BOOT chunk itself: html.CjyPLfH8.js imports this chunk at static position 3
// (after rolldown-runtime and core, whose module scopes are environment-safe
// typeof-guarded registrations), and BEFORE config.Uz-QjVze.js (position 4),
// whose module scope computes `new URL(n('CLIENT_URL'))` and
// `new URL(self.document.URL)` — so this stub's module scope is the last
// place browser globals can appear before real chunks need them.
//
// What it fakes and why each piece is benign for this case's outputs:
//   1. `window`/`self` = globalThis; `document` with `createElement('link')
//      .relList.supports() -> true` so html's modulepreload polyfill takes
//      its native-support early-return (no MutationObserver needed) — the
//      polyfill is B1/ADAPT, not under test; `document.URL` a valid URL for
//      config.Uz-QjVze's PREVIEW_PR_NUMBER host match.
//   2. `window.CLIENT_ENV` = a Proxy answering EVERY key with the URL-shaped
//      string `https://localhost` (`has` -> true), so config.Uz-QjVze's
//      module-scope `n()` reads never hit the console.error fallback and its
//      `new URL(...)` constructions parse. Config VALUES carry no behavior
//      driven here: the case drives only the installed prototype methods.
//   3. The real export contract of config.aM1_XCHx.js: `t` (the injected-
//      config proxy) and `n` (injectConfig) — html calls `n(CONFIG)` at boot
//      (B3); the driven prototype installs read none of it.
// The prototype installs themselves are NOT transcribed here (unlike the
// TYPE-LATTICE stub, which had to bootstrap them for a model-layer chunk):
// the entry chunk under execution IS their first-party definition site, so
// the corpus installs them itself — that is exactly what this golden records.
// Pull the entry stub into the sandbox closure: the boot chunk's trailing
// dynamic import is BACKTICK-quoted in the raw tree (`import(\`./entry…\`)`),
// which the sandbox's import scan (double-quoted specifiers) does not
// traverse — without this line the declared entry stub is never placed, the
// dynamic import rejects, and the boot chunk's rethrow becomes an unhandled
// rejection racing process exit (the digest's §1 backtick-import lesson, met
// again). Importing the (inert) stub here is side-effect-free.
import "./entry.BGeHYrTB.js";

const def = (o, k, v) => Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: false });

if (typeof globalThis.window === `undefined`) {
  globalThis.window = globalThis;
}
if (typeof globalThis.self === `undefined`) {
  globalThis.self = globalThis;
}
if (typeof globalThis.document === `undefined`) {
  globalThis.document = {
    URL: `https://localhost/`,
    createElement: () => ({
      style: {},
      relList: { supports: () => true },
      setAttribute() {},
      addEventListener() {},
    }),
    createTextNode: () => ({}),
    documentElement: { style: {} },
    head: { appendChild() {} },
    body: { appendChild() {} },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementsByTagName() { return []; },
    visibilityState: `visible`,
  };
}
if (typeof globalThis.navigator === `undefined` || !globalThis.navigator.language) {
  def(globalThis, `navigator`, { language: `en-US`, languages: [`en-US`], userAgent: `corpus-exec` });
}
if (typeof globalThis.localStorage === `undefined`) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => void store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}
if (typeof globalThis.matchMedia === `undefined`) {
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
if (typeof globalThis.location === `undefined`) {
  globalThis.location = { href: `https://localhost/`, origin: `https://localhost`, search: ``, pathname: `/` };
}
// window.CLIENT_ENV: every key present, URL-shaped, so config.Uz-QjVze's
// module-scope URL constructions parse and no n() fallback fires.
if (typeof globalThis.CLIENT_ENV === `undefined`) {
  globalThis.CLIENT_ENV = new Proxy({}, {
    has: () => true,
    get: (_, key) => (typeof key === `string` ? `https://localhost` : undefined),
  });
}

// The real chunk's export contract: t = throwing-until-injected config proxy
// (benign values here), n = injectConfig.
let injected;
export function n(config) { injected = config; }
export const t = new Proxy({}, {
  get(_, key) {
    if (injected && key in injected) return injected[key];
    if (typeof key === `string` && /URL/.test(key)) return `https://localhost`;
    return false;
  },
});
