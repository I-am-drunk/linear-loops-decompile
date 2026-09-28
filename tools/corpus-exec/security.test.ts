import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { buildSandbox } from "./sandbox.ts";
import { runCase } from "./run.ts";
import { deserialize, serialize } from "./serialize.ts";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "corpus-security-"));
  const chunks = join(dir, "client");
  mkdirSync(chunks);
  return { dir, chunks, clean: () => rmSync(dir, { recursive: true, force: true }) };
}

test("closure rejects traversal keys/imports and ignores comment/string import lookalikes", () => {
  const f = fixture();
  try {
    writeFileSync(join(f.chunks, "entry.js"), `// import "./../../escaped.js"\nconst text = 'from "./../../escaped.js"'; export const value = 1;`);
    for (const name of ["../escaped.js", "./../escaped.js", "a/../../escaped.js", "/tmp/escaped.js", "a\\escaped.js"]) {
      assert.throws(() => buildSandbox(f.chunks, f.dir, "entry.js", { [name]: { source: "", why: "attack" } }), /unsafe/);
    }
    const closure = buildSandbox(f.chunks, f.dir, "entry.js", {});
    assert.deepEqual(closure.chunks, ["entry.js"]);
    rmSync(closure.dir, { recursive: true });
    for (const source of [
      `import './../escaped.js';`, `export { x } from './a/../../escaped.js';`,
      `import('./../escaped.js');`, `import('node:fs');`, `import(globalThis.target);`,
    ]) {
      writeFileSync(join(f.chunks, "entry.js"), source);
      assert.throws(() => buildSandbox(f.chunks, f.dir, "entry.js", {}), /unsafe|literal relative/);
    }
    writeFileSync(join(f.chunks, "entry.js"), `export { x } from './dep.js'; import('./dep.js');`);
    writeFileSync(join(f.chunks, "dep.js"), `export const x = 1;`);
    const actual = buildSandbox(f.chunks, f.dir, "entry.js", {});
    assert.deepEqual(actual.chunks, ["dep.js", "entry.js"]);
    rmSync(actual.dir, { recursive: true });
  } finally { f.clean(); }
});

test("stub/driver source and corpus symlinks cannot escape their declared roots", async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.chunks, "entry.js"), "export const x = 1;");
    writeFileSync(join(f.dir, "outside.mjs"), "export const x = 2;");
    mkdirSync(join(f.dir, "cases"));
    symlinkSync(join(f.dir, "outside.mjs"), join(f.dir, "cases", "stub.mjs"));
    assert.throws(() => buildSandbox(f.chunks, join(f.dir, "cases"), "entry.js", {
      "entry.js": { file: "stub.mjs", why: "symlink" },
    }), /escapes/);
    await assert.rejects(runCase(f.dir, join(f.dir, "cases"), {
      unit: "escape", chunk: "entry.js", drive: { file: "../outside.mjs", exportMeaning: "escape" },
    }, () => {}), /escapes/);
    symlinkSync(join(f.dir, "outside.mjs"), join(f.chunks, "escape.js"));
    assert.throws(() => buildSandbox(f.chunks, f.dir, "escape.js", {}), /escapes/);
  } finally { f.clean(); }
});

test("captured code cannot access host files, credentials, subprocesses or host network", async () => {
  const f = fixture();
  const server = createServer((_req, res) => { res.end("host"); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const secret = join(f.dir, "secret");
  writeFileSync(secret, "synthetic-secret");
  const previous = process.env.CORPUS_SECURITY_SENTINEL;
  process.env.CORPUS_SECURITY_SENTINEL = "synthetic-secret";
  try {
    writeFileSync(join(f.chunks, "entry.js"), `
      export async function probe() {
        const denied = (fn) => { try { fn(); return false; } catch { return true; } };
        const fs = process.getBuiltinModule('fs');
        const result = {
          environment: process.env.CORPUS_SECURITY_SENTINEL === undefined,
          read: denied(() => fs.readFileSync(${JSON.stringify(secret)})),
          write: denied(() => fs.writeFileSync(${JSON.stringify(secret)}, 'changed')),
          corpusWrite: denied(() => fs.writeFileSync('/chunks/entry.js', 'changed')),
          spawn: denied(() => process.getBuiltinModule('child_process').execFileSync('/bin/node', ['-e', '0'])),
          binding: denied(() => process.binding('fs')),
        };
        try { await fetch('http://127.0.0.1:${port}', { signal: AbortSignal.timeout(1000) }); result.network = false; }
        catch { result.network = true; }
        return result;
      }`);
    writeFileSync(join(f.dir, "driver.mjs"), `export default async ({entry}) => entry.probe();`);
    const result = await runCase(f.dir, f.dir, { unit: "isolation", chunk: "entry.js", drive: { file: "driver.mjs", exportMeaning: "isolation probe" } }, () => {});
    assert.deepEqual(result.output, { environment: true, read: true, write: true, corpusWrite: true, spawn: true, binding: true, network: true });
    assert.equal(readFileSync(secret, "utf8"), "synthetic-secret");
  } finally {
    if (previous === undefined) delete process.env.CORPUS_SECURITY_SENTINEL;
    else process.env.CORPUS_SECURITY_SENTINEL = previous;
    server.close(); f.clean();
  }
});

test("tagged process transport preserves supported output distinctions", () => {
  const obj = Object.create(null);
  Object.defineProperty(obj, "__proto__", { value: "data", enumerable: true, writable: true, configurable: true });
  const values = [undefined, -0, NaN, Infinity, -Infinity, 12n, new Date("2026-01-01"), [1, , 3], obj,
    { $$typeof: Symbol.for("react.element"), type: "div", key: null, props: { children: "text" } }];
  for (const value of values) assert.deepEqual(serialize(deserialize(JSON.parse(JSON.stringify(serialize(value))))), serialize(value));
  assert.throws(() => deserialize({ tag: "unknown" }), /invalid serialized/);
});
