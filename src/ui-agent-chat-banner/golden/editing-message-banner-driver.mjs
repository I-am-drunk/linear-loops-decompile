// Hand-written drive-mode driver (G16; original code). The subject is export
// `n` (source fn f) — the "Editing message" banner. It is hook-free, and so is
// every composite it renders: the corpus `Text` executes for real (no stub);
// the edit-icon seam is a declared string marker (its own chunk's surface).
// The observation is the FULLY FLATTENED HOST TREE (the G9 pattern): every
// function-typed element is replaced by the result of calling its own corpus
// component, recursively; a hook call would throw (no dispatcher installed),
// so corpus drift that adds a hook fails loudly.
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
  const EditingMessageBanner = entry.n;
  return { banner: flatten(EditingMessageBanner()) };
};
