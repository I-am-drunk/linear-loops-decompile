// Hand-written drive-mode driver (G36; original code). The subject is the
// chunk's only export `t` (source fn r) — the Linear Agent empty-state hero:
// a 23x11 grid of 253 icon cells (one hidden center cell) behind a single
// gradient center icon. The component is hook-free and its composite closure
// is only the corpus jsx-runtime (which executes REAL) plus the icon seam
// (a declared string marker — the icon lives in the ContextualMenuActions
// chunk and is its own ledger surface; this golden observes WHAT THE ENTRY
// PASSES IT: {size:14, color:'labelFaint'} per grid cell, {size:14,
// gradient:true} for the center). The observation is the FULLY FLATTENED
// HOST TREE (the G9 pattern): every function-typed element is replaced by
// the result of calling its own corpus component, recursively; a hook call
// would throw (no dispatcher installed), so corpus drift that adds a hook
// fails loudly. The module-eval grid table (`p`, 253 entries of pure
// Math.sin-hash + toFixed layout math) executes REAL at import and its every
// cell lands in the output bytes: keys, the single isHidden cell at
// row 10 / col 11, --peak/--peak2/--trough, --tx/--ty, animationDelay.
const flatten = (node) => {
  if (Array.isArray(node)) return node.map(flatten);
  if (node === null || typeof node !== `object`) return node;
  const t = node.$$typeof;
  if (typeof t === `symbol` && (Symbol.keyFor(t) === `react.element` || Symbol.keyFor(t) === `react.transitional.element`)) {
    if (typeof node.type === `function`) return flatten(node.type(node.props));
    const props = {};
    for (const [k, v] of Object.entries(node.props)) props[k] = flatten(v);
    return { $$typeof: t, type: node.type, key: node.key, props };
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = flatten(v);
  return out;
};

export default async ({ entry }) => {
  const Hero = entry.t;
  return {
    static: flatten(Hero({ shouldAnimate: false })),
    animated: flatten(Hero({ shouldAnimate: true })),
  };
};
