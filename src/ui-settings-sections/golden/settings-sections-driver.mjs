// Hand-written drive-mode driver for
// WorkflowAgentAutomationSettingsConstants.DhHHohXQ.js (G19; original code).
// Export map `export{l as a, u as i, c as n, s as r, f as t}`:
//   entry.r — SettingsSection (chunk-local s): section > optional Flex header
//             (title Text + optional accessory div) > children;
//   entry.n — SettingsCard (chunk-local c): the VP themed-card seam with
//             sx [card, flush&&cardFlush, sx];
//   entry.a — SettingsLabeledRow (chunk-local l): the divided computed-member
//             class trick, the MP/ZP seams, the labelFor ternary
//             (Text as=label + htmlFor vs plain Text), optional description;
//   entry.i — SettingsDescriptionRow (chunk-local u): same divided trick,
//             description-only row;
//   entry.t — the `agent-automation-permissions` anchor id constant.
//
// Projection: the G9/G13 hybrid the merged goldens use — HOOK-FREE composites
// (corpus Flex, Text; verified hook-free) are EXECUTED (real corpus code,
// flattened to host output), string-marker seam types (the CMA stubs) stay
// leaves, function props project as declared `<function:key>` placeholders,
// and an unexpected composite FUNCTION element throws loudly.
const flatten = (node) => {
  if (Array.isArray(node)) return node.map(flatten);
  if (node === null || typeof node !== `object`) return node;
  const t = node.$$typeof;
  if (typeof t === `symbol` && (Symbol.keyFor(t) === `react.element` || Symbol.keyFor(t) === `react.transitional.element`)) {
    if (typeof node.type === `function`) return flatten(node.type(node.props));
    const props = {};
    for (const [k, v] of Object.entries(node.props)) props[k] = typeof v === `function` ? `<function:${k}>` : flatten(v);
    return { element: node.type, key: node.key, props };
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = typeof v === `function` ? `<function:${k}>` : flatten(v);
  return out;
};

export default async ({ entry }) => {
  const Section = entry.r;
  const Card = entry.n;
  const LabeledRow = entry.a;
  const DescriptionRow = entry.i;

  return {
    permissionsAnchorId: entry.t,
    section: {
      // title + accessory: the full header Flex (executed real) + the
      // 8-class accessory div; children pass through.
      titledWithAccessory: flatten(Section({ id: `sec-1`, title: `Pinned title`, accessory: `pin:accessory`, children: `pin:children` })),
      // no title: the header is null entirely (accessory has no home).
      untitled: flatten(Section({ id: `sec-2`, children: `pin:children` })),
      // title without accessory: header renders, accessory slot null.
      titledNoAccessory: flatten(Section({ id: `sec-3`, title: `Pinned title`, children: `pin:children` })),
    },
    card: {
      // sx composition [card, flush && cardFlush, sx] on both flush branches.
      plain: flatten(Card({ id: `card-1`, children: `pin:children` })),
      flushWithSx: flatten(Card({ id: `card-2`, flush: true, sx: { pinned: `sx-fixture` }, children: `pin:children` })),
    },
    labeledRow: {
      // labelFor branch: Text as=label + htmlFor; divided flips the computed
      // member class; description present.
      dividedLabeledDescribed: flatten(LabeledRow({ title: `Pinned row title`, description: `Pinned description`, labelFor: `input-1`, descriptionId: `desc-1`, divided: true, children: `pin:children` })),
      // no labelFor, no description, undivided: the other side of all three.
      plain: flatten(LabeledRow({ title: `Pinned row title`, children: `pin:children` })),
    },
    descriptionRow: {
      divided: flatten(DescriptionRow({ divided: true, children: `pin:description-children` })),
      undivided: flatten(DescriptionRow({ children: `pin:description-children` })),
    },
  };
};
