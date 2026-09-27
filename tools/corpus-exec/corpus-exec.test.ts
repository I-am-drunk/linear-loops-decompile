/**
 * G1 tests — run on the miniature fixture corpus (fixtures/corpus), no vault
 * needed. With a real corpus present (pipeline/corpus), one smoke case
 * re-derives a generateTheme value and compares it against the H2 goldens;
 * without one that test skips with a pointer.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { expectedBytes, loadCase, runCase, type CaseFile } from "./run.ts";
import { buildSandbox, closureSize, resolveChunk } from "./sandbox.ts";
import { serialize, stringify } from "./serialize.ts";

const here = fileURLToPath(new URL(`.`, import.meta.url));
const fixtureCorpus = join(here, `fixtures`, `corpus`);
const fixtureChunks = join(fixtureCorpus, `pretty`, `client`);
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

test(`closureSize probes without building`, () => {
  assert.equal(closureSize(fixtureChunks, `math.AAAA.js`, {}), 2);
  assert.equal(closureSize(fixtureChunks, `Widget.CCCC.js`, { "provider.DDDD.js": { source: ``, why: `` } }), 3);
});

// --- serialize ---------------------------------------------------------------

test(`serialization is deterministic and sorts keys`, () => {
  const a = stringify({ b: 2, a: [1, { d: 4, c: 3 }] });
  const b = stringify({ a: [1, { c: 3, d: 4 }], b: 2 });
  assert.equal(a, b);
});

test(`functions outside elements are a loud error`, () => {
  assert.throws(() => serialize({ cb: () => 1 }), /unserializable function at \$\.cb/);
});

test(`composite element children serialize as named boundaries, never silently render`, () => {
  const Comp = function Inner(): null { return null; };
  const el = { $$typeof: Symbol.for(`react.fake`), type: Comp, props: {} };
  assert.deepEqual(serialize(el), { $composite: `Inner` });
});

// --- run: invoke mode ---------------------------------------------------------

test(`invoke mode executes the corpus function on case args`, async () => {
  const c: CaseFile = {
    unit: `fixture/add`,
    chunk: `math.AAAA.js`,
    invoke: { export: `n`, exportMeaning: `add (math.AAAA.js: export { add as n })`, args: [2, 3] },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  assert.deepEqual(serialize(result.output), { parts: [2, 3], sum: 10 });
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
  assert.deepEqual(serialize(result.output), {
    $element: true,
    type: `div`,
    props: { className: `standard` },
    children: {
      $element: true,
      type: `span`,
      props: { style: { color: `#111` } },
      children: `My loop`,
    },
  });
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
  const tree = serialize(result.output) as { props: { className: string }; children: { children: string } };
  assert.equal(tree.props.className, `retina`);
  assert.equal(tree.children.children, `Untitled`); // the ?? fallback on missing props.name
});

test(`chunk references resolve by basename prefix; ambiguity is loud`, async () => {
  const c: CaseFile = {
    unit: `fixture/add`,
    chunk: `math`, // prefix — survives hash rotation (#225 red-team R2-1)
    invoke: { export: `n`, exportMeaning: `add`, args: [1, 1] },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  assert.equal(result.provenance.entry, `math.AAAA.js`); // resolved full name in provenance
  assert.throws(() => resolveChunk(fixtureChunks, `nope`), /chunk not found in corpus: nope/);
});

test(`drive mode runs a hand-written driver for multi-step setups`, async () => {
  const c: CaseFile = {
    unit: `fixture/add-chained`,
    chunk: `math.AAAA.js`,
    drive: { file: `drivers/twice.mjs`, exportMeaning: `chained add: second call consumes the first's sum` },
  };
  const result = await runCase(fixtureCorpus, join(here, `fixtures`), c, noLog);
  assert.deepEqual(serialize(result.output), {
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
  const tree = serialize(result.output) as { props: { className: string } };
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

// --- corpus smoke (skips without a vault corpus) ----------------------------------

test(`corpus smoke: re-derive a generateTheme shell value against the H2 goldens`, async (t) => {
  const corpus = join(here, `..`, `..`, `pipeline`, `corpus`);
  const golden = join(here, `..`, `..`, `src`, `ui-theme`, `golden`, `golden-derived-retina0.json`);
  if (!existsSync(join(corpus, `pretty`, `client`, `ThemeHelper.CeMKYPhf.js`)) || !existsSync(golden)) {
    t.skip(`no local corpus (pipeline/corpus) — fetch per pipeline/README.md to run the smoke`);
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
  const theme = mod.output as { color: Record<string, string>; hash: string };
  // pick projected away the live derived-theme functions; color+hash are the pinned regions
  assert.equal(theme.color[`labelBase`], want[`darkDefault`].color[`labelBase`]);
  assert.equal(theme.color[`bgSub`], want[`darkDefault`].color[`bgSub`]);
  assert.equal(theme.hash, (want[`darkDefault`] as unknown as { hash: string }).hash);
});
