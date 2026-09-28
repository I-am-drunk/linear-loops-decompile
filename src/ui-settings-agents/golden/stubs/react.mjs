// Hand-written stub for react.Bfm_Hgom.js (G34 case; original code). The
// entry interops the namespace at module eval through the REAL
// rolldown-runtime (`var o = e(r())`), which copies the stub's own members
// onto the interop object — so only the pinned member exists there and any
// unpinned hook read fails loudly as an undefined call. The entry's hook
// body reads exactly one member: useMemo. The stub computes the memo eagerly
// (memoization itself is React scheduling, not this chunk's behavior) and
// RECORDS the deps array so the driver pins its shape and identity.
export const memoCalls = [];
export const t = () => ({
  useMemo: (compute, deps) => {
    memoCalls.push({ deps });
    return compute();
  },
});
