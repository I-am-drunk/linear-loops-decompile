// Hand-written drive-mode driver for TeamAgentsSettingsPage.BJ-fHoBc.js
// export `pageMetadata` (G18; original code). The metadata literal is built
// at MODULE EVAL: the REAL corpus jsx-runtime executes the descriptionElement
// fragment, and the REAL AgentGuidanceSettings chunk's factory (`m('team')`)
// fills sections.agentGuidance — the first golden observing one golden-backed
// chunk's output flowing through another chunk (cross-chunk provenance).
//
// Declared projections (the G13 discipline):
// - a Fragment element (symbol type react.fragment) projects as
//   { fragment: [projected children] } — the serializer accepts only
//   string-typed (host/marker) element types;
// - the applicable predicate (a function) is PROBED, not serialized: the
//   corpus source is `({organization:e})=>e.agentAppUsers.some(e=>e.isActive
//   &&!!e.oauthClientId)` (the G11-pinned predicate) — two fixtures pin the
//   conjunction; the projection replaces it with the probe results.
const FRAGMENT = Symbol.for(`react.fragment`);
const isElement = (v) => v !== null && typeof v === `object` && typeof v.$$typeof === `symbol` &&
  (Symbol.keyFor(v.$$typeof) === `react.element` || Symbol.keyFor(v.$$typeof) === `react.transitional.element`);

const project = (node) => {
  if (Array.isArray(node)) return node.map(project);
  if (node === null || typeof node !== `object`) return node;
  if (isElement(node)) {
    const props = {};
    for (const [k, v] of Object.entries(node.props)) props[k] = project(v);
    if (node.type === FRAGMENT) return { fragment: props.children ?? null };
    if (typeof node.type !== `string`) throw new Error(`G18 driver: unexpected composite element — extend the stubs`);
    return { element: node.type, key: node.key, props };
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = typeof v === `function` ? `<function:${k}>` : project(v);
  }
  return out;
};

export default async ({ entry }) => {
  const metadata = entry.pageMetadata;
  const guidance = metadata.sections.agentGuidance;
  const user = (active, clientId) => ({ isActive: active, oauthClientId: clientId });
  return {
    metadata: project(metadata),
    ownKeys: Object.keys(metadata),
    sectionsOwnKeys: Object.keys(metadata.sections),
    agentGuidanceApplicable: {
      activeWithClientId: guidance.applicable({ organization: { agentAppUsers: [user(true, `client-1`)] } }),
      activeWithoutClientId: guidance.applicable({ organization: { agentAppUsers: [user(true, null)] } }),
      inactiveWithClientId: guidance.applicable({ organization: { agentAppUsers: [user(false, `client-1`)] } }),
      empty: guidance.applicable({ organization: { agentAppUsers: [] } }),
    },
  };
};
