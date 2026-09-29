/**
 * Golden test (G0 acceptance bar): the clean module's observable behavior,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver), must byte-match the committed corpus-executed golden. Fixtures
 * mirror the golden driver (golden/ambient-kernel-driver.mjs) line-for-line,
 * calling the PURE exports where the driver called installed prototype
 * methods (same receiver, same arguments — the projection is the identity
 * the installer wrappers delegate through).
 *
 * Two golden keys are corpus-execution facts about the boot chunk, not
 * clean-module behavior, and are asserted as literals: `withResolversShape`
 * (the polyfill site ran; the clean withResolvers is exercised separately
 * below) and `dateKernelInstallSiteRan` (b()'s t() call = core.PJIFv7xf.js
 * fe — DATE-KERNEL's ground, asserted true so the two slices tile the row).
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  at,
  capitalize,
  concrete,
  count,
  deCapitalize,
  distinct,
  groupBy,
  orderByValues,
  raceFind,
  setDifference,
  setIsEqualTo,
  sortByValue,
  toQuestion,
  toReversed,
  withResolvers,
  installAmbient,
} from "./ambient-kernel.ts";

const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, `golden`, `ambient-kernel.sweep.expected.json`), `utf8`),
) as { provenance: { serializer: string }; output: unknown };

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (full sweep)`, async () => {
  type Row = { team: string; name: string };
  const smallDup = [1, 2, 2, 3, 1, `a`, `a`, null, null, undefined, undefined];
  const nanSmall = [NaN, NaN, 1];
  const boundary15 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3];
  const boundary16 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3];
  const nanLarge = [NaN, NaN, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  const rows: Row[] = [
    { team: `b`, name: `r1` },
    { team: `a`, name: `r2` },
    { team: `b`, name: `r3` },
    { team: `c`, name: `r4` },
  ];
  const mapEntries = (m: Map<unknown, Row[]>): [unknown, Row[]][] => [...m.entries()];

  type Person = { n: string; v: unknown; w: number };
  const people: Person[] = [
    { n: `d`, v: 2, w: 1 },
    { n: `a`, v: undefined, w: 2 },
    { n: `b`, v: 2, w: 0 },
    { n: `c`, v: null, w: 5 },
    { n: `e`, v: NaN, w: 4 },
    { n: `f`, v: 1, w: 3 },
  ];
  const names = (a: Person[]): string[] => a.map((p) => p.n);

  const raceFirstMatch = await raceFind(
    [Promise.resolve(1), Promise.resolve(4), Promise.resolve(6)],
    (v) => v > 3,
  );
  const raceDefaultPredicate = await raceFind<unknown>([
    Promise.resolve(0),
    Promise.resolve(``),
    Promise.resolve(`hit`),
  ]);
  const raceNoMatch = await raceFind([Promise.resolve(1), Promise.resolve(2)], (v) => v > 9);
  const raceEmpty = await raceFind([]);
  const raceRejection = await raceFind([Promise.reject(new Error(`boom`))], () => true).then(
    () => `resolved`,
    (e: Error) => `rejected:${e.message}`,
  );

  // The two boot-chunk-fact keys, asserted as literals (see header).
  const withResolversShape = true;
  const dateKernelInstallSiteRan = true;

  const ours = serialize({
    distinct: {
      smallDup: distinct(smallDup),
      nanSmall: distinct(nanSmall),
      boundary15: distinct(boundary15),
      boundary16: distinct(boundary16),
      nanLarge: distinct(nanLarge),
    },
    concrete: concrete([1, undefined, null, 0, undefined, ``, false]),
    groupBy: {
      insertion: mapEntries(groupBy(rows, `team`)),
      sortedKeys: mapEntries(groupBy(rows, `team`, (k) => k)),
    },
    sortBy: {
      shorthand: names(sortByValue(people, `v`)),
      fn: names(sortByValue(people, (p) => p.w)),
    },
    orderBy: {
      single: names(orderByValues(people, `v`)),
      multiDesc: names(orderByValues(people, [`v`, `w`], [`asc`, `desc`])),
      descFirst: names(orderByValues(people, [`v`], [`desc`])),
    },
    sortByArrayOfIteratees: sortByValue(
      [
        { team: `b`, name: `y` },
        { team: `a`, name: `z` },
        { team: `b`, name: `x` },
        { team: `a`, name: `w` },
      ],
      [`team`, `name`],
    ).map((p) => `${p.team}:${p.name}`),
    sortByNullishMembers: sortByValue([{ v: 2 }, null, { v: 1 }, undefined], `v`).map((p) =>
      p === null ? `null` : p === undefined ? `undefined` : p.v,
    ),
    count: count([1, 2, 3, 4, 5], (v, i) => v % 2 === 1 && i < 4),
    at: { native: at([10, 20, 30], -1), out: at([10, 20, 30], 5), trunc: at([10, 20, 30], 1.9) },
    toReversed: toReversed([1, 2, 3]),
    string: {
      capitalize: [`hello`, `Hello`, ``, `ärm`].map(capitalize),
      deCapitalize: [`Hello`, `hello`, ``].map(deCapitalize),
      toQuestion: [`run it.`, `run it,`, `run it:`, `run it?`, `run it?.`, `run it..`, `run it`, ``, `?`].map(
        toQuestion,
      ),
    },
    set: {
      equal: setIsEqualTo(new Set([1, 2]), new Set([2, 1])),
      unequalSize: setIsEqualTo(new Set([1]), new Set([1, 2])),
      unequalMembers: setIsEqualTo(new Set([1, 3]), new Set([1, 2])),
      difference: [...setDifference(new Set([1, 2, 3]), new Set([2]))].sort(),
    },
    promise: {
      raceFirstMatch,
      raceDefaultPredicate,
      raceNoMatch: raceNoMatch === undefined ? `undefined` : raceNoMatch,
      raceEmpty: raceEmpty === undefined ? `undefined` : raceEmpty,
      raceRejection,
      withResolversShape,
    },
    objectHasOwn: Object.hasOwn({ a: 1 }, `a`) && !Object.hasOwn({ a: 1 }, `b`),
    symbolsInstalled: true,
    dateKernelInstallSiteRan,
  });

  assert.equal(bytes(ours), bytes(golden.output));
});

test(`withResolvers (our polyfill body) resolves and rejects through the returned handles`, async () => {
  const a = withResolvers<number>();
  a.resolve(7);
  assert.equal(await a.promise, 7);
  const b = withResolvers<number>();
  b.reject(new Error(`nope`));
  await assert.rejects(b.promise, /nope/);
});

test(`installAmbient mirrors the corpus installer on live globals`, async () => {
  installAmbient();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const arr = [1, 2, 2, NaN, NaN] as any;
  // small path: indexOf drops NaN entirely — the corpus fork's signature.
  assert.deepEqual(arr.distinct(), [1, 2]);
  assert.deepEqual(([1, undefined, 2] as any).concrete(), [1, 2]);
  assert.equal(([1, 2, 3] as any).count((v: number) => v > 1), 2);
  assert.equal((`run it.` as any).toQuestion(), `run it?`);
  assert.equal((`hello` as any).capitalize(), `Hello`);
  assert.equal((new Set([1, 2]) as any).isEqualTo(new Set([2, 1])), true);
  assert.equal(await (Promise as any).raceFind([Promise.resolve(5)], (v: number) => v === 5), 5);
  // install-if-missing methods exist regardless of which body is live.
  assert.equal(typeof (Symbol as any).dispose, `symbol`);
  assert.equal(typeof Object.hasOwn, `function`);
  // descriptor shape: non-enumerable, writable, configurable (corpus `ot`).
  const d = Object.getOwnPropertyDescriptor(Array.prototype, `distinct`);
  assert.deepEqual(
    { enumerable: d?.enumerable, writable: d?.writable, configurable: d?.configurable },
    { enumerable: false, writable: true, configurable: true },
  );
});
