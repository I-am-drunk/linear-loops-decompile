// Hand-written drive-mode driver for html.CjyPLfH8.js (CONFIG-KERNEL claim,
// #225 2026-09-29; original code). Shared by the boot-static-url case PAIR
// (bust / nobust worlds). The boot chunk has no exports — its module eval IS
// the behavior (B2 prototype install, B3 `o(s)` injectConfig(TABLE), B4
// `window.__toStaticUrl`, B5 idle polyfills, B7 entry import) — so the
// driver probes the world it left behind:
//   1. __toStaticUrl over three inputs (the B4 kernel: ASSET_URL concat +
//      conditional `?CACHE_BUST` — the branch differs across the case pair);
//   2. WHAT B3 injected: identity with the REAL config.Uz-QjVze.js table
//      export (loaded from the same sandbox), its size, and two sample
//      members — pinning that boot injects THE table object, not a copy;
//   3. spot facts that B2 ran before B4 (the boot order the R-BOOT shard
//      pins): one probe per installer family — Array.distinct's both fork
//      sides (<=15 indexOf-filter vs Set), String.toQuestion's strip+append,
//      Set.isEqualTo, Promise.raceFind's all-settle-undefined contract,
//      Object.hasOwn presence, the Symbol.dispose GUARD (already defined on
//      Node >= 20.4, so `y('dispose')` takes its leave-it-alone branch and
//      the description stays `nodejs.dispose`; the `@linear/` install branch
//      is browser-only and stays out of this golden), and
//      the ambient DATE half (core `fe`) via an ambient-INVARIANT probe
//      (offsetBySeconds: pure epoch-ms arithmetic — toTimelessDate/midnight
//      read LOCAL date fields and belong to DATE-KERNEL's ambient-pinned
//      goldens) — enough to pin THAT the installers ran; the per-method
//      value grids belong to the PROTO-KERNEL and DATE-KERNEL claims
//      (20:22:42Z / 20:16:05Z), not this slice.
export default async ({ entry, load }) => {
  void entry; // no exports; the module eval already ran
  const tableModule = await load(`config.Uz-QjVze.js`);
  const injected = globalThis.__injectedConfig;

  const fixedUtc = new Date(Date.UTC(2026, 0, 5, 3, 4, 5));

  return {
    toStaticUrl: {
      plain: window.__toStaticUrl(`assets/entry.X.js`),
      nested: window.__toStaticUrl(`assets/deep/chunk.Y.js`),
      empty: window.__toStaticUrl(``),
    },
    injectedIsTheTableExport: injected === tableModule.t,
    injectedKeyCount: Object.keys(injected).length,
    injectedSamples: {
      CLIENT_URL: injected.CLIENT_URL,
      CLIENT_HOSTNAME: injected.CLIENT_HOSTNAME,
    },
    prototypeInstallProbes: {
      distinctSmall: [1, 1, 2].distinct(),
      distinctLarge: Array.from({ length: 16 }, (_x, i) => (i % 4)).distinct(),
      toQuestion: `Run it.`.toQuestion(),
      toQuestionAlready: `Run it?`.toQuestion(),
      setIsEqualTo: new Set([1, 2]).isEqualTo(new Set([2, 1])),
      raceFindAllSettleUndefined: await Promise.raceFind([Promise.resolve(1), Promise.resolve(2)], () => false),
      hasOwn: Object.hasOwn({ a: 1 }, `a`),
      disposeDescription: Symbol.dispose.description,
      offsetBySecondsIso: fixedUtc.offsetBySeconds(90).toISOString(),
    },
  };
};
