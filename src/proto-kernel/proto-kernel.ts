/**
 * Ambient prototype-extension kernel — clean reimplementation of half 1 of
 * the boot chunk's `b()` installer (`html.CjyPLfH8.js`, pretty L54–L164:
 * `f()` Array, `t()` = the core date half owned by the DATE-KERNEL slice,
 * `h()` Promise, `g()` String, `l()` Object.hasOwn, `_()` Set, `v()`
 * Symbol.dispose family). Original code; behavior verified byte-for-byte
 * against the committed corpus-executed golden
 * (`golden/proto-kernel.grid.expected.json`) — see `corpus-manifest.json`.
 *
 * Why this kernel is load-bearing (R-BOOT shard §2, settled 2× on PR #300):
 * transcribed corpus chunks call these methods as if they were the language
 * (`ContextualMenuActions` alone calls `.concrete()` 272×), so the A-track
 * shell must install them before mounting anything. The installs are
 * value-laden, not trivia:
 *   - `distinct` forks on `length <= 15`: indexOf-filter vs `new Set`. The
 *     two branches DIVERGE on NaN (indexOf never finds NaN, so the short
 *     branch DROPS every NaN; the Set branch keeps one) — pinned in the
 *     golden grid.
 *   - `groupBy` returns a real Map (insertion order = first-seen); the
 *     optional second arg re-maps with keys sorted through `sortBy`.
 *   - `sortBy`/`orderBy` delegate to the bundled lodash (`core.PJIFv7xf.js`
 *     module-scope closures `ue`/`de`): iteratee shorthand + lodash's
 *     `compareAscending` cross-type rules (undefined last, null before
 *     undefined ascending, NaN after null, symbols after plain values) +
 *     index-stable ties. Transcribed here without a lodash dependency.
 *   - `toQuestion` strips exactly ONE trailing `.`/`,`/`:` then appends `?`
 *     unless the (stripped) string already ends with one.
 *   - `raceFind` resolves with the first settled value passing the
 *     predicate; resolves `undefined` when none passes or the array is
 *     empty; rejects on the first rejection.
 * Install discipline mirrors the corpus exactly: every install uses a
 * non-enumerable/writable/configurable data property (the corpus's `i()`
 * helper); `distinct`/`concrete`/`groupBy`/`orderBy`/`sortBy`/`count`, the
 * String trio, and `isEqualTo` install UNCONDITIONALLY; `at`/`toReversed`/
 * `Set.difference`/`Promise.raceFind`/`withResolvers`/`Object.hasOwn`/
 * `Symbol.dispose`/`asyncDispose` install only-if-missing (the #300 review's
 * conditional-vs-unconditional split — a golden on the conditional group
 * would pin the NATIVE method on modern targets, so the grid drives only
 * semantics our module also provides when the native exists).
 *
 * Iteratee coverage note (honest limit): the corpus's lodash `baseIteratee`
 * also accepts object/matches shorthand. Loops-family consumers use function
 * and string-key iteratees (measured on the pretty tree; the R-BOOT shard's
 * consumer census); this module implements function, string path (with `.`
 * splitting), and identity. An object-matcher use, if ever found in scoped
 * chunks, extends this module with its own golden.
 */

/** The corpus's `i()`/`D()` define helper: non-enumerable, writable, configurable. */
function def(target: object, name: PropertyKey, value: unknown): void {
  Object.defineProperty(target, name, {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

type Iteratee = string | ((value: unknown) => unknown);

/** lodash `property`/identity subset of baseIteratee (see header note). */
function toIterateeFn(it: Iteratee | null | undefined): (value: unknown) => unknown {
  if (typeof it === `function`) return it;
  if (it === null || it === undefined) return (v) => v;
  const path = String(it).split(`.`);
  return (v) => {
    let cur: unknown = v;
    for (const key of path) {
      if (cur === null || cur === undefined) return undefined;
      cur = (cur as Record<string, unknown>)[key];
    }
    return cur;
  };
}

/** lodash `compareAscending`, transcribed from `core.PJIFv7xf.js` (pretty
 * ~L100–117, closure `ae`): the exact cross-type total preorder. */
export function compareAscending(e: unknown, t: unknown): number {
  if (e !== t) {
    const eDef = e !== undefined;
    const eNull = e === null;
    const eSelf = e === e; // false only for NaN
    const eSym = typeof e === `symbol`;
    const tDef = t !== undefined;
    const tNull = t === null;
    const tSelf = t === t;
    const tSym = typeof t === `symbol`;
    if (
      (!tNull && !tSym && !eSym && (e as never) > (t as never)) ||
      (eSym && tDef && tSelf && !tNull && !tSym) ||
      (eNull && tDef && tSelf) ||
      (!eDef && tSelf) ||
      !eSelf
    ) {
      return 1;
    }
    if (
      (!eNull && !eSym && !tSym && (e as never) < (t as never)) ||
      (tSym && eDef && eSelf && !eNull && !eSym) ||
      (tNull && eDef && eSelf) ||
      (!tDef && eSelf) ||
      !tSelf
    ) {
      return -1;
    }
  }
  return 0;
}

/** lodash `baseOrderBy`: criteria per iteratee, `compareMultiple` with the
 * desc flip and the index-stable tie (`core.PJIFv7xf.js` closures `oe`/`x`). */
function baseOrderBy(
  collection: readonly unknown[],
  iteratees: ReadonlyArray<Iteratee | null | undefined>,
  orders: ReadonlyArray<string>,
): unknown[] {
  const fns = (iteratees.length ? iteratees : [null]).map(toIterateeFn);
  const wrapped = collection.map((value, index) => ({
    criteria: fns.map((f) => f(value)),
    index,
    value,
  }));
  wrapped.sort((a, b) => {
    for (let i = 0; i < a.criteria.length; i++) {
      const r = compareAscending(a.criteria[i], b.criteria[i]);
      if (r) return i >= orders.length ? r : r * (orders[i] === `desc` ? -1 : 1);
    }
    return a.index - b.index;
  });
  return wrapped.map((w) => w.value);
}

// ---- the Array installs (corpus `f()`) --------------------------------------

function arrayDistinct(this: unknown[]): unknown[] {
  return this.length <= 15 ? this.filter((e, t, n) => n.indexOf(e) === t) : [...new Set(this)];
}

function arrayConcrete(this: unknown[]): unknown[] {
  return this.filter((e) => e !== undefined);
}

function arrayGroupBy(
  this: unknown[],
  key: string,
  keySort?: Iteratee,
): Map<unknown, unknown[]> {
  const m = new Map<unknown, unknown[]>();
  for (const item of this) {
    const k = (item as Record<string, unknown>)[key];
    const bucket = m.get(k);
    if (bucket) bucket.push(item);
    else m.set(k, [item]);
  }
  if (keySort) {
    const sortedKeys = baseOrderBy(Array.from(m.keys()), [keySort], []);
    const r = new Map<unknown, unknown[]>();
    for (const k of sortedKeys) r.set(k, m.get(k) as unknown[]);
    return r;
  }
  return m;
}

function arraySortBy(this: unknown[], it?: Iteratee | Iteratee[]): unknown[] {
  const its = Array.isArray(it) ? it : [it];
  return baseOrderBy(this, its, []);
}

function arrayOrderBy(
  this: unknown[],
  it?: Iteratee | Iteratee[],
  orders?: string | string[],
): unknown[] {
  const its = it === null || it === undefined ? [] : Array.isArray(it) ? it : [it];
  const ords = orders === null || orders === undefined ? [] : Array.isArray(orders) ? orders : [orders];
  return baseOrderBy(this, its, ords);
}

function arrayCount(this: unknown[], p: (e: unknown, i: number, a: unknown[]) => unknown): number {
  let t = 0;
  for (let n = 0, r = this.length; n < r; ++n) if (p(this[n], n, this)) t++;
  return t;
}

function arrayAtPolyfill(this: unknown[], e: number): unknown {
  const t = Math.trunc(e) || 0;
  const n = t < 0 ? this.length + t : t;
  return n < 0 || n >= this.length ? undefined : this[n];
}

function arrayToReversedPolyfill(this: unknown[]): unknown[] {
  return [...this].reverse();
}

// ---- the Promise installs (corpus `h()`) ------------------------------------

function raceFind(
  promises: readonly unknown[],
  predicate?: (value: unknown) => unknown,
): Promise<unknown> {
  if (promises.length === 0) return new Promise((resolve) => resolve(undefined));
  const test = predicate ?? ((e: unknown) => e);
  return new Promise((resolve, reject) => {
    let remaining = promises.length;
    promises.forEach((p) => {
      Promise.resolve(p)
        .then((v) => {
          if (test(v)) resolve(v);
        })
        .catch((e) => {
          reject(e);
        })
        .finally(() => {
          remaining--;
          if (remaining === 0) resolve(undefined);
        });
    });
  });
}

function withResolvers(): {
  promise: Promise<unknown>;
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value?: unknown) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---- the String installs (corpus `g()`) -------------------------------------

function stringCapitalize(this: string): string {
  return this.charAt(0).toUpperCase() + this.slice(1);
}

function stringDeCapitalize(this: string): string {
  return this.charAt(0).toLowerCase() + this.slice(1);
}

function stringToQuestion(this: string): string {
  const e = this.replace(/(\.|,|:)$/, ``);
  return e.lastIndexOf(`?`) === e.length - 1 ? e : e + `?`;
}

// ---- the Set installs (corpus `_()`) ----------------------------------------

function setIsEqualTo(this: Set<unknown>, e: Set<unknown>): boolean {
  return this.size === e.size && [...this].every((t) => e.has(t));
}

function setDifferencePolyfill(this: Set<unknown>, e: Set<unknown>): Set<unknown> {
  return new Set([...this].filter((t) => !e.has(t)));
}

// ---- Object / Symbol (corpus `l()` / `v()`) ---------------------------------

function installHasOwn(): void {
  if (!(`hasOwn` in Object)) {
    Object.defineProperty(Object, `hasOwn`, {
      value: Function.prototype.call.bind(Object.prototype.hasOwnProperty),
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }
}

function installDisposeSymbol(name: `dispose` | `asyncDispose`): void {
  if (!Object.getOwnPropertyDescriptor(Symbol, name)) {
    Object.defineProperty(Symbol, name, {
      value: Symbol(`@linear/Symbol.${name}`),
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }
}

/**
 * Install half 1 of `b()` in the corpus call order (`f(), [t()=date half,
 * DATE-KERNEL slice], h(), g(), l(), _(), v()`). Idempotent in effect: the
 * unconditional group redefines identically; the conditional group installs
 * only when missing, exactly as first-party.
 */
export function installProtoExtensions(): void {
  // f() — Array
  def(Array.prototype, `distinct`, arrayDistinct);
  def(Array.prototype, `concrete`, arrayConcrete);
  def(Array.prototype, `groupBy`, arrayGroupBy);
  def(Array.prototype, `orderBy`, arrayOrderBy);
  def(Array.prototype, `sortBy`, arraySortBy);
  if (!Array.prototype.at) def(Array.prototype, `at`, arrayAtPolyfill);
  if (!(Array.prototype as unknown as { toReversed?: unknown }).toReversed) {
    def(Array.prototype, `toReversed`, arrayToReversedPolyfill);
  }
  def(Array.prototype, `count`, arrayCount);
  // h() — Promise
  const P = Promise as unknown as Record<string, unknown>;
  if (!P.raceFind) def(Promise, `raceFind`, raceFind);
  if (!P.withResolvers) def(Promise, `withResolvers`, withResolvers);
  // g() — String
  def(String.prototype, `capitalize`, stringCapitalize);
  def(String.prototype, `deCapitalize`, stringDeCapitalize);
  def(String.prototype, `toQuestion`, stringToQuestion);
  // l() — Object.hasOwn
  installHasOwn();
  // _() — Set
  def(Set.prototype, `isEqualTo`, setIsEqualTo);
  if (!(Set.prototype as unknown as { difference?: unknown }).difference) {
    def(Set.prototype, `difference`, setDifferencePolyfill);
  }
  // v() — Symbol.dispose family
  installDisposeSymbol(`dispose`);
  installDisposeSymbol(`asyncDispose`);
}

/** The implementations, exported plainly so tests and the golden grid can
 * drive them without touching global prototypes. */
export const impl = {
  distinct: arrayDistinct,
  concrete: arrayConcrete,
  groupBy: arrayGroupBy,
  sortBy: arraySortBy,
  orderBy: arrayOrderBy,
  count: arrayCount,
  atPolyfill: arrayAtPolyfill,
  toReversedPolyfill: arrayToReversedPolyfill,
  raceFind,
  withResolvers,
  capitalize: stringCapitalize,
  deCapitalize: stringDeCapitalize,
  toQuestion: stringToQuestion,
  isEqualTo: setIsEqualTo,
  differencePolyfill: setDifferencePolyfill,
} as const;
