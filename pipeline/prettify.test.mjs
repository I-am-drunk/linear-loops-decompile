import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkPrettyDirectory, prettifyDirectory } from './prettify.mjs';

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `prettify-test-`));
  roots.push(root);
  const src = path.join(root, `client`);
  const out = path.join(root, `pretty`, `client`);
  fs.mkdirSync(src, { recursive: true });
  return { src, out };
}

test(`keeps valid beautifier output`, () => {
  const { src, out } = fixture();
  fs.writeFileSync(path.join(src, `ok.js`), `export const answer=42;`);

  const result = prettifyDirectory({ src, out, beautify: (source) => `${source}\n` });

  assert.deepEqual(result.prettified, [`ok.js`]);
  assert.deepEqual(result.rawFallback, []);
  assert.equal(fs.readFileSync(path.join(out, `ok.js`), `utf8`), `export const answer=42;\n`);
  assert.equal(checkPrettyDirectory({ src, out }).invalid.length, 0);
});

test(`falls back to validated raw source when prettifier output is invalid ESM`, () => {
  const { src, out } = fixture();
  const source = `export const answer = 42;\n`;
  fs.writeFileSync(path.join(src, `fallback.js`), source);

  const result = prettifyDirectory({ src, out, beautify: () => `export const = ;` });

  assert.deepEqual(result.prettified, []);
  assert.equal(result.rawFallback.length, 1);
  assert.equal(result.rawFallback[0].file, `fallback.js`);
  assert.equal(fs.readFileSync(path.join(out, `fallback.js`), `utf8`), source);
  assert.equal(checkPrettyDirectory({ src, out }).invalid.length, 0);
});

test(`falls back when a parse-valid candidate changes a template interpolation`, async () => {
  const { src, out } = fixture();
  const source = `const x = 7; export const text = \`value=\${x}\`;\n`;
  fs.writeFileSync(path.join(src, `template.js`), source);

  const result = prettifyDirectory({
    src,
    out,
    beautify: () => `const x = 7; export const text = \`value=$ {x}\`;\n`,
  });

  assert.equal(result.prettified.length, 0);
  assert.equal(result.rawFallback.length, 1);
  assert.match(result.rawFallback[0].reason, /template token signature/);
  const module = await import(pathToFileURL(path.join(out, `template.js`)).href);
  assert.equal(module.text, `value=7`);
});

test(`cached check rejects a parse-valid template mutation`, () => {
  const { src, out } = fixture();
  fs.writeFileSync(path.join(src, `template-cache.js`), `const x = 7; export const text = \`value=\${x}\`;\n`);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `template-cache.js`), `const x = 7; export const text = \`value=$ {x}\`;\n`);

  const result = checkPrettyDirectory({ src, out });

  assert.equal(result.valid.length, 0);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0].file, `template-cache.js`);
  assert.match(result.invalid[0].reason, /template token signature/);
});

test(`writes fallback bytes exactly, without a UTF-8 round trip`, () => {
  const { src, out } = fixture();
  // A malformed byte is harmless inside a comment after Node/Acorn decoding,
  // but would become U+FFFD if the fallback were re-encoded from text.
  const raw = Buffer.concat([Buffer.from(`// `), Buffer.from([0x80]), Buffer.from(`\nexport const answer = 42;\n`)]);
  fs.writeFileSync(path.join(src, `bytes.js`), raw);

  const result = prettifyDirectory({ src, out, beautify: () => `export const = ;` });

  assert.equal(result.rawFallback.length, 1);
  assert.deepEqual(fs.readFileSync(path.join(out, `bytes.js`)), raw);
});

test(`prunes stale pretty artifacts so output remains a raw-tree projection`, () => {
  const { src, out } = fixture();
  fs.writeFileSync(path.join(src, `current.js`), `export const current = true;`);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `retired.js`), `export const retired = true;`);

  const result = prettifyDirectory({ src, out });

  assert.deepEqual(result.staleRemoved, [`retired.js`]);
  assert.equal(fs.existsSync(path.join(out, `retired.js`)), false);
  assert.equal(fs.existsSync(path.join(out, `current.js`)), true);
});

test(`reports a stale-removal failure but continues rebuilding current files`, () => {
  const { src, out } = fixture();
  fs.writeFileSync(path.join(src, `current.js`), `export const current = true;`);
  fs.mkdirSync(out, { recursive: true });
  // rmSync without recursive cannot remove this directory, so it gives the
  // stale-cleanup path a portable failure without mocking the filesystem.
  fs.mkdirSync(path.join(out, `retired.js`));

  const result = prettifyDirectory({ src, out });

  assert.deepEqual(result.staleRemoved, []);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].file, `retired.js`);
  assert.equal(fs.existsSync(path.join(out, `current.js`)), true);
});

test(`does not count an output whose atomic rename failed as successful`, () => {
  const { src, out } = fixture();
  fs.writeFileSync(path.join(src, `write-fails.js`), `export const answer = 42;`);
  const original = fs.renameSync;
  fs.renameSync = () => { throw new Error(`rename denied`); };
  try {
    const result = prettifyDirectory({ src, out });
    assert.deepEqual(result.prettified, []);
    assert.deepEqual(result.rawFallback, []);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].file, `write-fails.js`);
    assert.equal(fs.readdirSync(out).some((name) => name.includes(`.tmp-`)), false);
  } finally {
    fs.renameSync = original;
  }
});

test(`cached parse check names missing or corrupt pretty artifacts`, () => {
  const { src, out } = fixture();
  fs.writeFileSync(path.join(src, `bad-cache.js`), `export const answer = 42;`);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `bad-cache.js`), `export const = ;`);

  const result = checkPrettyDirectory({ src, out });

  assert.equal(result.valid.length, 0);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0].file, `bad-cache.js`);
});

test(`keeps the original invalid-raw failure when stale-output cleanup also fails`, () => {
  const { src, out } = fixture();
  fs.writeFileSync(path.join(src, `invalid-raw.js`), `export const = ;`);
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(path.join(out, `invalid-raw.js`));

  const result = prettifyDirectory({ src, out });

  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].file, `invalid-raw.js`);
  assert.match(result.failed[0].reason, /Unexpected token/);
});

test(`fails instead of retaining an output when raw source is invalid`, () => {
  const { src, out } = fixture();
  fs.writeFileSync(path.join(src, `invalid-raw.js`), `export const = ;`);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, `invalid-raw.js`), `stale output`);

  const result = prettifyDirectory({ src, out });

  assert.equal(result.failed.length, 1);
  assert.equal(fs.existsSync(path.join(out, `invalid-raw.js`)), false);
});

test(`cached check verifies a raw fallback as bytes, catching non-UTF-8 corruption`, () => {
  const { src, out } = fixture();
  // A raw source with an invalid UTF-8 byte still parses as decoded text
  // (U+FFFD lands inside a string literal), mirroring the real captured corpus.
  const rawBytes = Buffer.concat([
    Buffer.from('export const blob = `'),
    Buffer.from([0x80]),
    Buffer.from('`;\n'),
  ]);
  fs.writeFileSync(path.join(src, `bytes.js`), rawBytes);
  fs.mkdirSync(out, { recursive: true });

  // Byte-identical cached fallback: valid.
  fs.writeFileSync(path.join(out, `bytes.js`), rawBytes);
  let result = checkPrettyDirectory({ src, out });
  assert.equal(result.invalid.length, 0);

  // A parse-valid mutation of the template content must be rejected: the
  // cached file no longer byte-matches raw, so it is held to the prettified
  // bar (parse + template signature) and the changed quasi fails it.
  fs.writeFileSync(path.join(out, `bytes.js`), Buffer.from('export const blob = `X`;\n'));
  result = checkPrettyDirectory({ src, out });
  assert.equal(result.invalid.length, 1);
  assert.match(result.invalid[0].reason, /template token signature/);
});

test(`build rejects a parse-valid NON-template lexical mutation (wide token gate)`, () => {
  const { src, out } = fixture();
  fs.writeFileSync(path.join(src, `ident.js`), `export const value = compute(1);\nfunction compute(n) { return n + 1 }\n`);
  const result = prettifyDirectory({
    src,
    out,
    // Parse-valid, template-free mutation: a renamed identifier. The old
    // template-only signature passed this; the full token signature must not.
    beautify: () => `export const value = compute(2);\nfunction compute(n) { return n + 1 }\n`,
  });
  assert.equal(result.failed.length, 0);
  assert.equal(result.rawFallback.length, 1);
  assert.match(result.rawFallback[0].reason, /token signature/);
  assert.equal(
    fs.readFileSync(path.join(out, `ident.js`), `utf8`),
    fs.readFileSync(path.join(src, `ident.js`), `utf8`),
  );
});
