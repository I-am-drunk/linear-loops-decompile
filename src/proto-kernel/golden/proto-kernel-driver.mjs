// Hand-written drive-mode driver for html.CjyPLfH8.js (PROTO-KERNEL claim,
// #225 2026-09-29; original code). The boot chunk exports nothing: its value
// IS its module-scope effect — `b()` installs the ambient prototype library
// onto the real globals. This driver therefore runs AFTER the entry import
// and drives the INSTALLED prototypes over a value grid, so the recorded
// outputs are computed by the corpus's own installed implementations.
//
// Scope = the UNCONDITIONAL half-1 installs plus `raceFind` (never native,
// so its conditional install always fires): Array `distinct`/`concrete`/
// `groupBy`/`orderBy`/`sortBy`/`count`, String `capitalize`/`deCapitalize`/
// `toQuestion`, Set `isEqualTo`, Promise.raceFind. The conditional group
// (`at`, `toReversed`, `Set.difference`, `withResolvers`, `hasOwn`, the
// dispose Symbols) is deliberately NOT golden-driven: on a modern Node target
// the corpus skips those installs, so a golden would pin the NATIVE method
// (the #300 review's caveat). Our module's unit tests cover those polyfills
// directly instead.
//
// Projections (serializer grammar has no Map/Symbol/Promise):
//   - groupBy Maps -> arrays of [key, bucket] entries (Map order preserved);
//   - raceFind promises are awaited; a rejection is projected to its message.
export default async () => {
  const grid = {};

  // --- distinct: the <=15 indexOf fork vs the Set branch -------------------
  grid.distinct = {
    // short branch (indexOf filter)
    short: [1, 2, 1, 3, 2].distinct(),
    // indexOf never finds NaN, so the short branch DROPS every NaN
    shortNaN: [NaN, 1, NaN, 2].distinct(),
    // 0 and -0: indexOf uses strict-ish equality where 0 === -0
    shortZero: [0, -0, 1].distinct(),
    // exactly 15 elements: still the short branch
    atBoundary15: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8].distinct(),
    // 16 elements: the Set branch (SameValueZero) — keeps ONE NaN
    setBranch16: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, NaN, NaN].distinct(),
  };

  // --- concrete: drops undefined only, keeps null/0/'' ---------------------
  grid.concrete = [1, undefined, null, 0, ``, undefined, false].concrete();

  // --- groupBy: Map semantics, first-seen key order; 2-arg sorted re-map ---
  const rows = [
    { team: `b`, n: 1 },
    { team: `a`, n: 2 },
    { team: `b`, n: 3 },
    { team: `c`, n: 4 },
    { team: `a`, n: 5 },
  ];
  grid.groupBy = {
    oneArg: [...rows.groupBy(`team`).entries()],
    sortedKeys: [...rows.groupBy(`team`, (k) => k).entries()],
    missingKeyBucket: [...[{ x: 1 }, { team: `a`, x: 2 }].groupBy(`team`).entries()],
  };

  // --- sortBy / orderBy: lodash iteratee + compareAscending + stable ties --
  const people = [
    { name: `dan`, age: 30 },
    { name: `amy`, age: 25 },
    { name: `bob`, age: 30 },
    { name: `cat`, age: undefined },
  ];
  grid.sortBy = {
    stringKey: people.sortBy(`age`).map((p) => p.name),
    fn: people.sortBy((p) => p.name).map((p) => p.name),
    // cross-type ordering: undefined last, null before undefined, NaN after null
    crossType: [3, undefined, 1, null, NaN, 2].sortBy((v) => v),
    // stability: equal criteria keep input order (dan before bob at age 30)
    stableTie: people.sortBy(`age`).map((p) => p.name),
  };
  grid.orderBy = {
    singleDesc: people.orderBy(`age`, `desc`).map((p) => p.name),
    multiKey: [
      { a: 1, b: 2 },
      { a: 1, b: 1 },
      { a: 0, b: 9 },
    ].orderBy([`a`, `b`], [`asc`, `desc`]),
    // orders shorter than iteratees: unflipped ascending beyond the list
    ordersShorter: [
      { a: 1, b: 1 },
      { a: 1, b: 2 },
      { a: 0, b: 5 },
    ].orderBy([`a`, `b`], [`desc`]),
    noArgs: [3, 1, 2].orderBy(),
  };

  // --- count ---------------------------------------------------------------
  grid.count = {
    basic: [1, 2, 3, 4, 5].count((n) => n % 2 === 0),
    withIndex: [`a`, `b`, `c`].count((_, i) => i > 0),
    empty: [].count(() => true),
  };

  // --- String trio ---------------------------------------------------------
  grid.string = {
    capitalize: [`hello`, ``, `a`, `HELLO`].map((s) => s.capitalize()),
    deCapitalize: [`Hello`, ``, `A`, `hello`].map((s) => s.deCapitalize()),
    toQuestion: [
      `hello`, // plain append
      `hello?`, // already a question
      `hello.`, // strip one trailing dot
      `hello..`, // only ONE strip: first dot survives
      `hello,`, // comma strip
      `hello:`, // colon strip
      `hello;`, // semicolon NOT in the strip set
      `what?.`, // strip dot, then ends with ? -> no append
      ``, // empty: lastIndexOf(`?`) is -1 AND length-1 is -1 -> equal -> NO append
      `?`, // lone question mark
    ].map((s) => s.toQuestion()),
  };

  // --- Set.isEqualTo -------------------------------------------------------
  grid.isEqualTo = {
    equal: new Set([1, 2, 3]).isEqualTo(new Set([3, 2, 1])),
    differentSize: new Set([1, 2]).isEqualTo(new Set([1, 2, 3])),
    sameSizeDifferentMembers: new Set([1, 2, 3]).isEqualTo(new Set([1, 2, 4])),
    bothEmpty: new Set().isEqualTo(new Set()),
  };

  // --- Promise.raceFind (always installed: never native) -------------------
  grid.raceFind = {
    firstPassing: await Promise.raceFind([Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)], (v) => v > 1),
    defaultPredicateTruthy: await Promise.raceFind([Promise.resolve(0), Promise.resolve(``), Promise.resolve(7)]),
    nonePass: await Promise.raceFind([Promise.resolve(1), Promise.resolve(2)], (v) => v > 10),
    emptyArray: await Promise.raceFind([]),
    plainValuesAccepted: await Promise.raceFind([4, 5], (v) => v === 5),
    rejectionPropagates: await Promise.raceFind([Promise.reject(new Error(`boom`)), Promise.resolve(1)], (v) => v > 100)
      .then((v) => ({ resolved: v }))
      .catch((e) => ({ rejectedWith: e instanceof Error ? e.message : String(e) })),
  };

  return grid;
};
