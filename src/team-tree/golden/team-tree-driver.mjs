// Hand-written drive-mode driver for Issue.DRYymPCa.js (TEAM-TREE claim,
// #225 2026-09-29; original code). Drives the O2 team-picker presentation
// namespace (exported `ar`): sortTeams / sortTeamsForTree / ByDivider /
// ByGroup / labelForTeams / findClosestCommonParent.
//
// Fixture shape: teams carry the fields the kernel reads — id, name, key,
// parent, children, ancestors (ROOT-FIRST, matching the corpus Team getter
// `get ancestors(){let e=[],t=this.parent;for(;t;)e.unshift(t),t=t.parent;
// return e}`), withAncestors = [...ancestors, this]. `children` is
// collection-shaped: `.orderBy(cmp)` delegates to the passed comparator's
// own `orderElements` (the corpus recursion calls `children.orderBy(t)` with
// its Decorators `E` instance — delegating means the REAL comparator sorts,
// nothing is re-implemented fixture-side), plus `.elements`/`.length` so the
// clean module can read the same fixtures as plain lists.
//
// Facts pinned (my 2026-09-29 #295 TEAM-PICKER input):
//   1. Root blocks keep MIN-INPUT-INDEX order; siblings sort by natural-
//      numeric name collation ("Team 2" < "Team 10").
//   2. Missing ancestors are injected for structure, dropped from output,
//      and bump hideAncestors but not indentationLevel.
//   3. `selected` partitions: selected block first, both blocks tree-sorted.
//   4. useIndentation:false is OUT of this golden (see the declared limit
//      at the call site). It delegates to `sortTeams`, a DISTINCT kernel
//      whose order is comparator-ordered at every level — NOT the tree
//      flatten with indentation zeroed. Pinned in the clean-module test.
//   5. ByDivider splits at the first divider row; first row of the second
//      block carries divider:true.
//   6. ByGroup: groups in first-appearance order, tree-sort within.
//   7. labelForTeams: 1 → name; ≤3 → keys ", "-joined; >3 → 3 keys + "+ N"
//      with NO space before the "+" (raw-tree byte fact; pretty is wrong).
//   8. findClosestCommonParent over withAncestors (nearest-first via
//      .reverse()), null when disjoint.
export default async ({ entry }) => {
  const O2 = entry.ar;

  const mkChildren = (arr) => ({
    get length() { return arr.length; },
    get elements() { return arr; },
    orderBy(cmp) {
      const sorted = cmp && typeof cmp.orderElements === `function` ? cmp.orderElements([...arr]) : [...arr];
      const out = Array.isArray(sorted) ? [...sorted] : [...(sorted.elements ?? sorted)];
      // The kernel reads `.elements` off the orderBy result (corpus:
      // `e.orderBy(n).elements.filter(...)`) and also flatMaps the result
      // directly in the sortTeams recursion — expose both shapes.
      out.elements = out;
      return out;
    },
  });
  const mk = (id, name, key, parent) => {
    const t = { id, name, key, parent, kids: [] };
    Object.defineProperty(t, `children`, { get() { return mkChildren(t.kids); } });
    Object.defineProperty(t, `ancestors`, {
      get() { const out = []; let p = t.parent; while (p) { out.unshift(p); p = p.parent; } return out; },
    });
    Object.defineProperty(t, `withAncestors`, { get() { return [...t.ancestors, t]; } });
    return t;
  };

  // The forest: eng (root) > eng-web, eng-api > api-core (grandchild);
  // "Team 10"/"Team 2" naturals; ghost (NOT in input — injected) > ghost-kid.
  const eng = mk(`eng`, `Engineering`, `ENG`);
  const engWeb = mk(`eng-web`, `Web`, `WEB`, eng);
  const engApi = mk(`eng-api`, `API`, `API`, eng);
  const apiCore = mk(`api-core`, `Core`, `CORE`, engApi);
  const t10 = mk(`t10`, `Team 10`, `T10`);
  const t2 = mk(`t2`, `Team 2`, `T2`);
  const ghost = mk(`ghost`, `Ghost`, `GHO`);
  const ghostKid = mk(`ghost-kid`, `Ghost Kid`, `GK`, ghost);
  const lone = mk(`lone`, `aardvark`, `AAR`);
  // Natural-collation siblings: numeric compare puts "Team 2" before
  // "Team 10" (Intl.Collator {numeric:true}); codepoint order would reverse.
  const n10 = mk(`n10`, `Team 10`, `N10`, lone);
  const n2 = mk(`n2`, `Team 2`, `N2`, lone);
  lone.kids.push(n10, n2);
  eng.kids.push(engWeb, engApi);
  engApi.kids.push(apiCore);
  ghost.kids.push(ghostKid);

  const row = (r) => ({
    id: r.team.id,
    lvl: r.indentOptions.indentationLevel,
    hide: r.indentOptions.hideAncestors,
    ...(r.selected === undefined ? {} : { sel: r.selected }),
    ...(r.divider === undefined ? {} : { div: r.divider }),
    ...(r.group === undefined ? {} : { grp: r.group }),
  });

  // Input order: t10 first (root-block anchor), then deep grandchild, roots
  // and children shuffled, ghost-kid orphan (ghost injected), t2 LAST — if
  // root blocks were name-ordered t2 would precede t10.
  const input = [t10, apiCore, eng, engWeb, ghostKid, t2, engApi, lone, n10, n2];

  return {
    tree: O2.sortTeamsForTree(input).map(row),
    // NOTE (declared limit): the useIndentation:false fallback delegates to
    // sortTeams, whose `ua.of(X, …)` store-collection plumbing needs model-
    // class-backed collections a fixture cannot satisfy (probe: "i is not a
    // function" inside the Decorators collection), so it stays non-golden.
    // Its semantics are NOT the tree flatten with indentation zeroed — the
    // raw `!r` branch returns `i(e,n)`, the flat comparator-ordered kernel,
    // which omits the tree path's `t===void 0` root re-sort by input index.
    // Corrected 2026-09-29 (PR #307 review); the divergence is now pinned
    // as a fact in the clean-module test.
    selectedPartition: O2.sortTeamsForTree(input, { selected: (t) => t.id === `eng-web` || t.id === `t2` }).map(row),
    byDivider: O2.sortTeamsForTreeByDivider(
      [
        { team: t10, divider: false },
        { team: eng, divider: false },
        { team: t2, divider: true },
        { team: lone, divider: false },
      ],
    ).map(row),
    byGroup: O2.sortTeamsForTreeByGroup(
      [
        { team: t2, group: `beta` },
        { team: eng, group: `alpha` },
        { team: t10, group: `beta` },
        { team: engWeb, group: `alpha` },
      ],
      { groupBy: (r) => r.group },
    ).map(row),
    labels: {
      one: O2.labelForTeams([eng]),
      three: O2.labelForTeams([eng, t10, t2]),
      five: O2.labelForTeams([eng, t10, t2, lone, apiCore]),
      customMax: O2.labelForTeams([eng, t10, t2, lone], 2),
    },
    closestCommonParent: {
      siblings: O2.findClosestCommonParent([engWeb, engApi])?.id ?? null,
      deep: O2.findClosestCommonParent([apiCore, engWeb])?.id ?? null,
      selfAndChild: O2.findClosestCommonParent([eng, engWeb])?.id ?? null,
      disjoint: O2.findClosestCommonParent([engWeb, t10]) === null ? null : `NOT-NULL`,
      single: O2.findClosestCommonParent([apiCore])?.id ?? null,
    },
  };
};
