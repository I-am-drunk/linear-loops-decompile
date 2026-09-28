// Hand-written drive-mode driver for AutomationOwnerSelect.Cl2Nhq6T.js export
// `t` (G13; original code). The component body is hook-free (the mobx
// `observer` wrap is stubbed to identity at the module seam, G11 precedent),
// so calling it is pure. Its single child is a RENDER PROP: the corpus
// renders `UsersTooltip({users:[owner], children: fn})`; the driver invokes
// that function with a pinned `interactiveUsersTooltipContent` marker — the
// exact seam the real tooltip chunk fills — and projects both results:
// the tooltip element's own props (users array) and the render-prop result
// for BOTH `appearance` branches (`property` default and `inline`), plus the
// `dangerouslyNeverDisabled` discriminator on both access kinds.
const project = (node) => {
  if (Array.isArray(node)) return node.map(project);
  if (node === null || typeof node !== `object`) return node;
  const t = node.$$typeof;
  if (typeof t === `symbol` && (Symbol.keyFor(t) === `react.element` || Symbol.keyFor(t) === `react.transitional.element`)) {
    if (typeof node.type === `function`) throw new Error(`G13 driver: unexpected composite function element — extend the stubs`);
    const props = {};
    for (const [k, v] of Object.entries(node.props)) props[k] = typeof v === `function` ? `<function:${k}>` : project(v);
    return { element: node.type, key: node.key, props };
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = typeof v === `function` ? `<function:${k}>` : project(v);
  return out;
};

export default async ({ entry }) => {
  const OwnerSelect = entry.t;
  const owner = { id: `user-owner-1`, name: `Owner Fixture` };
  const workflow = { id: `wf-1`, effectiveOwner: owner };
  const access = (kind) => ({ configure: { kind, ...(kind === `disabled` ? { reason: `pinned-disabled-reason` } : {}) } });
  const tooltipMarker = `pin:interactiveUsersTooltipContent`;

  const render = (props) => {
    const tooltipEl = OwnerSelect(props);
    // The tooltip element's own props carry the users array; its children is
    // the render prop the corpus tooltip invokes with the tooltip content.
    const { children, ...tooltipProps } = tooltipEl.props;
    return {
      tooltip: { element: project(tooltipEl).element, props: project(tooltipProps) },
      renderPropResult: project(children({ interactiveUsersTooltipContent: tooltipMarker })),
    };
  };

  return {
    propertyAllowed: render({ workflow, access: access(`allowed`) }),
    inlineAllowed: render({ workflow, access: access(`allowed`), appearance: `inline`, sx: { pinned: `sx-fixture` } }),
    propertyDisabledKind: render({ workflow, access: access(`disabled`) }),
  };
};
