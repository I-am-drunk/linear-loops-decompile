/**
 * Golden test (G0 acceptance bar): our clean module's observable behavior,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts), must byte-match the
 * committed corpus-executed golden. Fixtures mirror the golden driver
 * (golden/team-tree-driver.mjs) line-for-line; the driver's collection
 * plumbing is not needed here because the clean module reads plain arrays.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  sortTeams,
  sortTeamsForTree,
  sortTeamsForTreeByDivider,
  sortTeamsForTreeByGroup,
  labelForTeams,
  findClosestCommonParent,
  compareByName,
  type TeamLike,
  type TeamTreeRow,
} from "./team-tree.ts";

const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, `golden`, `team-tree.grid.expected.json`), `utf8`),
) as { provenance: { serializer: string }; output: unknown };

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

interface FixtureTeam extends TeamLike {
  kids: FixtureTeam[];
  children: readonly FixtureTeam[];
}

const mk = (id: string, name: string, key: string, parent?: FixtureTeam): FixtureTeam => {
  const t = {
    id,
    name,
    key,
    parent,
    kids: [] as FixtureTeam[],
    get children(): readonly FixtureTeam[] {
      return this.kids;
    },
  };
  return t;
};

// The golden driver's forest, field-for-field.
const eng = mk(`eng`, `Engineering`, `ENG`);
const engWeb = mk(`eng-web`, `Web`, `WEB`, eng);
const engApi = mk(`eng-api`, `API`, `API`, eng);
const apiCore = mk(`api-core`, `Core`, `CORE`, engApi);
const t10 = mk(`t10`, `Team 10`, `T10`);
const t2 = mk(`t2`, `Team 2`, `T2`);
const ghost = mk(`ghost`, `Ghost`, `GHO`);
const ghostKid = mk(`ghost-kid`, `Ghost Kid`, `GK`, ghost);
const lone = mk(`lone`, `aardvark`, `AAR`);
const n10 = mk(`n10`, `Team 10`, `N10`, lone);
const n2 = mk(`n2`, `Team 2`, `N2`, lone);
// Omitted siblings: present in the parent's `children`, absent from `input`.
// They exercise the `present.has(t.id)` membership filter on both recursive
// paths — under a real parent (`eng`) and under an INJECTED one (`ghost`).
const engOmitted = mk(`eng-omitted`, `Absent`, `ABS`, eng);
const ghostOmitted = mk(`ghost-omitted`, `Absent Kid`, `AGK`, ghost);
eng.kids.push(engWeb, engApi, engOmitted);
engApi.kids.push(apiCore);
ghost.kids.push(ghostKid, ghostOmitted);
lone.kids.push(n10, n2);

const input: TeamLike[] = [t10, apiCore, eng, engWeb, ghostKid, t2, engApi, lone, n10, n2];

const row = (r: TeamTreeRow): Record<string, unknown> => ({
  id: r.team.id,
  lvl: r.indentOptions.indentationLevel,
  hide: r.indentOptions.hideAncestors,
  ...(r.selected === undefined ? {} : { sel: r.selected }),
  ...(r.divider === undefined ? {} : { div: r.divider }),
  ...(r.group === undefined ? {} : { grp: r.group }),
});

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden`, () => {
  const ours = serialize({
    tree: sortTeamsForTree(input).map(row),
    selectedPartition: sortTeamsForTree(input, {
      selected: (t) => t.id === `eng-web` || t.id === `t2`,
    }).map(row),
    byDivider: sortTeamsForTreeByDivider([
      { team: t10, divider: false },
      { team: eng, divider: false },
      { team: t2, divider: true },
      { team: lone, divider: false },
    ]).map(row),
    byGroup: sortTeamsForTreeByGroup(
      [
        { team: t2, group: `beta` },
        { team: eng, group: `alpha` },
        { team: t10, group: `beta` },
        { team: engWeb, group: `alpha` },
      ],
      { groupBy: (r) => r.group as string },
    ).map(row),
    labels: {
      one: labelForTeams([eng]),
      three: labelForTeams([eng, t10, t2]),
      five: labelForTeams([eng, t10, t2, lone, apiCore]),
      customMax: labelForTeams([eng, t10, t2, lone], 2),
    },
    closestCommonParent: {
      siblings: findClosestCommonParent([engWeb, engApi])?.id ?? null,
      deep: findClosestCommonParent([apiCore, engWeb])?.id ?? null,
      selfAndChild: findClosestCommonParent([eng, engWeb])?.id ?? null,
      disjoint: findClosestCommonParent([engWeb, t10]) === null ? null : `NOT-NULL`,
      single: findClosestCommonParent([apiCore])?.id ?? null,
    },
  });
  assert.equal(bytes(ours), bytes(golden.output));
});

test(`natural-numeric sibling collation: "Team 2" precedes "Team 10"`, () => {
  assert.ok(compareByName(n2, n10) < 0);
  const ids = sortTeamsForTree(input).map((r) => r.team.id);
  assert.ok(ids.indexOf(`n2`) < ids.indexOf(`n10`));
});

test(`root blocks keep min-input-index order (t10 before eng before t2 despite names)`, () => {
  const ids = sortTeamsForTree(input).map((r) => r.team.id);
  assert.ok(ids.indexOf(`t10`) < ids.indexOf(`eng`));
  assert.ok(ids.indexOf(`t2`) < ids.indexOf(`lone`));
});

test(`injected ancestors are dropped but bump hideAncestors (ghost-kid at level 0, hide 0)`, () => {
  const rows = sortTeamsForTree(input);
  assert.equal(rows.some((r) => r.team.id === `ghost`), false);
  const gk = rows.find((r) => r.team.id === `ghost-kid`)!;
  assert.deepEqual(gk.indentOptions, { indentationLevel: 0, hideAncestors: 0 });
});

test(`useIndentation:false delegates to sortTeams: NAME order, not tree order (declared non-golden leg)`, () => {
  // The corpus fallback is `if(!r)return i(e,n).map(…)` — it delegates to the
  // flat kernel, which orders every level by the comparator. The tree path's
  // root re-sort by min input index does not apply. Order below is natural:
  // aardvark (+ its Team 2 / Team 10 children) < Engineering <
  // Ghost(injected slot) < Team 2 < Team 10.
  const flat = sortTeamsForTree(input, { useIndentation: false });
  assert.deepEqual(flat.map((r) => r.team.id), [
    `lone`,
    `n2`,
    `n10`,
    `eng`,
    `eng-api`,
    `api-core`,
    `eng-web`,
    `ghost-kid`,
    `t2`,
    `t10`,
  ]);
  assert.ok(flat.every((r) => r.indentOptions.indentationLevel === 0 && r.indentOptions.hideAncestors === 0));
});

test(`the flat and tree kernels DIVERGE — the tree path's root re-sort is real`, () => {
  // Pinned as a fact per the probe-graduation rule: an earlier revision
  // derived the flat leg from the tree pass, assuming one recursion. Two
  // independent corpus re-reads showed the root re-sort exists only on the
  // tree path, so the two orders differ on this input.
  assert.notDeepEqual(
    sortTeamsForTree(input, { useIndentation: false }).map((r) => r.team.id),
    sortTeamsForTree(input).map((r) => r.team.id),
  );
});

test(`sortTeams is the flat leg's order source`, () => {
  assert.deepEqual(
    sortTeams(input).map((t) => t.id),
    sortTeamsForTree(input, { useIndentation: false }).map((r) => r.team.id),
  );
});

test(`omitted siblings never surface — under a real parent AND an injected one`, () => {
  // CodeRabbit finding on PR #307: no fixture had a child absent from the
  // input, so the membership filter was untested on either recursive path.
  for (const ids of [
    sortTeamsForTree(input).map((r) => r.team.id),
    sortTeams(input).map((t) => t.id),
  ]) {
    assert.equal(ids.includes(`eng-omitted`), false);
    assert.equal(ids.includes(`ghost-omitted`), false);
  }
});

test(`labelForTeams overflow suffix has NO space before the plus (raw-tree byte fact)`, () => {
  assert.equal(labelForTeams([eng, t10, t2, lone, apiCore]), `ENG, T10, T2+ 2`);
});
