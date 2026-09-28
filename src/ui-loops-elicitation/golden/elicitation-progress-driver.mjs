// Hand-written drive-mode driver (G9; original code). The entry component
// (`AgentElicitationResponseQueue` export `t`) is hook-free, and so is every
// composite it renders (corpus `Flex` export `t`, `Text` export `t`, the
// stylex merge in `mixins.stylex`): none of them call React hooks, so each is
// an ordinary pure function from props to elements. The observation this
// driver declares is the FULLY FLATTENED HOST TREE: every composite element is
// replaced by the result of CALLING its own corpus function component (real
// corpus code executes; nothing is stubbed or simulated), recursively, until
// only host (string-typed) elements remain — the exact DOM structure React
// would commit, minus scheduling. Any hook call would throw (no dispatcher is
// installed), so a future corpus refresh that adds a hook fails loudly instead
// of being silently mis-projected.
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
  const ElicitationProgress = entry.t;
  return {
    inProgress: flatten(ElicitationProgress({ answeredCount: 2, elicitationCount: 5, isSubmitting: false })),
    none: flatten(ElicitationProgress({ answeredCount: 0, elicitationCount: 3, isSubmitting: false })),
    submitting: flatten(ElicitationProgress({ answeredCount: 5, elicitationCount: 5, isSubmitting: true })),
  };
};
