import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from './strip-comments.mjs';

function strip(line, inBlock = false) {
  return stripComments(line, inBlock);
}

test('a plain code line is returned unchanged', () => {
  const r = strip('  .x { width: 10px; }');
  assert.equal(r.code, '  .x { width: 10px; }');
  assert.equal(r.stillInBlock, false);
});

test('a // comment is cut, code before it kept', () => {
  const r = strip('.x{width:10px} // ignore 220px here');
  assert.equal(r.code, '.x{width:10px} ');
  assert.equal(r.stillInBlock, false);
});

test('quoted strings and CSS URLs preserve comment-looking data', () => {
  for (const line of [
    '.x{background:url(https://example.com/image);width:777px}',
    '.x{background:url( //example.com/image );width:777px}',
    '.x{background:URL("https://example.com/image");width:777px}',
    'const text = "/* data */ // data"; .x{width:777px}',
    String.raw`const text = "escaped \" // data"; .x{width:777px}`,
  ]) {
    assert.deepEqual(strip(line), { code: line, stillInBlock: false });
  }
  assert.equal(strip('.x{background:url(https://example.com)} // prose 220px').code,
    '.x{background:url(https://example.com)} ');
});

test('an unclosed /* opens a block and blanks the rest', () => {
  const r = strip('code; /* prose 220px');
  assert.equal(r.code, 'code; ');
  assert.equal(r.stillInBlock, true);
});

test('a continuation line inside a block yields no code', () => {
  const r = strip('   more prose 111px', true);
  assert.equal(r.code, '');
  assert.equal(r.stillInBlock, true);
});
