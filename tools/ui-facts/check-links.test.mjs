/**
 * Tests for check-links. Each case is a real failure this repo shipped:
 * a pointer to a deleted doc, a stale corpus chunk path, an audit whose
 * paths describe an older tree.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHECKER = new URL('./check-links.mjs', import.meta.url).pathname;

function run(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chklinks-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  try {
    return { code: 0, out: execFileSync('node', [CHECKER, dir], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: (e.stdout ?? '') + (e.stderr ?? '') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('a pointer to a deleted doc FAILS (the PROVENANCE.md case)', () => {
  const r = run({ 'README.md': 'Read `docs/PROVENANCE.md` first.' });
  assert.equal(r.code, 1);
  assert.match(r.out, /PROVENANCE\.md` does not exist/);
});

test('a pointer to a real file PASSES', () => {
  const r = run({
    'README.md': 'See `ci/check-ui.sh`.',
    'ci/check-ui.sh': '#!/bin/sh\n',
  });
  assert.equal(r.code, 0, r.out);
});

test('HISTORICAL RECORD opts a doc out of checking', () => {
  const r = run({
    'docs/audit.md':
      '# Audit\n\n> **HISTORICAL RECORD (2026-09-27).** Paths are as they were.\n\nSee `src/ui/gone.ts`.',
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /HISTORICAL RECORD/);
});

test('a corpus path is UNCHECKED and counted when no corpus is present', () => {
  const r = run({
    'docs/ref.md': 'Theme lives in `pipeline/corpus/client/Totally.FAKE1234.js`.',
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /UNCHECKED/, 'the skip must be reported, not hidden');
  assert.match(r.out, /pipeline\/run\.sh/, 'and must say how to make it checkable');
});

test('WITH a corpus, a real chunk passes and a bogus one FAILS', () => {
  // The case peer e8 raised: an unconditional skip hides stale pinned chunks,
  // which is exactly the rot issue #330 tracks.
  const ok = run({
    'pipeline/corpus/client/Real.ABCD1234.js': '//\n',
    'docs/ref.md': 'See `pipeline/corpus/client/Real.ABCD1234.js`.',
  });
  assert.equal(ok.code, 0, ok.out);

  const bad = run({
    'pipeline/corpus/client/Real.ABCD1234.js': '//\n',
    'docs/ref.md': 'See `pipeline/corpus/client/Stale.OLDHASH1.js`.',
  });
  assert.equal(bad.code, 1, 'a stale pin must fail when the corpus is present');
  assert.match(bad.out, /Stale\.OLDHASH1\.js` does not exist/);
});

