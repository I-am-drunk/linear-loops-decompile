/**
 * Tests for the ui-facts checker — built on fixtures, so they encode the
 * actual failures this tool exists to catch. Each case is a real mistake
 * from the 2026-10-04 shell: no facts file, uncited values, a hand-picked hex.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHECKER = new URL('./main.mjs', import.meta.url).pathname;

function run(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uifacts-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  try {
    const out = execFileSync('node', [CHECKER, dir], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout ?? '') + (e.stderr ?? '') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('no UI packages: passes and says so', () => {
  const r = run({ 'src/server/index.ts': 'export const x = 1' });
  assert.equal(r.code, 0);
  assert.match(r.out, /no UI packages/);
});

test('UI package with no ui-facts.json FAILS (the 2026-10-04 shell)', () => {
  const r = run({ 'src/ui/shell.css.ts': 'export const C = `.a{width:220px}`' });
  assert.equal(r.code, 1);
  assert.match(r.out, /no ui-facts\.json/);
});

test('a value absent from ui-facts.json FAILS with its line number', () => {
  const r = run({
    'src/ui/shell.css.ts': 'export const C = `\n.a{width:220px}\n.b{padding:28px}\n`',
    'src/ui/ui-facts.json': JSON.stringify({
      facts: [{ name: 'sidebar width', value: '220px', cite: '.sx-16grhtn' }],
    }),
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /`28px` is not in ui-facts\.json/);
  assert.doesNotMatch(r.out, /`220px` is not in/, 'the cited value must pass');
  assert.match(r.out, /shell\.css\.ts:3/, 'must name the line');
});

test('a fully declared stylesheet PASSES', () => {
  const r = run({
    'src/ui/shell.css.ts': 'export const C = `\n.a{width:220px;padding:6px}\n`',
    'src/ui/ui-facts.json': JSON.stringify({
      facts: [
        { name: 'sidebar width', value: '220px', cite: '.sx-16grhtn' },
        { name: 'nav item padding', value: '6px', cite: '.sx-11iknt3' },
      ],
    }),
  });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /every value declared and cited/);
});

test('colour literals FAIL even when declared', () => {
  for (const colour of ['#09090a', 'rgb(9,9,10)', 'oklch(0.2 0 0)']) {
    const r = run({
      'src/ui/shell.css.ts': `export const C = \`.a{background:${colour}}\``,
      'src/ui/ui-facts.json': JSON.stringify({ facts: [{ name: 'bg', value: colour, cite: 'x' }] }),
    });
    assert.equal(r.code, 1, colour);
    assert.match(r.out, /colour literal/);
  }
});

test('an uncited fact FAILS; UNVERIFIED is allowed without a citation', () => {
  const bad = run({
    'src/ui/shell.css.ts': 'export const C = `.a{width:220px}`',
    'src/ui/ui-facts.json': JSON.stringify({ facts: [{ name: 'w', value: '220px' }] }),
  });
  assert.equal(bad.code, 1);
  assert.match(bad.out, /no citation/);

  // UNVERIFIED is the honest escape hatch — but it does NOT license the value,
  // so the CSS must not use it.
  const ok = run({
    'src/ui/shell.css.ts': 'export const C = `.a{color:var(--t-label-base)}`',
    'src/ui/ui-facts.json': JSON.stringify({
      facts: [{ name: 'sidebar width', value: '220px', label: 'UNVERIFIED' }],
    }),
  });
  assert.equal(ok.code, 0, ok.out);
});

test('structural values (0, 1px, 100%) need no citation', () => {
  const r = run({
    'src/ui/shell.css.ts': 'export const C = `.a{inset:0;border-width:1px;width:100%;height:100vh}`',
    'src/ui/ui-facts.json': JSON.stringify({ facts: [{ name: 'x', value: 'n/a', cite: 'n/a' }] }),
  });
  assert.equal(r.code, 0, r.out);
});

test('malformed ui-facts.json FAILS loudly, not silently', () => {
  const r = run({
    'src/ui/shell.css.ts': 'export const C = `.a{width:220px}`',
    'src/ui/ui-facts.json': '{ not json',
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /not valid JSON/);
});

test('an empty facts list FAILS — a stub is not a declaration', () => {
  const r = run({
    'src/ui/shell.css.ts': 'export const C = `.a{width:220px}`',
    'src/ui/ui-facts.json': JSON.stringify({ facts: [] }),
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /zero facts/);
});

test('comment lines are prose, not claims', () => {
  const r = run({
    'src/ui/shell.css.ts': '// the sidebar is 220px wide and #09090a\nexport const C = `.a{color:var(--t-x)}`',
    'src/ui/ui-facts.json': JSON.stringify({ facts: [{ name: 'x', value: 'n/a', cite: 'n/a' }] }),
  });
  assert.equal(r.code, 0, r.out);
});
