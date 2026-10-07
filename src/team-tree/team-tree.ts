/**
 * Team-picker tree kernel — clean reimplementation of the O2 presentation
 * namespace from the corpus chunk `Issue.DRYymPCa.js` (the IIFE ending
 * `})(O2||={})`, exported `ar`; raw sites `e.sortTeams=i`,
 * `e.sortTeamsForTree=a`, `e.sortTeamsForTreeByDivider=o`,
 * `e.sortTeamsForTreeByGroup=s`, `e.labelForTeams=c`,
 * `e.findClosestCommonParent=u`). Original code; behavior verified
 * byte-for-byte against the committed corpus-executed golden
 * (`golden/team-tree.grid.expected.json`) — see `corpus-manifest.json`.
 *
 * Why this kernel is load-bearing (my #295 TEAM-PICKER input, 2026-09-29):
 * every loops team picker renders through it — AutomationPage L524 (Save-to),
 * AutomationHistoryDialog L2709/L4159 (editor Select-teams), LoopsManagementPage
 * L465 (team filter), LoopTemplateLibrary L283 (ByDivider), UsageAppliedFilterPills
 * L229, and the ContextualMenuActions move/assign flows (ByDivider/ByGroup +
 * findClosestCommonParent). Its ordering is DIFFERENT from the settled flat
 * `sortByUserSortOrder` kernel (00:54:08Z): root blocks keep MIN-INPUT-INDEX
 * order while siblings sort by natural-numeric NAME collation.
 *
 * Value facts pinned by the golden:
 *   - Sibling comparator = Intl.Collator(undefined, {numeric:true}) natural
 *     compare over `name`, null/undefined LAST ("Team 2" < "Team 10").
 *   - Root blocks ordered by minimum input index of any member (climbing
 *     `parent` within the input+injected id set), NOT by name.
 *   - Missing ancestors are injected for structure, dropped from output;
 *     an injected parent bumps `hideAncestors` (to the row's indentation
 *     level) but the level itself subtracts the injected depth.
 *   - `selected` partition: selected block first, both blocks tree-sorted
 *     independently, `selected` spread onto every row.
 *   - ByDivider: split at the first divider row, tree-sort each block, the
 *     second block's first row carries `divider: true`.
 *   - ByGroup: groups in first-appearance order, tree-sort within each.
 *   - labelForTeams: 1 → name; ≤max (default 3) → keys ", "-joined;
 *     >max → first max keys + `+ N` with NO space before the `+`
 *     (raw-tree byte fact — the pretty projection corrupts this literal).
 *   - findClosestCommonParent: nearest-first walk over withAncestors
 *     (= [...root-first ancestors, self]); null when disjoint.
 *
 * THREE ordering kernels, not two (corrected 2026-09-29 by the review on
 * PR #307, confirmed independently twice at the raw site):
 *   - `sortTeams` (corpus `i`): the FLAT comparator-ordered flatten. Ordered
 *     by the comparator at EVERY level, roots included.
 *   - `sortTeamsForTree` (corpus `a`): the tree flatten. Identical EXCEPT
 *     that roots are re-sorted by minimum input index
 *     (`t===void 0&&a.sort((e,t)=>(d.get(e.id)??1/0)-…)`), which exists only
 *     on this path.
 *   - `sortTeamsForTree({useIndentation:false})`: delegates to `sortTeams`
 *     (`if(!r)return i(e,n).map(…indentationLevel:0,hideAncestors:0)`) — so
 *     it inherits the FLAT order, NOT the tree order.
 *
 * The tree flatten therefore does not degenerate into the flat one: given a
 * single input whose name order and input order disagree, the two produce
 * different sequences. An earlier revision of this module derived the
 * `useIndentation:false` leg from the tree pass on the stated assumption
 * that they shared a recursion; they do not, and the module test now pins
 * the divergence as a fact rather than asserting the equality.
 *
 * Declared limit: the corpus fallback reads store collections
 * (`ua.of(X, …)`) that fixtures cannot satisfy, so the flat leg is pinned in
 * the module test, not in the golden. The `orderBy` option override is
 * likewise exercised only with the default comparator here.
 */

/** The team shape this kernel reads. `ancestors` is ROOT-FIRST, matching
 * the corpus Team getter (`for(;t;)e.unshift(t)`); `withAncestors` is
 * `[...ancestors, this]`. */
export interface TeamLike {
  id: string;
  name: string;
  key: string;
  parent?: TeamLike | undefined;
  children: readonly TeamLike[];
}

export interface IndentOptions {
  indentationLevel: number;
  hideAncestors: number;
}

export interface TeamTreeRow {
  team: TeamLike;
  indentOptions: IndentOptions;
  selected?: boolean;
  divider?: boolean;
  group?: unknown;
}

export interface SortTeamsForTreeOptions {
  useIndentation?: boolean | undefined;
  selected?: ((team: TeamLike) => boolean) | undefined;
}

const collator = new Intl.Collator(undefined, { numeric: true });

/** The Decorators `et` comparator semantics this kernel rides, specialized
 * to the default `new E(`name`)` ascending single-field case: string×string
 * through the numeric natural collator, null/undefined LAST, otherwise
 * numeric subtraction (corpus `Be`). */
export function compareByName(a: TeamLike, b: TeamLike): number {
  const x: unknown = a.name;
  const y: unknown = b.name;
  if (x === y) return 0;
  if (x == null) return y == null ? 0 : 1;
  if (y == null) return -1;
  if (typeof x === `string` && typeof y === `string`) return collator.compare(x, y);
  return (x as number) - (y as number);
}

const ancestorsOf = (team: TeamLike): TeamLike[] => {
  const out: TeamLike[] = [];
  let p = team.parent;
  while (p) {
    out.unshift(p);
    p = p.parent;
  }
  return out;
};

/**
 * `sortTeams` (corpus `i`): the FLAT comparator-ordered flatten.
 *
 * Missing ancestors are injected so a child reaches its structural slot, the
 * comparator orders every level including the roots, and injected ancestors
 * are dropped from the output (`.filter(e=>!r.has(e))`) after ordering their
 * subtree at their own name's sibling slot.
 *
 * The one thing this does NOT do is the tree path's root re-sort by minimum
 * input index — that sort is guarded by `t===void 0` inside `sortTeamsForTree`
 * and has no counterpart here. This is the whole difference between the two
 * kernels, and it is why `useIndentation:false` delegates here rather than
 * reusing the tree pass.
 */
export function sortTeams(
  teams: readonly TeamLike[],
  options?: { orderBy?: ((a: TeamLike, b: TeamLike) => number) | undefined },
): TeamLike[] {
  if (teams.length === 0) return [];
  const compare = options?.orderBy ?? compareByName;

  const present = new Set(teams.map((t) => t.id));
  const injected = new Set<TeamLike>();
  for (const t of teams) {
    for (const a of ancestorsOf(t)) {
      if (!present.has(a.id)) {
        injected.add(a);
        present.add(a.id);
      }
    }
  }

  const all: TeamLike[] = [...teams, ...injected];

  const walk = (pool: readonly TeamLike[], parent: TeamLike | undefined): TeamLike[] => {
    if (pool.length === 0) return [];
    const siblings = [...pool]
      .sort(compare)
      .filter((t) => t.parent === parent && present.has(t.id));
    return siblings.flatMap((t) => [t, ...walk(t.children, t)]);
  };

  // Injected ancestors order their subtree at their own slot, then drop out.
  return walk(all, undefined).filter((t) => !injected.has(t));
}

/**
 * `sortTeamsForTree` (corpus `a`): the ancestor-grouped tree flatten with
 * indentation accounting. See the module header for the pinned semantics.
 */
export function sortTeamsForTree(
  teams: readonly TeamLike[],
  options?: SortTeamsForTreeOptions,
): TeamTreeRow[] {
  const { useIndentation = true, selected } = options ?? {};

  if (selected) {
    const chosen: TeamLike[] = [];
    const rest: TeamLike[] = [];
    for (const t of teams) (selected(t) ? chosen : rest).push(t);
    const sub: SortTeamsForTreeOptions = { useIndentation };
    return [
      ...sortTeamsForTree(chosen, sub).map((r) => ({ ...r, selected: true })),
      ...sortTeamsForTree(rest, sub).map((r) => ({ ...r, selected: false })),
    ];
  }

  if (!useIndentation) {
    // Corpus fallback (`if(!r)return i(e,n).map(…)`): delegate to the FLAT
    // kernel, then zero the indentation. Not derivable from the tree pass —
    // the tree path re-sorts roots by input index and this one does not.
    return sortTeams(teams).map((team) => ({
      team,
      indentOptions: { indentationLevel: 0, hideAncestors: 0 },
    }));
  }

  if (teams.length === 0) return [];

  // Input index per team id.
  const inputIndex = new Map<string, number>();
  for (let i = 0; i < teams.length; i++) inputIndex.set(teams[i]!.id, i);

  // Inject missing ancestors (structure-only).
  const present = new Set(teams.map((t) => t.id));
  const injected = new Set<TeamLike>();
  for (const t of teams) {
    for (const a of ancestorsOf(t)) {
      if (!present.has(a.id)) {
        injected.add(a);
        present.add(a.id);
      }
    }
  }

  // Root resolution: climb `parent` while the parent is in the present set.
  const rootOf = (team: TeamLike): TeamLike => {
    let t = team;
    while (t.parent && present.has(t.parent.id)) t = t.parent;
    return t;
  };

  // Min input index per root id (only REAL input teams vote).
  const rootMinIndex = new Map<string, number>();
  for (const t of teams) {
    const root = rootOf(t);
    const idx = inputIndex.get(t.id)!;
    const cur = rootMinIndex.get(root.id);
    if (cur === undefined || idx < cur) rootMinIndex.set(root.id, idx);
  }

  const all: TeamLike[] = [...teams, ...injected];

  const walk = (
    pool: readonly TeamLike[],
    parent: TeamLike | undefined,
    depth: number,
    injectedDepth: number,
  ): TeamTreeRow[] => {
    if (pool.length === 0) return [];
    const siblings = [...pool]
      .sort(compareByName)
      .filter((t) => t.parent === parent && present.has(t.id));
    if (parent === undefined) {
      siblings.sort(
        (a, b) => (rootMinIndex.get(a.id) ?? Infinity) - (rootMinIndex.get(b.id) ?? Infinity),
      );
    }
    return siblings.flatMap((t) => {
      if (injected.has(t)) return walk(t.children, t, depth + 1, injectedDepth + 1);
      const level = depth - injectedDepth;
      return [
        {
          team: t,
          indentOptions: {
            indentationLevel: level,
            hideAncestors: parent !== undefined && injected.has(parent) ? level : depth,
          },
        },
        ...walk(t.children, t, depth + 1, injectedDepth),
      ];
    });
  };

  return walk(all, undefined, 0, 0);
}

export interface DividerRow {
  team: TeamLike;
  divider: boolean;
}

/** `sortTeamsForTreeByDivider` (corpus `o`): split at the first divider
 * row, tree-sort each block, re-mark the second block's first row. */
export function sortTeamsForTreeByDivider(
  rows: readonly DividerRow[],
  options?: SortTeamsForTreeOptions,
): TeamTreeRow[] {
  const cut = rows.findIndex((r) => r.divider);
  const first = (cut >= 0 ? rows.slice(0, cut) : rows).map((r) => r.team);
  const second = (cut >= 0 ? rows.slice(cut) : []).map((r) => r.team);
  return [
    ...sortTeamsForTree(first, options).map((r) => ({ ...r, divider: false })),
    ...sortTeamsForTree(second, options).map((r, i) => ({ ...r, divider: i === 0 })),
  ];
}

export interface GroupedRow<G> {
  team: TeamLike;
  group?: G;
}

export interface SortTeamsForTreeByGroupOptions<G> extends SortTeamsForTreeOptions {
  groupBy: (row: GroupedRow<G>) => G;
}

/** `sortTeamsForTreeByGroup` (corpus `s`): groups in first-appearance
 * order, tree-sort within each, `group` spread onto rows. */
export function sortTeamsForTreeByGroup<G>(
  rows: readonly GroupedRow<G>[],
  options: SortTeamsForTreeByGroupOptions<G>,
): TeamTreeRow[] {
  const buckets = new Map<G, TeamLike[]>();
  const order: G[] = [];
  for (const r of rows) {
    const g = options.groupBy(r);
    const bucket = buckets.get(g);
    if (bucket) bucket.push(r.team);
    else {
      buckets.set(g, [r.team]);
      order.push(g);
    }
  }
  const { useIndentation, selected } = options;
  return order.flatMap((g) =>
    sortTeamsForTree(buckets.get(g)!, { useIndentation, selected }).map((r) => ({
      ...r,
      group: g,
    })),
  );
}

/** `labelForTeams` (corpus `c`): 1 → name; ≤max → keys ", "-joined; >max →
 * first max keys + `+ N` (raw-exact: NO space before the `+`). */
export function labelForTeams(teams: readonly TeamLike[], max = 3): string {
  if (teams.length === 1) return teams[0]!.name;
  if (teams.length <= max) return teams.map((t) => t.key).join(`, `);
  return teams.slice(0, max).map((t) => t.key).join(`, `) + `+ ${teams.length - max}`;
}

/** `findClosestCommonParent` (corpus `u`): per team, nearest-first walk
 * over `withAncestors` (self included) to the first node already seen (the
 * first team's own self starts the walk, `n.size===0`); the running result
 * is REPLACED only when the hit is a strict ancestor of it (corpus `d` —
 * i.e. the result climbs upward as needed, never downward); null when any
 * team shares no node with the accumulated set. */
export function findClosestCommonParent(teams: readonly TeamLike[]): TeamLike | null {
  const isAbove = (candidate: TeamLike, below: TeamLike): boolean => {
    let p = below.parent;
    while (p) {
      if (p === candidate) return true;
      p = p.parent;
    }
    return false;
  };
  let result: TeamLike | null = null;
  const seen = new Set<TeamLike>();
  for (const team of teams) {
    const withAncestors = [...ancestorsOf(team), team];
    let found = false;
    for (const node of [...withAncestors].reverse()) {
      if (seen.has(node) || seen.size === 0) {
        found = true;
        if (!result || isAbove(node, result)) result = node;
        break;
      }
    }
    if (!found) return null;
    withAncestors.forEach((n) => seen.add(n));
  }
  return result;
}
