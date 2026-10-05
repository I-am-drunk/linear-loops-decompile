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
