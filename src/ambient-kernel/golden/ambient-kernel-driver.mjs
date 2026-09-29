// Hand-written drive-mode driver for html.CjyPLfH8.js (AMBIENT-KERNEL claim,
// #225 2026-09-29; original code). The boot chunk has NO exports — importing
// it runs its module body, which calls the installer `b()` (pretty L165–167:
// f/t/h/g/l/_/v) and installs the ambient prototype extensions on the live
// globals. This driver imports the entry for that side effect, then sweeps
// the INSTALLED methods over fixed fixtures and returns the projected
// results. The clean module (src/ambient-kernel/ambient-kernel.ts) must
// byte-match through the same projections.
//
// Date-family methods (`b()`'s `t()` call = core.PJIFv7xf.js `fe`) are the
// DATE-KERNEL slice's ground and are deliberately NOT swept here; this
// driver only asserts their install SITE ran (beginningOfWeek present) so
// the two slices tile the row without overlap.
//
// Projections (the serializer accepts only plain values): Map → [key,
// members[]] entry pairs (insertion order IS the behavior); Set → sorted
// array; NaN survives as a tagged number. No functions leak into output.

const A = (a) => a; // identity alias to keep fixture lines readable

export default async ({ entry }) => {
  void entry; // imported for its side effect: the installer already ran.

  const proto = Array.prototype;
  if (typeof proto.distinct !== `function` || typeof String.prototype.toQuestion !== `function`) {
    throw new Error(`ambient installer did not run — the boot chunk's module scope failed`);
  }

  // --- distinct: the ≤15 indexOf-filter vs >15 Set fork, incl. the NaN
  // divergence (indexOf never matches NaN; Set dedupes it) and both sides
  // of the 15/16 boundary.
  const smallDup = [1, 2, 2, 3, 1, `a`, `a`, null, null, undefined, undefined];
  const nanSmall = [NaN, NaN, 1];
  const boundary15 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3]; // length 15 → filter path
  const boundary16 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3]; // length 16 → Set path
  const nanLarge = [NaN, NaN, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 16 → Set dedupes NaN

  // --- groupBy: insertion order, then the sorted-key path.
  const rows = [
    { team: `b`, name: `r1` },
    { team: `a`, name: `r2` },
    { team: `b`, name: `r3` },
    { team: `c`, name: `r4` },
  ];
  const mapEntries = (m) => [...m.entries()];

  // --- orderBy/sortBy: iteratee shorthand + function, multi-key with desc,
  // mixed undefined/null/NaN ordering, stability (equal keys keep index order).
  const people = [
    { n: `d`, v: 2, w: 1 },
    { n: `a`, v: undefined, w: 2 },
    { n: `b`, v: 2, w: 0 },
    { n: `c`, v: null, w: 5 },
    { n: `e`, v: NaN, w: 4 },
    { n: `f`, v: 1, w: 3 },
  ];
  const names = (a) => a.map((p) => p.n);

  // --- raceFind: first-match resolution, default truthy predicate,
  // all-settle-undefined, empty input, rejection propagation.
  const raceFirstMatch = await Promise.raceFind(
    [Promise.resolve(1), Promise.resolve(4), Promise.resolve(6)],
    (v) => v > 3,
  );
  const raceDefaultPredicate = await Promise.raceFind([
    Promise.resolve(0),
    Promise.resolve(``),
    Promise.resolve(`hit`),
  ]);
  const raceNoMatch = await Promise.raceFind([Promise.resolve(1), Promise.resolve(2)], (v) => v > 9);
  const raceEmpty = await Promise.raceFind([]);
  const raceRejection = await Promise.raceFind([Promise.reject(new Error(`boom`))], () => true).then(
    () => `resolved`,
    (e) => `rejected:${e.message}`,
  );

  return {
    distinct: {
      smallDup: A(smallDup.distinct()),
      nanSmall: A(nanSmall.distinct()),
      boundary15: A(boundary15.distinct()),
      boundary16: A(boundary16.distinct()),
      nanLarge: A(nanLarge.distinct()),
    },
    concrete: [1, undefined, null, 0, undefined, ``, false].concrete(),
    groupBy: {
      insertion: mapEntries(rows.groupBy(`team`)),
      sortedKeys: mapEntries(rows.groupBy(`team`, (k) => k)),
    },
    sortBy: {
      shorthand: names(people.sortBy(`v`)),
      fn: names(people.sortBy((p) => p.w)),
    },
    orderBy: {
      single: names(people.orderBy(`v`)),
      multiDesc: names(people.orderBy([`v`, `w`], [`asc`, `desc`])),
      descFirst: names(people.orderBy([`v`], [`desc`])),
    },
    count: [1, 2, 3, 4, 5].count((v, i) => v % 2 === 1 && i < 4),
    at: { native: [10, 20, 30].at(-1), out: [10, 20, 30].at(5), trunc: [10, 20, 30].at(1.9) },
    toReversed: [1, 2, 3].toReversed(),
    string: {
      capitalize: [`hello`, `Hello`, ``, `ärm`].map((s) => s.capitalize()),
      deCapitalize: [`Hello`, `hello`, ``].map((s) => s.deCapitalize()),
      toQuestion: [`run it.`, `run it,`, `run it:`, `run it?`, `run it?.`, `run it..`, `run it`, ``, `?`].map(
        (s) => s.toQuestion(),
      ),
    },
    set: {
      equal: new Set([1, 2]).isEqualTo(new Set([2, 1])),
      unequalSize: new Set([1]).isEqualTo(new Set([1, 2])),
      unequalMembers: new Set([1, 3]).isEqualTo(new Set([1, 2])),
      difference: [...new Set([1, 2, 3]).difference(new Set([2]))].sort(),
    },
    promise: {
      raceFirstMatch,
      raceDefaultPredicate,
      raceNoMatch: raceNoMatch === undefined ? `undefined` : raceNoMatch,
      raceEmpty: raceEmpty === undefined ? `undefined` : raceEmpty,
      raceRejection,
      withResolversShape: typeof Promise.withResolvers === `function`,
    },
    objectHasOwn: Object.hasOwn({ a: 1 }, `a`) && !Object.hasOwn({ a: 1 }, `b`),
    symbolsInstalled: typeof Symbol.dispose === `symbol` && typeof Symbol.asyncDispose === `symbol`,
    dateKernelInstallSiteRan: typeof Date.prototype.beginningOfWeek === `function`,
  };
};
