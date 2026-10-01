// Hand-written drive-mode driver for config.Uz-QjVze.js (CONFIG-KERNEL claim,
// #225 2026-09-29; original code). The chunk's export `t` is the CONFIG
// table, computed at module eval over the fixture world the Features stub
// installs (world-env-stub.mjs — the one seam; the subject chunk itself
// executes REAL, both accessors and every derivation included).
//
// The driver projects:
//   1. ownKeys — the 90-member own-key ORDER of the table (82 accessor keys
//      + FLAG_CLIENT + the 4 __RELEASE_INFO members + the 3 IS_* build
//      constants), the census that fails loudly on a corpus refresh that
//      adds/moves/removes a key;
//   2. the table itself, verbatim (tagged-v2 serializes the DEPLOYED_AT Date
//      and every undefined distinctly);
//   3. the required-accessor degraded path evidence: console.error captured
//      for the one key the fixture maps to `undefined`
//      (SANITY_CHANGELOG_API_KEY) — the exact corpus copy, exactly once —
//      and `''` as its table value (visible in the table projection);
//   4. the null-passthrough facts at their table positions: SANITY_PROJECT_ID
//      (null through n() — the guard is strict-undefined) and
//      SENTRY_DSN/SENTRY_TUNNEL (explicit null through r() — the telemetry
//      self-disable shape R-BOOT §4 relies on).
//
// console capture: the table computes at the ENTRY's module eval, before any
// driver runs — so the console.error recorder is installed by the world stub
// (which ESM executes first) onto globalThis.__consoleErrors, and this driver
// only projects what it recorded. See world-env-stub.mjs.
export default async ({ entry }) => {
  const table = entry.t;
  return {
    ownKeys: Object.keys(table),
    table: { ...table },
    consoleErrors: globalThis.__consoleErrors ?? [],
  };
};
