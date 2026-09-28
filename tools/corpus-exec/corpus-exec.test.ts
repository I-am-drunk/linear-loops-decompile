/**
 * G1 tests — run on the miniature fixture corpus (fixtures/corpus), no vault
 * needed. With a real corpus present (pipeline/corpus), one smoke case
 * re-derives a generateTheme value and compares it against the H2 goldens;
 * without one that test skips with a pointer.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { expectedBytes, gitHead, loadCase, runCase, selectCorpusSource, type CaseFile } from "./run.ts";
import { buildSandbox, closureSize, resolveChunk } from "./sandbox.ts";
import { serialize, stringify } from "./serialize.ts";

const here = fileURLToPath(new URL(`.`, import.meta.url));
const fixtureCorpus = join(here, `fixtures`, `corpus`);
const fixtureChunks = join(fixtureCorpus, `pretty`, `client`);
const dualCorpus = join(here, `fixtures`, `dual-corpus`);
const noLog = (): void => undefined;

// --- sandbox ---------------------------------------------------------------

test(`closure walk finds transitive imports and substitutes stubs`, () => {
  const closure = buildSandbox(fixtureChunks, join(here, `fixtures`), `math.AAAA.js`, {});
  assert.deepEqual(closure.chunks, [`config.BBBB.js`, `math.AAAA.js`]);
  assert.deepEqual(closure.stubbed, []);
  assert.equal(Object.keys(closure.hashes).length, 2);

  const stubbed = buildSandbox(fixtureChunks, join(here, `fixtures`), `Widget.CCCC.js`, {
    "provider.DDDD.js": { source: `export const l = false;`, why: `matchMedia` },
  });
  assert.deepEqual(stubbed.chunks, [`Widget.CCCC.js`, `provider.DDDD.js`, `react.FAKE.js`]);
  assert.deepEqual(stubbed.stubbed, [`provider.DDDD.js`]);
  // the stub is not hashed (it is declared in the case file, not the corpus)
  assert.equal(stubbed.hashes[`provider.DDDD.js`], undefined);
});

test(`side-effect imports join the closure (import "./x" without from)`, async () => {
  const closure = buildSandbox(fixtureChunks, join(here, `fixtures`), `effects.EEEE.js`, {});
  assert.deepEqual(closure.chunks, [`config.BBBB.js`, `effects.EEEE.js`, `sideeffect.FFFF.js`]);
  const c: CaseFile = {
    unit: `fixture/effects`,
    chunk: `effects.EEEE.js`,
    invoke: { export: `n`, exportMeaning: `get (effects.EEEE.js: export { get as n })`, args: [1] },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  assert.equal(result.output, 103); // 100 (side-effect global) + 2 (config k) + 1
});

test(`a missing chunk fails loudly, naming it`, () => {
  assert.throws(() => buildSandbox(fixtureChunks, join(here, `fixtures`), `nope.ZZZZ.js`, {}), /chunk not found in corpus: nope\.ZZZZ\.js/);
});

test(`raw client is selected over a co-located pretty projection`, async () => {
  assert.deepEqual(selectCorpusSource(fixtureCorpus), {
    flavor: `pretty`, path: `pretty/client`, chunksDir: join(fixtureCorpus, `pretty`, `client`),
  });
  assert.deepEqual(selectCorpusSource(dualCorpus), {
    flavor: `raw`, path: `client`, chunksDir: join(dualCorpus, `client`),
  });
  const c: CaseFile = {
    unit: `fixture/raw-selection`,
    chunk: `value.AAAA.js`,
    invoke: { export: `n`, exportMeaning: `raw-vs-pretty fixture value`, args: [] },
  };
  const result = await runCase(dualCorpus, join(here, `fixtures`), c, noLog);
  assert.equal(result.output, `raw`);
  assert.deepEqual(result.provenance.corpusSource, { flavor: `raw`, path: `client` });
});

test(`a corpus without raw or legacy pretty chunks fails naming both layouts`, () => {
  assert.throws(() => selectCorpusSource(join(here, `fixtures`, `missing-corpus`)), /neither client\/ \(raw\) nor pretty\/client\/ \(legacy\)/);
});

test(`closureSize probes without building`, () => {
  assert.equal(closureSize(fixtureChunks, `math.AAAA.js`, {}), 2);
  assert.equal(closureSize(fixtureChunks, `Widget.CCCC.js`, { "provider.DDDD.js": { source: ``, why: `` } }), 3);
});

// --- serialize ---------------------------------------------------------------

test(`serialization is deterministic for one value and preserves observable own-key order`, () => {
  const value = { b: 2, a: [1, { d: 4, c: 3 }] };
  assert.equal(stringify(value), stringify(value));
  const reverse = { a: [1, { c: 3, d: 4 }], b: 2 };
  assert.notEqual(stringify(value), stringify(reverse));
});

test(`functions outside elements are a loud error`, () => {
  assert.throws(() => serialize({ cb: () => 1 }), /unserializable function at \$\.cb/);
});

test(`expected bytes keep an inspectable envelope and tag only observed output`, async () => {
  const c: CaseFile = {
    unit: `fixture/add`,
    chunk: `math.AAAA.js`,
    invoke: { export: `n`, exportMeaning: `add`, args: [2, 3] },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  const golden = JSON.parse(expectedBytes(result)) as { provenance: { entry: string }; output: { tag: string } };
  assert.equal(golden.provenance.entry, `math.AAAA.js`);
  assert.equal(golden.output.tag, `object`);
});

test(`composite elements refuse loudly: T1 must not invent a composite boundary`, () => {
  const Comp = function Inner(): null { return null; };
  const el = { $$typeof: Symbol.for(`react.transitional.element`), type: Comp, props: {} };
  assert.throws(() => serialize(el), /unserializable composite React element at \$.*T2 renderer/);
});

test(`tagged grammar distinguishes every formerly-colliding primitive class`, () => {
  const collisions: Array<[string, unknown, unknown]> = [
    [`null / undefined`, null, undefined],
    [`zero / negative zero`, 0, -0],
    [`date / matching string`, new Date(`2026-01-13T15:00:00Z`), `$date:2026-01-13T15:00:00.000Z`],
    [`NaN / matching string`, NaN, `$number:NaN`],
    [`bigint / matching string`, 7n, `$bigint:7`],
    [`undefined property / matching string property`, { a: undefined }, { a: `$undefined` }],
    [`sparse hole / explicit undefined`, [, 1], [undefined, 1]],
    [`object prototype / null prototype`, { a: 1 }, Object.assign(Object.create(null), { a: 1 })],
    [`own-key insertion order`, { first: 1, second: 2 }, { second: 2, first: 1 }],
  ];
  for (const [name, left, right] of collisions) {
    assert.notEqual(stringify(left), stringify(right), name);
  }
  assert.deepEqual(serialize(new Date(`2026-01-13T15:00:00Z`)), { tag: `date`, value: `2026-01-13T15:00:00.000Z` });
  assert.throws(() => serialize(new Date(`nope`)), /invalid Date at \$/);
  const decorated = new Date(`2026-01-13T15:00:00Z`) as Date & { x?: number };
  decorated.x = 1;
  assert.throws(() => serialize(decorated), /unserializable decorated Date/);
});

test(`unsupported descriptor and reference classes fail loudly rather than collapsing`, () => {
  assert.throws(() => serialize({ deep: { v: new Map([[`a`, 1]]) } }), /unserializable Map at \$\.deep\.v/);
  assert.throws(() => serialize(new Set([1])), /unserializable Set at \$/);
  assert.throws(() => serialize(/x/), /unserializable RegExp at \$/);
  assert.throws(() => serialize(new Error(`e`)), /unserializable Error at \$/);
  assert.throws(() => serialize(new Uint8Array(2)), /unserializable Uint8Array at \$/);
  assert.throws(() => serialize({ f: () => undefined }), /unserializable function at \$.f/);
  const accessor = {} as { value?: number };
  Object.defineProperty(accessor, `value`, { enumerable: true, configurable: true, get: () => 1 });
  assert.throws(() => serialize(accessor), /accessors are not a stable golden value/);
  assert.throws(() => serialize({ [Symbol(`s`)]: 1 }), /unserializable symbol property/);
  const hidden = { visible: 1 } as { visible: number; hidden?: number };
  Object.defineProperty(hidden, `hidden`, { enumerable: false, writable: true, configurable: true, value: 2 });
  assert.throws(() => serialize(hidden), /nonstandard property descriptors/);
  const withRef = { $$typeof: Symbol.for(`react.transitional.element`), type: `div`, key: null, ref: () => undefined, props: {} };
  assert.throws(() => serialize(withRef), /unserializable React ref/);
});

test(`cycles name their path; shared non-cyclic references remain values`, () => {
  const cyc: Record<string, unknown> = {};
  cyc.self = cyc;
  assert.throws(() => serialize(cyc), /cycle at \$.self/);
  const shared = { x: 1 };
  assert.equal(stringify({ a: shared, b: shared }), stringify({ a: { x: 1 }, b: { x: 1 } }));
});

test(`element key is a typed serialized fact: key-swapped lists differ`, () => {
  const li = (key: string, text: string): unknown => ({ $$typeof: Symbol.for(`react.transitional.element`), type: `li`, key, props: { children: text } });
  const ul = (children: unknown[]): unknown => ({ $$typeof: Symbol.for(`react.transitional.element`), type: `ul`, key: null, props: { children } });
  assert.notEqual(stringify(ul([li(`k1`, `first`), li(`k2`, `second`)])), stringify(ul([li(`k2`, `first`), li(`k1`, `second`)])));
  const one = serialize(li(`k1`, `x`)) as { key: unknown };
  assert.deepEqual(one.key, { tag: `string`, value: `k1` });
});

// --- run: invoke mode ---------------------------------------------------------

test(`invoke mode executes the corpus function on case args`, async () => {
  const c: CaseFile = {
    unit: `fixture/add`,
    chunk: `math.AAAA.js`,
    invoke: { export: `n`, exportMeaning: `add (math.AAAA.js: export { add as n })`, args: [2, 3] },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  assert.deepEqual(result.output, { parts: [2, 3], sum: 10 });
  assert.equal(result.provenance.entry, `math.AAAA.js`);
  assert.equal(result.provenance.closureSize, 2);
  // byte-stable across runs
  const again = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  assert.equal(expectedBytes(result), expectedBytes(again));
});

test(`a wrong export name fails naming the real exports`, async () => {
  const c: CaseFile = {
    unit: `fixture/add`,
    chunk: `math.AAAA.js`,
    invoke: { export: `zz`, exportMeaning: `wrong`, args: [] },
  };
  await assert.rejects(runCase(fixtureCorpus, join(here, `fixtures`), c, noLog), /export "zz" .* not a function \(exports: n\)/);
});

// --- run: render mode ----------------------------------------------------------

test(`useReducer lazy init (3-arg) computes the real initial state, never a silent fake`, async () => {
  const c: CaseFile = {
    unit: `fixture/reducer`,
    chunk: `reducer.HHHH.js`,
    render: { export: `t`, exportMeaning: `Panel (useReducer lazy-init)`, props: { seed: 21 } },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  const tree = result.output as { props: { children: string } };
  assert.equal(tree.props.children, `42`); // initFn(seed) ran; the old dispatcher returned the raw seed
});

test(`render mode executes a component under the micro-dispatcher with the case context`, async () => {
  const c: CaseFile = {
    unit: `fixture/widget`,
    chunk: `Widget.CCCC.js`,
    stubs: { "provider.DDDD.js": { source: `export const l = false;`, why: `matchMedia boolean; false branch of the pinned pair` } },
    render: {
      export: `t`,
      exportMeaning: `Widget (Widget.CCCC.js: export { Widget as t })`,
      props: { name: `My loop` },
      context: { value: { color: { labelBase: `#111` } }, why: `theme context; token value pinned by the case` },
    },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  const tree = result.output as { type: string; props: { className: string; children: { type: string; props: { style: { color: string }; children: string } } } };
  assert.equal(tree.type, `div`);
  assert.equal(tree.props.className, `standard`);
  assert.equal(tree.props.children.type, `span`);
  assert.equal(tree.props.children.props.style.color, `#111`);
  assert.equal(tree.props.children.props.children, `My loop`);
});

test(`render mode with the other stub branch flips exactly the stub-derived value`, async () => {
  const c: CaseFile = {
    unit: `fixture/widget`,
    chunk: `Widget.CCCC.js`,
    stubs: { "provider.DDDD.js": { source: `export const l = true;`, why: `matchMedia boolean; true branch of the pinned pair` } },
    render: {
      export: `t`,
      exportMeaning: `Widget`,
      props: {},
      context: { value: { color: { labelBase: `#111` } }, why: `theme` },
    },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  const tree = result.output as { props: { className: string; children: { props: { children: string } } } };
  assert.equal(tree.props.className, `retina`);
  assert.equal(tree.props.children.props.children, `Untitled`); // the ?? fallback on missing props.name
});

test(`chunk references resolve by basename prefix; ambiguity is loud`, async () => {
  const c: CaseFile = {
    unit: `fixture/pair`,
    chunk: `pair`, // prefix — survives hash rotation (#225 red-team R2-1)
    invoke: { export: `p`, exportMeaning: `both math variants`, args: [1, 1] },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  assert.equal(result.provenance.entry, `pair.GGGG.js`); // resolved full name in provenance
  assert.throws(() => resolveChunk(fixtureChunks, `nope`), /chunk not found in corpus: nope/);
  // math.{AAAA,ZZZZ} is the fixture hash-rotation collision: prefix must be loud
  assert.throws(() => resolveChunk(fixtureChunks, `math`), /ambiguous/);
});

test(`an ambiguous STUB key propagates, never silently drops the substitution`, async () => {
  const c: CaseFile = {
    unit: `fixture/ambiguous-stub`,
    chunk: `math.AAAA.js`,
    stubs: { math: { source: `export const n = () => 0;`, why: `ambiguity repro` } },
    invoke: { export: `n`, exportMeaning: `add`, args: [1, 1] },
  };
  await assert.rejects(runCase(fixtureCorpus, join(here, `fixtures`), c, noLog), /ambiguous/);
  // the fallback survives for a genuinely ABSENT chunk (shadow-stub)
  const shadow: CaseFile = {
    unit: `fixture/shadow-stub`,
    chunk: `math.AAAA.js`,
    stubs: { "ghost.XXXX.js": { source: `export const g = 1;`, why: `absent-chunk shadow` } },
    invoke: { export: `n`, exportMeaning: `add`, args: [1, 1] },
  };
  const ok = await runCase(fixtureCorpus, join(here, `fixtures`), shadow, noLog);
  assert.deepEqual(ok.output, { parts: [1, 1], sum: 4 });
});

test(`driver load() rejects an ambiguous prefix instead of first-match`, async () => {
  const c: CaseFile = {
    unit: `fixture/load-ambiguous`,
    chunk: `pair.GGGG.js`, // closure carries math.{AAAA,ZZZZ} — the collision
    drive: { file: `drivers/load-ambiguous.mjs`, exportMeaning: `ambiguous load repro` },
  };
  await assert.rejects(runCase(fixtureCorpus, join(here, `fixtures`), c, noLog), /load\("math"\) is ambiguous/);
});

test(`drive mode runs a hand-written driver for multi-step setups`, async () => {
  const c: CaseFile = {
    unit: `fixture/add-chained`,
    chunk: `math.AAAA.js`,
    drive: { file: `drivers/twice.mjs`, exportMeaning: `chained add: second call consumes the first's sum` },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  assert.deepEqual(result.output, {
    first: { parts: [1, 2], sum: 6 },
    second: { parts: [6, 4], sum: 20 },
  });
});

test(`stubs can live in sibling files (reviewable ESM, not escaped strings)`, async () => {
  const c: CaseFile = {
    unit: `fixture/widget`,
    chunk: `Widget`,
    stubs: { "provider.DDDD.js": { file: `stubs/flag-true.mjs`, why: `matchMedia boolean; true branch, as a reviewable sibling file` } },
    render: { export: `t`, exportMeaning: `Widget`, props: {}, context: { value: { color: { labelBase: `#111` } }, why: `theme` } },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  const tree = result.output as { props: { className: string } };
  assert.equal(tree.props.className, `retina`);
});

// --- case-file validation -------------------------------------------------------

test(`loadCase rejects a case without exactly one mode and stubs without why`, () => {
  const dir = join(here, `fixtures`);
  assert.throws(() => loadCase(join(dir, `bad-two-modes.json`)), /exactly one of "invoke" \| "render" \| "drive"/);
  assert.throws(() => loadCase(join(dir, `bad-stub.json`)), /stub "x\.js" needs exactly one of "source" \| "file", plus "why"/);
  const ok = loadCase(join(dir, `ok-case.json`));
  assert.equal(ok.unit, `fixture/add`);
});

// --- provenance: corpusHead -------------------------------------------------------

test(`gitHead never records an enclosing repo's head for a git-less copied corpus`, () => {
  // fixtures/corpus has no .git and lives inside THIS repo: the documented
  // cp -r fetch path (pipeline/README.md). Before the fix, rev-parse walked
  // up and returned this repo's own moving head, poisoning golden provenance
  // (2026-09-28: verify failed "provenance differs" on byte-identical output).
  assert.equal(gitHead(fixtureCorpus), null);
});

test(`gitHead trusts a .corpus-head marker and rejects a malformed one`, () => {
  const sha = `c5ae1ba77dfc3cf18e8b0a411ad08a4a5d5cede8`;
  const marker = join(fixtureCorpus, `.corpus-head`);
  writeFileSync(marker, `${sha}\n`);
  try {
    assert.equal(gitHead(fixtureCorpus), sha);
    writeFileSync(marker, `not-a-sha\n`);
    assert.equal(gitHead(fixtureCorpus), null);
  } finally {
    rmSync(marker, { force: true });
  }
});

test(`gitHead trusts a real corpus checkout (vault layout <repo>/corpus)`, () => {
  const vault = join(here, `fixtures`, `fake-vault.tmp`);
  rmSync(vault, { recursive: true, force: true });
  try {
    mkdirSync(join(vault, `corpus`), { recursive: true });
    execFileSync(`git`, [`-C`, vault, `init`, `-q`], { stdio: `pipe` });
    execFileSync(`git`, [`-C`, vault, `-c`, `user.email=t@t`, `-c`, `user.name=t`, `commit`, `-q`, `--allow-empty`, `-m`, `x`], { stdio: `pipe` });
    const want = execFileSync(`git`, [`-C`, vault, `rev-parse`, `HEAD`], { encoding: `utf8` }).trim();
    assert.equal(gitHead(join(vault, `corpus`)), want);
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});

// --- corpus smoke (skips without a vault corpus) ----------------------------------

test(`corpus smoke: re-derive a generateTheme shell value against the H2 goldens`, async (t) => {
  const corpus = join(here, `..`, `..`, `pipeline`, `corpus`);
  const golden = join(here, `..`, `..`, `src`, `ui-theme`, `golden`, `golden-derived-retina0.json`);
  const hasRaw = existsSync(join(corpus, `client`));
  const hasLegacyPretty = existsSync(join(corpus, `pretty`, `client`));
  if ((!hasRaw && !hasLegacyPretty) || !existsSync(golden)) {
    t.skip(`no local corpus (pipeline/corpus) — fetch per pipeline/README.md to run the smoke`);
    return;
  }
  const source = selectCorpusSource(corpus);
  if (!existsSync(join(source.chunksDir, `ThemeHelper.CeMKYPhf.js`))) {
    t.skip(`local corpus has no ThemeHelper chunk — refresh per pipeline/README.md`);
    return;
  }
  const want = JSON.parse(readFileSync(golden, `utf8`)) as Record<string, { color: Record<string, string> }>;
  const c: CaseFile = {
    unit: `ui-theme/generateTheme`,
    chunk: `ThemeHelper.CeMKYPhf.js`,
    stubs: { "ThemeProvider.BNrg3wTr.js": { source: `export const l = false;`, why: `retina pinned false = the retina0 golden file` } },
    pick: [`color`, `hash`],
    invoke: {
      export: `t.generateTheme`,
      exportMeaning: `generateTheme on the object export t (ThemeHelper.CeMKYPhf.js: export { u as n, o as t })`,
      // darkDefault preset + colorFormat RGB — the exact input the H2 golden was executed with
      args: [{ base: [5.52, 0.4, 272], accent: [47.917542332560124, 59.30267706856808, 288.42138382943733], contrast: 27, colorFormat: `RGB` }],
    },
  };
  const mod = await runCase(corpus, join(here, `fixtures`), c, noLog);
  assert.deepEqual(mod.provenance.corpusSource, { flavor: `raw`, path: `client` });
  const theme = mod.output as { color: Record<string, string>; hash: string };
  // pick projected away the live derived-theme functions; color+hash are the pinned regions
  assert.equal(theme.color[`labelBase`], want[`darkDefault`].color[`labelBase`]);
  assert.equal(theme.color[`bgSub`], want[`darkDefault`].color[`bgSub`]);
  assert.equal(theme.hash, (want[`darkDefault`] as unknown as { hash: string }).hash);
});

// --- CLI verify exit contract ------------------------------------------------

test(`verify against a malformed golden is MISMATCH exit 1, never a crash exit 2`, () => {
  const mainPath = join(here, `main.ts`);
  const casePath = join(here, `fixtures`, `ok-case.json`);
  const badGolden = join(here, `fixtures`, `bad-golden.tmp.json`);
  for (const bad of [`null`, `[1,2]`, `"just a string"`]) {
    writeFileSync(badGolden, bad);
    try {
      execFileSync(process.execPath, [`--experimental-strip-types`, mainPath, `verify`, casePath, `--corpus`, fixtureCorpus, `--expected`, badGolden], { stdio: `pipe` });
      assert.fail(`verify must not exit 0 against golden ${bad}`);
    } catch (e) {
      const err = e as { status?: number; stderr?: Buffer };
      assert.equal(err.status, 1, `golden ${bad}: want exit 1, got ${err.status}: ${err.stderr?.toString()}`);
      assert.match(err.stderr?.toString() ?? ``, /MISMATCH/);
    } finally {
      rmSync(badGolden, { force: true });
    }
  }
});
