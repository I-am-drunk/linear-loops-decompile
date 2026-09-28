// Hand-written drive-mode driver for LoopViewType.BzPUaBkC.js (G6; original
// code). The chunk's export map is `export{n, t as r, e as t}`:
//   entry.t — the view-type enum object   (chunk-local `e`)
//   entry.r — the display-label map       (chunk-local `t`, keyed by enum VALUES)
//   entry.n — the validator function      (true iff arg is an enum value)
// invoke mode can observe only one function call; this driver projects the
// whole module surface: both value objects verbatim (own-key order preserved
// by the serializer) plus the validator's behavior on every enum value and on
// representative rejects (empty string, a label string, an enum KEY — a key
// is not a value — and undefined).
export default async ({ entry }) => {
  const viewTypes = entry.t;
  const labels = entry.r;
  const isViewType = entry.n;
  return {
    viewTypes,
    labels,
    isViewType: {
      // every enum value, keyed by the enum's own keys
      ...Object.fromEntries(Object.entries(viewTypes).map(([k, v]) => [k, isViewType(v)])),
      rejectsEmptyString: isViewType(``),
      rejectsLabelString: isViewType(`My loops`),
      rejectsEnumKey: isViewType(`myLoops`),
      rejectsUndefined: isViewType(undefined),
    },
  };
};
