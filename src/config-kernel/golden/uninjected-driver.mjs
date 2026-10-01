// Hand-written drive-mode driver for config.aM1_XCHx.js (CONFIG-KERNEL claim,
// #225 2026-09-29; original code). The chunk is the injectable-config
// contract: export `t` = a Proxy that throws until injection, export `n` =
// `injectConfig`. Closure size 1, zero stubs — the chunk's only module-scope
// side effect is the sentry-debug-id preamble, which is typeof-guarded.
//
// Pins, in order:
//   1. the exact uninjected-read throw copy (a REACHABLE degraded state per
//      the merged R-BOOT §3 row: any config read before injectConfig);
//   2. injection passthrough (reads forward to the injected object);
//   3. a missing key on the injected object reads as `undefined` (the corpus
//      body is a bare `return n[t]` — no existence check after injection);
//   4. re-injection REPLACES the object (the setter is `n = e`, uncondition-
//      al), so later reads see the new value.
export default async ({ entry }) => {
  const config = entry.t;
  const injectConfig = entry.n;

  let uninjectedThrow = null;
  try {
    void config.CLIENT_URL;
  } catch (error) {
    uninjectedThrow = error instanceof Error ? error.message : String(error);
  }

  injectConfig({ CLIENT_URL: `https://first.example.test`, COUNT: 3 });
  const injectedRead = config.CLIENT_URL;
  const injectedNumber = config.COUNT;
  const missingKeyRead = config.NOT_A_KEY;

  injectConfig({ CLIENT_URL: `https://second.example.test` });
  const reinjectedRead = config.CLIENT_URL;
  const replacedKeyRead = config.COUNT; // gone with the old object

  return { uninjectedThrow, injectedRead, injectedNumber, missingKeyRead, reinjectedRead, replacedKeyRead };
};
