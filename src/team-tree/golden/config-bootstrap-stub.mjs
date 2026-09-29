// Stub for config.aM1_XCHx.js — the ONE injection seam that makes the
// model-layer chunk `Issue.DRYymPCa.js` executable in the corpus-exec
// sandbox. The real chunk is a 6-line injected-config proxy (`t`, throwing
// until `n(config)` is called during client boot). This stub keeps that
// exact export contract (a proxy of benign values — URLs where a URL is
// read, false elsewhere — so config READS never throw and never carry
// behavior) and additionally performs, at module scope, the environment
// bootstrap the first-party boot chunk `html.CjyPLfH8.js` performs before
// any model chunk loads:
//   1. browser globals (window/self/document/navigator/localStorage/
//      matchMedia/location) as inert no-op shapes — the model chunks touch
//      them only in module-scope environment probes (sentry debug-id IIFE,
//      Logger breadcrumb restore, preload-helper's getElementsByTagName,
//      ClientStorage feature checks);
//   2. the app's own prototype extensions (html.CjyPLfH8.js function `f`/
//      `g`/`_`: Array distinct/concrete/sortBy/orderBy/groupBy/count,
//      String capitalize/deCapitalize, Set isEqualTo), transcribed from
//      that chunk — Logger's module scope calls `.concrete()` and dies
//      without them.
// Why this seam: config.aM1_XCHx.js is imported by Issue.DRYymPCa.js at
// static-import position 17, BEFORE Logger (38) and preload-helper (21) —
// ESM executes static imports depth-first in declaration order, so this
// stub runs before any chunk that needs the globals. The driven statics
// (enum + predicates + resolveTypeForTrigger) are pure over their arguments
// and read NONE of this — the bootstrap only lets the chunk's module scope
// complete. Verified: without this stub the import dies in Logger's module
// scope; with it, the chunk loads and the driven functions return values
// identical to the hand-read corpus source.
const def = (o, k, v) => Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: false });

// (1) browser globals — only when absent, and only inert shapes.
if (typeof globalThis.window === `undefined`) {
  globalThis.window = globalThis;
}
if (typeof globalThis.self === `undefined`) {
  globalThis.self = globalThis;
}
if (typeof globalThis.document === `undefined`) {
  globalThis.document = {
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {} }),
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
if (typeof globalThis.navigator === `undefined` || !globalThis.navigator.userAgent) {
  Object.defineProperty(globalThis, `navigator`, {
    value: { userAgent: `node-corpus-exec`, language: `en-US`, platform: `` },
    configurable: true,
  });
}
if (typeof globalThis.localStorage === `undefined`) {
  globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
}
if (typeof globalThis.matchMedia === `undefined`) {
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
if (typeof globalThis.location === `undefined`) {
  globalThis.location = { href: `https://localhost/`, origin: `https://localhost`, search: ``, pathname: `/` };
}
if (typeof globalThis.__toStaticUrl === `undefined`) {
  globalThis.__toStaticUrl = (x) => x;
}

// (2) prototype extensions, transcribed from html.CjyPLfH8.js (`f`, `g`, `_`).
if (!Array.prototype.distinct) {
  def(Array.prototype, `distinct`, function () {
    return this.length <= 15 ? this.filter((e, t, n) => n.indexOf(e) === t) : [...new Set(this)];
  });
}
if (!Array.prototype.concrete) {
  def(Array.prototype, `concrete`, function () { return this.filter((e) => e !== void 0); });
}
if (!Array.prototype.sortBy) {
  def(Array.prototype, `sortBy`, function (f) {
    return [...this].sort((a, b) => { const x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; });
  });
}
if (!Array.prototype.orderBy) {
  def(Array.prototype, `orderBy`, function (f, d) {
    const s = [...this].sort((a, b) => { const x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; });
    return d === `desc` ? s.reverse() : s;
  });
}
if (!Array.prototype.groupBy) {
  def(Array.prototype, `groupBy`, function (k) {
    const m = new Map;
    for (const t of this) { const r = t[k]; const i = m.get(r); i ? i.push(t) : m.set(r, [t]); }
    return m;
  });
}
if (!Array.prototype.count) {
  def(Array.prototype, `count`, function (p) {
    let c = 0;
    for (let i = 0; i < this.length; i++) if (p(this[i], i, this)) c++;
    return c;
  });
}
if (!String.prototype.capitalize) {
  def(String.prototype, `capitalize`, function () { return this.charAt(0).toUpperCase() + this.slice(1); });
}
if (!String.prototype.deCapitalize) {
  def(String.prototype, `deCapitalize`, function () { return this.charAt(0).toLowerCase() + this.slice(1); });
}
if (!Set.prototype.isEqualTo) {
  def(Set.prototype, `isEqualTo`, function (e) { return this.size === e.size && [...this].every((t) => e.has(t)); });
}

// (3) the real chunk's export contract: t = config proxy, n = injectConfig.
let injected;
export function n(config) { injected = config; }
export const t = new Proxy({}, {
  get(_, key) {
    if (injected && key in injected) return injected[key];
    if (typeof key === `string` && /URL/.test(key)) return `https://localhost`;
    return false;
  },
});
