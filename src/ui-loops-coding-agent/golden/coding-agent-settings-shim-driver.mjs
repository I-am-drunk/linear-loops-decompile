// Hand-written drive-mode driver for the RE-EXPORT SHIM
// CodingAgentSettingsPage.C73HMBrM.js (G21; original code). The shim's whole
// behavior is its alias map (target n/r/t -> Component /
// CodingAgentSettingsContent / pageMetadata); the driver pins that map and
// re-drives the surfaced pageMetadata through the SAME projection + probes as
// the G20 golden (whose metadata region this golden's must byte-match). The metadata literal is built at MODULE EVAL: the REAL
// corpus jsx-runtime executes the descriptionElement fragment, the REAL
// golden-backed CodingAgentModelSelect chunk (G12) supplies the harness/model
// item descriptions (K.descriptions.*), and the REAL
// CommitSigningWorkspaceSetting chunk supplies the commitSigning item —
// three-chunk cross-provenance (the G18 chain, one deeper).
//
// Declared projections (G13/G18 discipline):
// - Fragment elements project as {fragment: [children]};
// - functions project as `<function:key>` placeholders; the two `applicable`
//   closures in the metadata are PROBED instead:
//   * loopsRepositoryAccess.applicable = ({organization}) =>
//     canAccess(agentAutomations) && canAccess(codingSessions) — four
//     fixtures pin the conjunction and record WHICH feature keys are asked;
//   * regionPinning.applicable = () => D.isEnabled(D.codeSandboxSizing) — the
//     types-registry seam is scripted per-probe; both branch values pinned,
//     plus the flag key the closure passes back (identity through the seam).
const isElement = (v) => v !== null && typeof v === `object` && typeof v.$$typeof === `symbol` &&
  (Symbol.keyFor(v.$$typeof) === `react.element` || Symbol.keyFor(v.$$typeof) === `react.transitional.element`);
const FRAGMENT = Symbol.for(`react.fragment`);

const project = (node) => {
  if (Array.isArray(node)) return node.map(project);
  if (node === null || typeof node !== `object`) return node;
  if (isElement(node)) {
    const props = {};
    for (const [k, v] of Object.entries(node.props)) props[k] = project(v);
    if (node.type === FRAGMENT) return { fragment: props.children ?? null };
    if (typeof node.type !== `string`) throw new Error(`G20 driver: unexpected composite element — extend the stubs`);
    return { element: node.type, key: node.key, props };
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = typeof v === `function` ? `<function:${k}>` : project(v);
  return out;
};

export default async ({ entry, load }) => {
  const metadata = entry.pageMetadata;
  // Identity pins against the target module: a swap of the two component
  // aliases (both `function`) would otherwise pass on names+types alone
  // (CodeRabbit finding on #276).
  const target = await load(`CodingAgentSettingsPage.lcMyXnM7.js`);
  const aliasSurface = {
    ownExportNames: Object.keys(entry).sort(),
    aliasIdentity: {
      pageMetadataIsTargetR: entry.pageMetadata === target.r,
      componentIsTargetN: entry.Component === target.n,
      contentIsTargetT: entry.CodingAgentSettingsContent === target.t,
    },
    componentExportsPresent: {
      Component: typeof entry.Component,
      CodingAgentSettingsContent: typeof entry.CodingAgentSettingsContent,
    },
  };
  const items = metadata.sections.general.items;

  // loopsRepositoryAccess.applicable: record asked keys + pin the conjunction.
  const org = (grants) => {
    const asked = [];
    return {
      asked,
      organization: { canAccess: (k) => { asked.push(k); return grants.includes(k); } },
    };
  };
  const both = org([`codingSessions`, `agentAutomations`]);
  const onlyCoding = org([`codingSessions`]);
  const onlyAutomations = org([`agentAutomations`]);
  const neither = org([]);
  const lra = items.loopsRepositoryAccess.applicable;
  const loopsRepositoryAccess = {
    both: lra({ organization: both.organization }),
    onlyCoding: lra({ organization: onlyCoding.organization }),
    onlyAutomations: lra({ organization: onlyAutomations.organization }),
    neither: lra({ organization: neither.organization }),
    askedKeysOnBoth: both.asked,
  };

  // regionPinning.applicable: script the flag seam for each probe.
  const rp = items.regionPinning.applicable;
  const askedFlags = [];
  globalThis.__g20IsEnabledScript = (flag) => { askedFlags.push(flag); return true; };
  const whenEnabled = rp();
  globalThis.__g20IsEnabledScript = (flag) => { askedFlags.push(flag); return false; };
  const whenDisabled = rp();
  delete globalThis.__g20IsEnabledScript;

  const envApplicable = metadata.sections.environments.applicable;
  const environmentsApplicable = {
    granted: envApplicable({ organization: { canAccess: (k) => k === `codingSessions` } }),
    denied: envApplicable({ organization: { canAccess: () => false } }),
  };

  return {
    aliasSurface,
    metadata: project(metadata),
    ownKeys: Object.keys(metadata),
    sectionsOwnKeys: Object.keys(metadata.sections),
    generalItemsOwnKeys: Object.keys(items),
    probes: {
      loopsRepositoryAccess,
      regionPinning: { whenEnabled, whenDisabled, askedFlags },
      environments: environmentsApplicable,
    },
  };
};
