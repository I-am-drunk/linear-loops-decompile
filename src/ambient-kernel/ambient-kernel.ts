/**
 * Ambient prototype-extension kernel — clean reimplementation of the
 * installer half of the app's ambient standard library, from the boot chunk
 * `html.CjyPLfH8.js` (pretty L54–167: functions `f` Array, `h` Promise,
 * `g` String, `_` Set, `v`/`y` Symbol, `l` Object.hasOwn; the define helper
 * `i` is core.PJIFv7xf.js's `ot` export — non-enumerable/writable/
 * configurable, matching the corpus descriptor shape). Original code;
 * behavior is verified against the corpus by executing the REAL installer
 * from the boot chunk and byte-comparing outputs (see `corpus-manifest.json`
 * and the golden test).
 *
 * Scope note (mirrors the merged R-BOOT §2 row and the #300 review's
 * two-chunk split finding): the boot installer `b()` calls SEVEN functions;
 * six are defined in the boot chunk itself and are THIS module. The second
 * call (`t()`) is `core.PJIFv7xf.js`'s `fe` export — the Date family +
 * `String.prototype.toLocalDate` — which is the separate DATE-KERNEL slice
 * (claimed on #225 at 2026-09-29 20:16:05Z). Together the two complete the
 * B2 boot row that gates A1.
 *
 * Why every transcribed chunk needs this at module scope: the app's code
 * calls `.concrete()`/`.distinct()`/`.groupBy()`/`Promise.raceFind` as if
 * they were the standard library (`ContextualMenuActions` alone calls
 * `.concrete()` 272×; Logger's module scope dies without it). The kernel is
 * imported by nobody and assumed by everybody — the ambient-seam class the
 * R-BOOT shard flags for R-SEAM.
 *
 * Two export surfaces:
 *  - PURE functions (receiver-first) so our own kernels and tests can use
 *    the exact behaviors without touching globals;
 *  - `installAmbient()` reproducing first-party's installer semantics,
 *    including the conditional-vs-unconditional split settled in the #300
 *    review: `at`/`toReversed`/`Set.difference`/`Promise.raceFind`/
 *    `Promise.withResolvers`/`Object.hasOwn`/`Symbol.dispose|asyncDispose`
 *    install only if missing; the Linear-authored methods install
 *    unconditionally.
 *
 * `orderBy`/`sortBy` first-party delegate to the bundled lodash
 * (core.PJIFv7xf.js re-exports `ct`/`st`; boot binds them as `u`/`d`).
 * We do not vendor lodash: `sortByValue`/`orderByValues` reimplement the
 * app-visible semantics (iteratee shorthand, lodash's compareAscending
 * ordering of mixed/undefined/null/NaN/symbol values, stable index
 * tiebreak), and the golden pins them against the real bundled code across
 * the value-laden cases. Divergence fails the byte-compare, not review
 * eyeballs.
 */

/** lodash compareAscending — the exact mixed-type ordering the bundled
 * sortBy/orderBy use (undefined last, null before undefined, NaN before
 * null, symbols after plain values). Transcribed semantics, original code. */
function compareAscending(value: unknown, other: unknown): number {
  if (value !== other) {
    const valIsDefined = value !== undefined;
    const valIsNull = value === null;
    const valIsReflexive = value === value; // false only for NaN
    const valIsSymbol = typeof value === `symbol`;
    const othIsDefined = other !== undefined;
    const othIsNull = other === null;
    const othIsReflexive = other === other;
    const othIsSymbol = typeof other === `symbol`;
    if (
      (!othIsNull && !othIsSymbol && !valIsSymbol && (value as never) > (other as never)) ||
      (valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol) ||
      (valIsNull && othIsDefined && othIsReflexive) ||
      (!valIsDefined && othIsReflexive) ||
      !valIsReflexive
    ) {
      return 1;
    }
    if (
      (!valIsNull && !valIsSymbol && !othIsSymbol && (value as never) < (other as never)) ||
      (othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol) ||
      (othIsNull && valIsDefined && valIsReflexive) ||
      (!othIsDefined && valIsReflexive) ||
      !othIsReflexive
    ) {
      return -1;
    }
  }
  return 0;
}

/** A lodash-style iteratee: a function, or a property-name shorthand. */
export type Iteratee<T> = ((value: T) => unknown) | string;

function toIterateeFn<T>(iteratee: Iteratee<T>): (value: T) => unknown {
  if (typeof iteratee === `function`) return iteratee;
  const key = iteratee;
  return (value: T) => (value as Record<string, unknown>)[key];
}

/** `Array.prototype.distinct` (boot chunk `f`): ≤15 elements uses the
 * indexOf-filter (first occurrence kept, SameValueZero via indexOf's
 * strict-equality — NaN never matches itself there), >15 uses `[...new
 * Set]` (SameValueZero — NaN dedupes). The 15-element fork is a pinned
 * corpus value with observable NaN divergence between the branches. */
export function distinct<T>(array: readonly T[]): T[] {
  return array.length <= 15
    ? array.filter((e, t, n) => n.indexOf(e) === t)
    : [...new Set(array)];
}

/** `Array.prototype.concrete`: drops only `undefined` (null survives). */
export function concrete<T>(array: readonly (T | undefined)[]): T[] {
  return array.filter((e): e is T => e !== undefined);
}

/** `Array.prototype.groupBy(key, keySort?)`: insertion-ordered Map of
 * key-value → members; with `keySort`, keys are re-ordered by
 * `sortBy(keySort)` into a fresh Map. */
export function groupBy<T>(
  array: readonly T[],
  key: string,
  keySort?: Iteratee<unknown>,
): Map<unknown, T[]> {
  const groups = new Map<unknown, T[]>();
  for (const item of array) {
    const k = (item as Record<string, unknown>)[key];
    const existing = groups.get(k);
    if (existing) existing.push(item);
    else groups.set(k, [item]);
  }
  if (keySort) {
    const orderedKeys = sortByValue(Array.from(groups.keys()), keySort);
    const ordered = new Map<unknown, T[]>();
    for (const k of orderedKeys) ordered.set(k, groups.get(k) as T[]);
    return ordered;
  }
  return groups;
}

/** `Array.prototype.sortBy(iteratee)` — bundled-lodash sortBy: stable
 * ascending by iteratee value under compareAscending. */
export function sortByValue<T>(array: readonly T[], iteratee: Iteratee<T>): T[] {
  return orderByValues(array, [iteratee], []);
}

/** `Array.prototype.orderBy(iteratees, orders)` — bundled-lodash orderBy:
 * multi-key stable sort; each order is `asc` (default) or `desc`. Accepts a
 * single iteratee or an array, mirroring lodash's argument shapes. */
export function orderByValues<T>(
  array: readonly T[],
  iteratees: Iteratee<T> | readonly Iteratee<T>[],
  orders?: string | readonly string[],
): T[] {
  const iterateeList = (Array.isArray(iteratees) ? iteratees : [iteratees]) as readonly Iteratee<T>[];
  const fns = (iterateeList.length === 0 ? [(v: T) => v] : iterateeList.map(toIterateeFn));
  const orderList = orders === undefined ? [] : Array.isArray(orders) ? orders : [orders];
  const decorated = array.map((value, index) => ({
    criteria: fns.map((fn) => fn(value)),
    index,
    value,
  }));
  decorated.sort((a, b) => {
    for (let i = 0; i < a.criteria.length; i++) {
      const result = compareAscending(a.criteria[i], b.criteria[i]);
      if (result !== 0) {
        return i < orderList.length && orderList[i] === `desc` ? -result : result;
      }
    }
    return a.index - b.index;
  });
  return decorated.map((d) => d.value);
}

/** `Array.prototype.count(predicate)`: index-loop predicate counter (the
 * predicate receives (element, index, array), like the corpus). */
export function count<T>(
  array: readonly T[],
  predicate: (value: T, index: number, array: readonly T[]) => unknown,
): number {
  let total = 0;
  for (let i = 0, r = array.length; i < r; ++i) {
    if (predicate(array[i] as T, i, array)) total++;
  }
  return total;
}

/** The `at` POLYFILL body (installed only when `Array.prototype.at` is
 * missing): Math.trunc + negative-from-end, undefined out of range. On
 * modern targets the native method runs; this pins the app-visible shape. */
export function at<T>(array: readonly T[], index: number): T | undefined {
  const t = Math.trunc(index) || 0;
  const n = t < 0 ? array.length + t : t;
  return n < 0 || n >= array.length ? undefined : array[n];
}

/** The `toReversed` polyfill body (install-if-missing): copy + reverse. */
export function toReversed<T>(array: readonly T[]): T[] {
  return [...array].reverse();
}

/** `String.prototype.capitalize`: first char upper, rest untouched. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** `String.prototype.deCapitalize`: first char lower, rest untouched. */
export function deCapitalize(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** `String.prototype.toQuestion`: strip ONE trailing `.`/`,`/`:`, then
 * append `?` unless the (stripped) string already ends with one. */
export function toQuestion(s: string): string {
  const e = s.replace(/(\.|,|:)$/, ``);
  return e.lastIndexOf(`?`) === e.length - 1 ? e : e + `?`;
}

/** `Set.prototype.isEqualTo`: size equality + every-has. */
export function setIsEqualTo(a: ReadonlySet<unknown>, b: ReadonlySet<unknown>): boolean {
  return a.size === b.size && [...a].every((t) => b.has(t));
}

/** The `Set.prototype.difference` polyfill body (install-if-missing). */
export function setDifference<T>(a: ReadonlySet<T>, b: ReadonlySet<unknown>): Set<T> {
  return new Set([...a].filter((t) => !b.has(t)));
}

/** `Promise.raceFind(values, predicate?)` (boot chunk `p`, installed
 * if-missing as `h` does — it is Linear-authored, no native exists):
 * resolves with the FIRST settled value passing the predicate (default:
 * truthy); rejects on the first rejection; resolves `undefined` when all
 * settle without a match; empty input resolves `undefined` immediately. */
export function raceFind<T>(
  values: readonly (T | PromiseLike<T>)[],
  predicate?: (value: T) => unknown,
): Promise<T | undefined> {
  if (values.length === 0) return new Promise((resolve) => resolve(undefined));
  const test = predicate ?? ((e: T) => e);
  return new Promise((resolve, reject) => {
    let remaining = values.length;
    values.forEach((value) => {
      Promise.resolve(value)
        .then((settled) => {
          if (test(settled)) resolve(settled);
        })
        .catch((error: unknown) => {
          reject(error as Error);
        })
        .finally(() => {
          remaining--;
          if (remaining === 0) resolve(undefined);
        });
    });
  });
}

/** The `Promise.withResolvers` polyfill body (install-if-missing). */
export function withResolvers<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The corpus's define helper (core.PJIFv7xf.js `ot`, bound as `i` in the
 * boot chunk): non-enumerable, writable, configurable — the descriptor
 * shape every ambient method carries. */
function define(target: object, name: string, value: unknown): void {
  Object.defineProperty(target, name, {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Install the ambient kernel on the live globals, mirroring the boot chunk's
 * `b()` minus its `t()` call (the Date family — DATE-KERNEL's module
 * installs that half). Order and conditionality per the corpus:
 * unconditional overwrites for the Linear-authored methods, install-if-
 * missing for `at`/`toReversed`/`raceFind`/`withResolvers`/`hasOwn`/
 * `Set.difference`/`Symbol.dispose|asyncDispose`.
 */
export function installAmbient(): void {
  const arrayProto = Array.prototype as any;
  // f() — Array
  define(arrayProto, `distinct`, function (this: unknown[]) {
    return distinct(this);
  });
  define(arrayProto, `concrete`, function (this: unknown[]) {
    return concrete(this);
  });
  define(arrayProto, `groupBy`, function (this: unknown[], key: string, keySort?: Iteratee<unknown>) {
    return groupBy(this, key, keySort);
  });
  define(arrayProto, `orderBy`, function (this: unknown[], iteratees: Iteratee<unknown> | Iteratee<unknown>[], orders?: string | string[]) {
    return orderByValues(this, iteratees, orders);
  });
  define(arrayProto, `sortBy`, function (this: unknown[], iteratee: Iteratee<unknown>) {
    return sortByValue(this, iteratee);
  });
  if (!Array.prototype.at) {
    define(arrayProto, `at`, function (this: unknown[], index: number) {
      return at(this, index);
    });
  }
  if (!(Array.prototype as any).toReversed) {
    define(arrayProto, `toReversed`, function (this: unknown[]) {
      return toReversed(this);
    });
  }
  define(arrayProto, `count`, function (this: unknown[], predicate: (v: unknown, i: number, a: readonly unknown[]) => unknown) {
    return count(this, predicate);
  });
  // t() is DATE-KERNEL's installer — not this module.
  // h() — Promise
  const promiseCtor = Promise as any;
  if (!promiseCtor.raceFind) define(promiseCtor, `raceFind`, raceFind);
  if (!promiseCtor.withResolvers) define(promiseCtor, `withResolvers`, withResolvers);
  // g() — String
  const stringProto = String.prototype as any;
  define(stringProto, `capitalize`, function (this: string) {
    return capitalize(String(this));
  });
  define(stringProto, `deCapitalize`, function (this: string) {
    return deCapitalize(String(this));
  });
  define(stringProto, `toQuestion`, function (this: string) {
    return toQuestion(String(this));
  });
  // l() — Object.hasOwn
  const objectCtor = Object as any;
  if (!(`hasOwn` in objectCtor)) {
    define(objectCtor, `hasOwn`, objectCtor.call.bind(Object.prototype.hasOwnProperty));
  }
  // _() — Set
  const setProto = Set.prototype as any;
  define(setProto, `isEqualTo`, function (this: Set<unknown>, other: ReadonlySet<unknown>) {
    return setIsEqualTo(this, other);
  });
  if (!setProto.difference) {
    define(setProto, `difference`, function (this: Set<unknown>, other: ReadonlySet<unknown>) {
      return setDifference(this, other);
    });
  }
  // v() — Symbol.dispose / Symbol.asyncDispose (frozen, unlike the rest)
  for (const name of [`dispose`, `asyncDispose`] as const) {
    if (!Object.getOwnPropertyDescriptor(Symbol, name)) {
      Object.defineProperty(Symbol, name, {
        value: Symbol(`@linear/Symbol.${name}`),
        configurable: false,
        enumerable: false,
        writable: false,
      });
    }
  }
}
