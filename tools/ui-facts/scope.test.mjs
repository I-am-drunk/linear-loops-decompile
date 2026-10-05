import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scopeCovers, selectorTracker, looksLikeSelector } from './scope.mjs';

test('scopeCovers matches a selector containing the scope verbatim', () => {
  assert.equal(scopeCovers(['.btn'], '.btn'), true);
  assert.equal(scopeCovers(['.btn'], '.btn[data-size="small"]'), true);
  assert.equal(scopeCovers(['.doc'], '.doc h1'), true);
});

test('scopeCovers rejects a different selector', () => {
  assert.equal(scopeCovers(['.input'], '.btn'), false);
  assert.equal(scopeCovers(['.doc'], '.btn'), false);
});

test('scopeCovers treats a missing or empty scope as no coverage', () => {
  assert.equal(scopeCovers(undefined, '.btn'), false);
  assert.equal(scopeCovers([], '.btn'), false);
  assert.equal(scopeCovers([''], '.btn'), false);
});

test('any one entry in a scope list is enough', () => {
  assert.equal(scopeCovers(['.a', '.btn'], '.btn'), true);
});

test('the tracker names a multi-line rule on every line', () => {
  const next = selectorTracker();
  assert.equal(next('.btn {'), '.btn');
  assert.equal(next('  gap: 6px;'), '.btn');
  assert.equal(next('}'), '.btn');
});

test('the tracker names a single-line rule', () => {
  const next = selectorTracker();
  assert.equal(next('.doc h1 { font-size: 1.375rem; }'), '.doc h1');
});

test('the tracker keeps attribute and comma selectors intact', () => {
  assert.equal(
    selectorTracker()('.btn[data-size="small"] { height: 24px; }'),
    '.btn[data-size="small"]',
  );
  assert.equal(
    selectorTracker()('.doc ul, .doc ol { padding-left: 1.5rem; }'),
    '.doc ul, .doc ol',
  );
});

test('the tracker ABSTAINS inside an at-rule rather than guessing', () => {
  // Returning '' makes leg 6 skip the line. A nested rule therefore goes
  // unchecked — a known limitation, preferred over a wrong accusation.
  const next = selectorTracker();
  assert.equal(next('@media (min-width: 700px) {'), '');
  assert.equal(next('  .x { width: 10px; }'), '');
});

// --- looksLikeSelector (#360 follow-up) ---------------------------------
// The gate scans .ts files, so the tracker meets code as well as CSS. Both
// cases below are real failures found by running it, not hypotheticals.

test('a TypeScript declaration is not a selector', () => {
  assert.equal(
    looksLikeSelector('export const BUTTON_SIZES: Readonly<Record<A, B>> ='),
    false,
  );
  assert.equal(looksLikeSelector('function f()'), false);
  assert.equal(looksLikeSelector('const x ='), false);
});

test('an attribute selector IS a selector, despite containing =', () => {
  // Rejecting `=` outright killed every attribute selector.
  assert.equal(looksLikeSelector('.btn[data-size="small"]'), true);
  assert.equal(looksLikeSelector('[data-open=true]'), true);
});

test('ordinary selectors still pass', () => {
  for (const s of ['.btn', '.doc h1', '.doc ul, .doc ol', 'html, body', '*']) {
    assert.equal(looksLikeSelector(s), true, s);
  }
});

test('an at-rule is not a selector', () => {
  assert.equal(looksLikeSelector('@media (min-width: 700px)'), false);
});
