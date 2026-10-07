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
import { fileURLToPath } from 'node:url';

const CHECKER = fileURLToPath(new URL('./check-links.mjs', import.meta.url));

function run(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chklinks-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  try {
    // stdio: stderr PIPED, not inherited. execFileSync forwards a child's
    // stderr to the parent AND captures it in e.stderr, so without this the
    // fixtures' deliberate "check-links: FAIL" banners print into
    // ci/check-src.sh's log beside the ✔ that asserts them — and the log stops
    // being greppable for real failures (issue #351). The assertions below
    // read e.stderr, which piping fills, so nothing is lost.
    return {
      code: 0,
      out: execFileSync('node', [CHECKER, dir], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    };
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

test('nested archive and corpus docs are checked; root historical directories are skipped', () => {
  for (const dir of ['docs/archive', 'docs/corpus']) {
    const bad = run({ [`${dir}/live.md`]: 'Read `docs/missing.md`.' });
    assert.equal(bad.code, 1, bad.out);
    assert.match(bad.out, /missing\.md` does not exist/);
  }
  const ok = run({
    'archive/old.md': 'Read `docs/missing.md`.',
    'corpus/vendor.md': 'Read `docs/missing.md`.',
    'pipeline/corpus/vendor.md': 'Read `docs/missing.md`.',
  });
  assert.equal(ok.code, 0, ok.out);
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


// --- issue #351 regression ------------------------------------------------
// The fixtures above deliberately fail. With stderr INHERITED, each one
// printed a "check-links: FAIL" banner into ci/check-src.sh's log beside the
// ✔ that asserts it, so the log could not be triaged by grepping for FAIL.
//
// execFileSync both captures a child's stderr in e.stderr AND forwards it to
// the parent; piping stops the forwarding without losing the capture, which
// is why run() above sets stdio. This test reads run()'s own source and
// requires that option to still be there — asserting on output cannot
// distinguish piped from inherited, because e.stderr is filled either way.
test('run() pipes child stderr — else fixtures leak into the CI log (#351)', () => {
  const src = fs.readFileSync(new URL(import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function run('), src.indexOf('test('));
  assert.match(
    body,
    /stdio:\s*\[[^\]]*['"]pipe['"]\s*\]/,
    'run() must pass stdio with stderr piped',
  );
});
