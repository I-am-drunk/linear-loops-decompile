/**
 * Golden test (G0 acceptance bar): our clean module's observable behavior,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts), must byte-match the
 * committed corpus-executed golden. The grid mirrors the golden driver
 * (golden/proto-kernel-driver.mjs) line-for-line, driving our exported
 * implementations instead of the corpus-installed prototypes.
 *
 * The conditional polyfills (`at`/`toReversed`/`Set.difference`/
 * `withResolvers`/`hasOwn`/dispose Symbols) are NOT in the golden (they would
 * pin natives on modern targets — #300 review caveat); their semantics are
 * unit-tested directly against our polyfill implementations below.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { impl, installProtoExtensions, compareAscending } from "./proto-kernel.ts";

const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, `golden`, `proto-kernel.grid.expected.json`), `utf8`),
) as { provenance: { serializer: string }; output: unknown };

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

// Convenience wrappers: call the this-bound impls like methods.
const distinct = (a: unknown[]) => impl.distinct.call(a);
const concrete = (a: unknown[]) => impl.concrete.call(a);
const groupBy = (a: unknown[], k: string, s?: (v: unknown) => unknown) => impl.groupBy.call(a, k, s);
const sortBy = (a: unknown[], it?: Parameters<typeof impl.sortBy>[0]) => impl.sortBy.call(a, it);
const orderBy = (a: unknown[], it?: Parameters<typeof impl.orderBy>[0], o?: string | string[]) =>
  impl.orderBy.call(a, it, o);
const count = (a: unknown[], p: (e: unknown, i: number, arr: unknown[]) => unknown) => impl.count.call(a, p);
const cap = (s: string) => impl.capitalize.call(s);
const decap = (s: string) => impl.deCapitalize.call(s);
const toQuestion = (s: string) => impl.toQuestion.call(s);
const isEqualTo = (a: Set<unknown>, b: Set<unknown>) => impl.isEqualTo.call(a, b);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (full grid)`, async () => {
  const grid: Record<string, unknown> = {};

  grid.distinct = {
    short: distinct([1, 2, 1, 3, 2]),
    shortNaN: distinct([NaN, 1, NaN, 2]),
    shortZero: distinct([0, -0, 1]),
    atBoundary15: distinct([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8]),
    setBranch16: distinct([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, NaN, NaN]),
  };

  grid.concrete = concrete([1, undefined, null, 0, ``, undefined, false]);

  const rows = [
    { team: `b`, n: 1 },
    { team: `a`, n: 2 },
    { team: `b`, n: 3 },
    { team: `c`, n: 4 },
    { team: `a`, n: 5 },
  ];
  grid.groupBy = {
    oneArg: [...groupBy(rows, `team`).entries()],
    sortedKeys: [...groupBy(rows, `team`, (k) => k).entries()],
    missingKeyBucket: [...groupBy([{ x: 1 }, { team: `a`, x: 2 }], `team`).entries()],
  };

  const people = [
    { name: `dan`, age: 30 },
    { name: `amy`, age: 25 },
    { name: `bob`, age: 30 },
    { name: `cat`, age: undefined },
  ];
  const names = (a: unknown[]) => a.map((p) => (p as { name: string }).name);
  grid.sortBy = {
    stringKey: names(sortBy(people, `age`)),
    fn: names(sortBy(people, (p) => (p as { name: string }).name)),
    crossType: sortBy([3, undefined, 1, null, NaN, 2], (v) => v),
    stableTie: names(sortBy(people, `age`)),
  };
  grid.orderBy = {
    singleDesc: names(orderBy(people, `age`, `desc`)),
    multiKey: orderBy(
      [
        { a: 1, b: 2 },
        { a: 1, b: 1 },
        { a: 0, b: 9 },
      ],
      [`a`, `b`],
      [`asc`, `desc`],
    ),
    ordersShorter: orderBy(
      [
        { a: 1, b: 1 },
        { a: 1, b: 2 },
        { a: 0, b: 5 },
      ],
      [`a`, `b`],
      [`desc`],
    ),
    noArgs: orderBy([3, 1, 2]),
  };

  grid.count = {
    basic: count([1, 2, 3, 4, 5], (n) => (n as number) % 2 === 0),
    withIndex: count([`a`, `b`, `c`], (_, i) => i > 0),
    empty: count([], () => true),
  };

  grid.string = {
    capitalize: [`hello`, ``, `a`, `HELLO`].map(cap),
    deCapitalize: [`Hello`, ``, `A`, `hello`].map(decap),
    toQuestion: [`hello`, `hello?`, `hello.`, `hello..`, `hello,`, `hello:`, `hello;`, `what?.`, ``, `?`].map(
      toQuestion,
    ),
  };

  grid.isEqualTo = {
    equal: isEqualTo(new Set([1, 2, 3]), new Set([3, 2, 1])),
    differentSize: isEqualTo(new Set([1, 2]), new Set([1, 2, 3])),
    sameSizeDifferentMembers: isEqualTo(new Set([1, 2, 3]), new Set([1, 2, 4])),
    bothEmpty: isEqualTo(new Set(), new Set()),
  };

  grid.raceFind = {
    firstPassing: await impl.raceFind(
      [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)],
      (v) => (v as number) > 1,
    ),
    defaultPredicateTruthy: await impl.raceFind([Promise.resolve(0), Promise.resolve(``), Promise.resolve(7)]),
    nonePass: await impl.raceFind([Promise.resolve(1), Promise.resolve(2)], (v) => (v as number) > 10),
    emptyArray: await impl.raceFind([]),
    plainValuesAccepted: await impl.raceFind([4, 5], (v) => v === 5),
    rejectionPropagates: await impl
      .raceFind([Promise.reject(new Error(`boom`)), Promise.resolve(1)], (v) => (v as number) > 100)
      .then((v) => ({ resolved: v }))
      .catch((e: unknown) => ({ rejectedWith: e instanceof Error ? e.message : String(e) })),
  };

  assert.equal(bytes(serialize(grid)), bytes(golden.output));
});

test(`distinct's two branches genuinely diverge on NaN (the fork is value-laden)`, () => {
  // short branch: indexOf never finds NaN -> ALL NaN dropped
  assert.deepEqual(distinct([NaN, NaN, 1]), [1]);
  // Set branch (>15): SameValueZero -> exactly one NaN kept
  const sixteen = [...Array(14).keys(), NaN, NaN];
  const out = distinct(sixteen) as number[];
  assert.equal(out.filter((v) => Number.isNaN(v)).length, 1);
});

test(`conditional polyfills: at`, () => {
  const at = (a: unknown[], i: number) => impl.atPolyfill.call(a, i);
  assert.equal(at([10, 20, 30], -1), 30);
  assert.equal(at([10, 20, 30], 0), 10);
  assert.equal(at([10, 20, 30], 3), undefined);
  assert.equal(at([10, 20, 30], -4), undefined);
  assert.equal(at([10, 20, 30], 1.9), 20); // Math.trunc
  assert.equal(at([10], NaN), 10); // Math.trunc(NaN) || 0 -> 0
});

test(`conditional polyfills: toReversed copies, never mutates`, () => {
  const a = [1, 2, 3];
  const r = impl.toReversedPolyfill.call(a);
  assert.deepEqual(r, [3, 2, 1]);
  assert.deepEqual(a, [1, 2, 3]);
});

test(`conditional polyfills: Set.difference`, () => {
  const d = impl.differencePolyfill.call(new Set([1, 2, 3]), new Set([2]));
  assert.deepEqual([...d], [1, 3]);
});

test(`conditional polyfills: withResolvers`, async () => {
  const { promise, resolve } = impl.withResolvers();
  resolve(42);
  assert.equal(await promise, 42);
  const { promise: p2, reject } = impl.withResolvers();
  reject(new Error(`nope`));
  await assert.rejects(p2, /nope/);
});

test(`compareAscending matches lodash's cross-type total preorder`, () => {
  // undefined sorts after everything defined
  assert.equal(compareAscending(undefined, 1), 1);
  assert.equal(compareAscending(1, undefined), -1);
  // null after values, before undefined
  assert.equal(compareAscending(null, 1), 1);
  assert.equal(compareAscending(null, undefined), -1);
  // NaN after null
  assert.equal(compareAscending(NaN, null), 1);
  // lodash quirk, reproduced exactly: NaN !== NaN enters the compare and
  // `!eSelf` fires -> 1, NOT 0 (the sort stays total because compareMultiple
  // falls back to the index tie only on 0; two NaNs order by... both sides
  // returning 1 -> engine-stable in practice, and the corpus ships this).
  assert.equal(compareAscending(NaN, NaN), 1);
  // plain ordering
  assert.equal(compareAscending(1, 2), -1);
  assert.equal(compareAscending(`b`, `a`), 1);
  assert.equal(compareAscending(1, 1), 0);
});

test(`installProtoExtensions installs non-enumerable and idempotently`, () => {
  installProtoExtensions();
  installProtoExtensions(); // second call must not throw or duplicate
  const d = Object.getOwnPropertyDescriptor(Array.prototype, `distinct`);
  assert.ok(d && d.enumerable === false && d.writable === true && d.configurable === true);
  // for..in over an array must not surface the installs (the corpus relies on this)
  const seen: string[] = [];
  // eslint-disable-next-line guard-for-in
  for (const k in [1, 2]) seen.push(k);
  assert.deepEqual(seen, [`0`, `1`]);
  // installed methods actually work through the prototype
  assert.deepEqual(([3, 1, 2] as unknown as { sortBy: (f: (v: unknown) => unknown) => unknown[] }).sortBy((v) => v), [1, 2, 3]);
  assert.equal((`done.` as unknown as { toQuestion: () => string }).toQuestion(), `done?`);
  // dispose symbols exist (native or ours) and are symbols
  assert.equal(typeof (Symbol as unknown as { dispose: symbol }).dispose, `symbol`);
});
