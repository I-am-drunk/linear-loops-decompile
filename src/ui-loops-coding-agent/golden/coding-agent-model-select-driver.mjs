// Hand-written drive-mode driver for CodingAgentModelSelect.USYHzowP.js (G12;
// original code). The chunk's export map is `export { y as n, g as r, b as t }`:
//   entry.r — repo helper class `g` (static-only: isAvailable/hostName/
//             fullName/label). This driver drives the three PURE statics on
//             plain fixture repos; `isAvailable` (a store/integration-graph
//             predicate behind the stubbed PullRequestsFeatureHelper) is
//             declared OUT of this golden's scope.
//   entry.n — settings helper class `y` (static-only): sandboxSizes,
//             harnesses, descriptions, label(), autoPreference() incl. its
//             throw, icon() (projected to stub identity), and
//             modelDescription()'s DEFAULT branch. The non-ZDR branch renders
//             prose through the stubbed ExternalLink and needs the
//             CodingAgentPreferencesHelper class from the stubbed Issue
//             chunk — declared OUT of scope (it stays on the ledger as an
//             unpinned region of this chunk).
//   entry.t — the mobx-observer Select component: render-tier, NOT driven.
//
// Elements produced by `icon()` are host-level facts only through their TYPE
// (the icon component identity); this driver projects each to the stub's
// declared displayName plus the props payload, which pins the real corpus
// fact (harness -> icon import mapping) in serializable form.
const projectIcon = (el) => {
  if (el === null) return null;
  return {
    type: typeof el.type === `function` ? (el.type.displayName ?? el.type.name) : String(el.type),
    props: el.props,
  };
};

export default async ({ entry }) => {
  const Repo = entry.r;
  const Helper = entry.n;

  let autoPreferenceThrow = null;
  try {
    Helper.autoPreference(`not-a-harness`);
  } catch (e) {
    autoPreferenceThrow = e.message;
  }

  return {
    repo: {
      // hostName lowercases the URL host; fullName joins owner/name;
      // label appends ` (host)` ONLY off github.com — both branches pinned.
      hostName: Repo.hostName({ baseUrl: `https://GitHub.COM/linear/linear` }),
      fullName: Repo.fullName({ owner: `linear`, name: `linear` }),
      labelGithub: Repo.label({ owner: `linear`, name: `linear`, baseUrl: `https://github.com/linear/linear` }),
      labelOtherHost: Repo.label({ owner: `acme`, name: `app`, baseUrl: `https://Git.Acme.dev/acme/app` }),
    },
    helper: {
      sandboxSizes: Helper.sandboxSizes,
      harnesses: Helper.harnesses,
      descriptions: Helper.descriptions,
      labels: {
        claude: Helper.label(`claude`),
        codex: Helper.label(`codex`),
        openSource: Helper.label(`open-source`),
        passthroughDefault: Helper.label(`some-future-harness`),
      },
      autoPreference: {
        claude: Helper.autoPreference(`claude`),
        codex: Helper.autoPreference(`codex`),
        openSource: Helper.autoPreference(`open-source`),
        throwMessage: autoPreferenceThrow,
      },
      icons: {
        claude: projectIcon(Helper.icon(`claude`)),
        codex: projectIcon(Helper.icon(`codex`)),
        openSource: projectIcon(Helper.icon(`open-source`)),
        passthroughDefault: Helper.icon(`literal-passthrough`),
      },
      modelDescriptionDefault: Helper.modelDescription(undefined, `team`),
    },
  };
};
