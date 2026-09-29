/**
 * remap-graph tests — synthetic mini-corpus only (no Linear material):
 * covers the three import forms, closure and monster-blocking, the
 * vendor/app split, fan-in counting, and demanded-export extraction.
 */

import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { analyze, closure, demandedExports, extractImports, isVendorName, loadGraph, type RootsConfig } from "./graph.ts";
import { renderJson, renderMarkdown } from "./render.ts";

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), `remap-graph-`));
  // Root page: static + dynamic + side-effect imports; pulls from the monster.
  writeFileSync(
    join(dir, `Page.AAAA1111.js`),
    `import{o as e}from"./runtime.RRRR0000.js";import{Pa as t,Qb as u}from"./Monster.MMMM9999.js";import"./sideEffect.SSSS2222.js";const L=()=>import("./Lazy.LLLL3333.js");export{L as Component};`,
  );
  // Lazy chunk imports a shared primitive and the monster (different symbols, aliased).
  writeFileSync(
    join(dir, `Lazy.LLLL3333.js`),
    `import{t as n}from"./Prim.PPPP4444.js";import{Pa as a,Zz as b}from"./Monster.MMMM9999.js";export{n as t};`,
  );
  writeFileSync(join(dir, `sideEffect.SSSS2222.js`), `import{t as n}from"./Prim.PPPP4444.js";n();`);
  writeFileSync(join(dir, `Prim.PPPP4444.js`), `export{a as t};const a=1;`);
  writeFileSync(join(dir, `runtime.RRRR0000.js`), `export{o};const o={};`);
  // Monster: big export surface; also the sole importer of a hidden leaf.
  writeFileSync(
    join(dir, `Monster.MMMM9999.js`),
    `import{h}from"./HiddenLeaf.HHHH5555.js";export{a as Pa,b as Qb,c as Zz,d as Ww,e as Vv};const a=1,b=2,c=3,d=4,e=5;`,
  );
  writeFileSync(join(dir, `HiddenLeaf.HHHH5555.js`), `export{h};const h=9;`);
  // Unreachable chunk: must stay out of every closure.
  writeFileSync(join(dir, `Elsewhere.EEEE6666.js`), `export{x};const x=0;`);
  return dir;
}

const CONFIG: RootsConfig = {
  rationale: `test`,
  roots: [`Page.AAAA1111.js`, `Missing.XXXX0000.js`],
  monsters: [`Monster.MMMM9999.js`],
  fanInTop: 10,
};

test(`extractImports sees static, side-effect, and dynamic forms`, () => {
  const s = `import{a}from"./x.js";import"./y.js";const p=()=>import("./z.js");`;
  assert.deepEqual([...extractImports(s)].sort(), [`x.js`, `y.js`, `z.js`]);
});

test(`vendor rule: lowercase first char`, () => {
  assert.equal(isVendorName(`react.Bfm.js`), true);
  assert.equal(isVendorName(`Flex.BS49.js`), false);
});

test(`closure walks all edge forms and monster-blocking prunes the hidden leaf`, () => {
  const g = loadGraph(fixtureDir());
  const full = closure(g, [`Page.AAAA1111.js`], new Set());
  assert.equal(full.size, 7); // everything but Elsewhere
  assert.ok(full.has(`HiddenLeaf.HHHH5555.js`));
  const blocked = closure(g, [`Page.AAAA1111.js`], new Set([`Monster.MMMM9999.js`]));
  assert.equal(blocked.size, 5); // minus Monster and its exclusive leaf
  assert.ok(!blocked.has(`HiddenLeaf.HHHH5555.js`));
  assert.ok(!blocked.has(`Elsewhere.EEEE6666.js`));
});

test(`demandedExports collects original names across importers and counts the monster's surface`, () => {
  const g = loadGraph(fixtureDir());
  const asm = closure(g, [`Page.AAAA1111.js`], new Set([`Monster.MMMM9999.js`]));
  const d = demandedExports(g, `Monster.MMMM9999.js`, asm);
  assert.deepEqual(d.demanded, [`Pa`, `Qb`, `Zz`]); // union over Page + Lazy, originals not aliases
  assert.equal(d.totalExports, 5);
  assert.deepEqual(d.importers, [`Lazy.LLLL3333.js`, `Page.AAAA1111.js`]);
});

test(`analyze: splits, fan-in, missing roots, and renderers stay consistent`, () => {
  const g = loadGraph(fixtureDir());
  const a = analyze(g, CONFIG, `deadbeef`);
  assert.deepEqual(a.missingRoots, [`Missing.XXXX0000.js`]);
  assert.equal(a.fullClosure.chunks, 7);
  assert.equal(a.assembly.chunks, 5);
  assert.equal(a.monsterOnly.chunks, 1); // HiddenLeaf
  assert.equal(a.vendor.chunks, 2); // runtime + sideEffect
  assert.equal(a.app.chunks, 3); // Page, Lazy, Prim
  // Prim is imported by Lazy AND sideEffect within the assembly set.
  const prim = a.fanIn.find((f) => f.chunk === `Prim.PPPP4444.js`);
  assert.equal(prim?.importers, 2);
  assert.equal(a.demands.length, 1);
  assert.equal(a.demands[0]?.demanded.length, 3);
  const md = renderMarkdown(a);
  assert.ok(md.includes(`deadbeef`));
  assert.ok(md.includes(`MISSING from this corpus`));
  assert.ok(md.includes(`| \`Monster.MMMM9999.js\` | 5 | 3 | 2 |`));
  const parsed = JSON.parse(renderJson(a)) as { assembly: { chunks: number } };
  assert.equal(parsed.assembly.chunks, 5);
});
