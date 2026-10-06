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
import { fileURLToPath } from 'node:url';

const CHECKER = fileURLToPath(new URL('./main.mjs', import.meta.url));

function run(files, prepare) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uifacts-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  // `prepare` can mutate the fixture after it is written -- chmod for the
  // unreadable-corpus case, which no file-contents map can express.
  if (prepare) prepare(dir);
  try {
    // stdio: stderr PIPED, not inherited — see the same note in
    // check-links.test.mjs. Seven of these fixtures deliberately fail, and
    // inherited stderr printed seven "ui-facts: FAIL" banners into the CI log
    // next to the ✔ that asserts them (issue #351). e.stderr still gets them.
    const out = execFileSync('node', [CHECKER, dir], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
  const r = run({
    'src/ui/shell.css.ts': 'export const C = `.a{width:220px}`',
    'src/ui/package.json': '{"name":"ui","ui":true}',
  });
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

test('uppercase and exponent CSS dimensions cannot bypass declarations', () => {
  for (const [value, canonical] of [['777PX', '777px'], ['1e3px', '1000px']]) {
    const r = run({
      'src/ui/style.css': `.a{width:${value}}`,
      'src/ui/ui-facts.json': JSON.stringify({ facts: [{ name: 'x', value: 'n/a', cite: 'fixture' }] }),
    });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, new RegExp('`' + canonical + '` is not in'));
  }
});

test('equivalent numbers and units share declarations and scopes', () => {
  for (const value of ['4.0px', '+4PX', '4e0px']) {
    const r = run({
      'src/ui/style.css': `.a{width:${value}}`,
      'src/ui/ui-facts.json': JSON.stringify({
        facts: [{ name: 'width', value: '4px', cite: 'fixture', scope: ['.a'] }],
      }),
    });
    assert.equal(r.code, 0, r.out);
  }
  const bad = run({
    'src/ui/style.css': '.other{width:4.0PX}',
    'src/ui/ui-facts.json': JSON.stringify({
      facts: [{ name: 'width', value: '+4px', cite: 'fixture', scope: ['.a'] }],
    }),
  });
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /is used in `\.other`/);
});

test('identifier suffixes are not dimensions, but negative values still need citation', () => {
  const facts = JSON.stringify({ facts: [{ name: 'width', value: '4px', cite: 'fixture' }] });
  const ok = run({
    'src/ui/style.css': '.a{--offset-777px:var(--other);width:var(--offset-777px)}',
    'src/ui/ui-facts.json': facts,
  });
  assert.equal(ok.code, 0, ok.out);
  const bad = run({
    'src/ui/style.css': '.a{margin-left:-4px}',
    'src/ui/ui-facts.json': facts,
  });
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /`-4px` is not in/);
});

test('leg 5 compares equivalent numeric spellings against the corpus', () => {
  const r = run({
    'pipeline/corpus/style/style-fixture.css': '--editor-h5-font-size:.875rem;',
    'src/ui/style.css': '.h{font-size:0.875REM}',
    'src/ui/ui-facts.json': JSON.stringify({
      facts: [{ name: 'settings heading size', value: '+0.875rem', cite: 'fixture' }],
    }),
  });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /does not support the claim/);
});

test('URL slashes cannot hide an uncited CSS value later on the line', () => {
  for (const url of ['https://example.com/image', '//example.com/image', '"https://example.com/image"']) {
    const r = run({
      'src/ui/style.css.ts': `export const C = \`.a{background:url(${url});width:777px}\``,
      'src/ui/ui-facts.json': JSON.stringify({ facts: [{ name: 'x', value: 'n/a', cite: 'fixture' }] }),
    });
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /`777px` is not in/);
  }
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

test('a style.ts stylesheet is NOT a bypass (sess 89 finding)', () => {
  // Keying detection on *.css.ts let a package using style.ts skip the gate
  // entirely. Declared packages are scanned by source file, not by filename.
  const r = run({
    'src/ui/style.ts': 'export const C = `.a{width:220px;border-radius:5px}`',
    'src/ui/package.json': '{"name":"ui","ui":true}',
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /no ui-facts\.json/);
});

test('an UNDECLARED package shipping a stylesheet FAILS', () => {
  // Declaration-based detection has a limit: declare nothing, be invisible.
  // So a file NAMED like a stylesheet demands a declaration.
  const r = run({
    'src/ui-sneaky/style.ts': 'export const C = `.a{width:220px}`',
    'src/ui-sneaky/package.json': '{"name":"ui-sneaky"}',
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /declares no UI/);
});

test('a non-UI package with CSS-looking TS is NOT flagged', () => {
  // Content-sniffing flagged all 27 packages: { ".html": "text/html" } in
  // src/server/http.ts and a `color:` property in the theme generator are
  // indistinguishable from CSS without a parser.
  const r = run({
    'src/server/http.ts': 'const TYPES = { ".html": "text/html" };\nconst s = "body{background:#000}";',
    'src/server/package.json': '{"name":"server"}',
  });
  assert.equal(r.code, 0, r.out);
});

test('leg 5: a citation that resolves but does not SUPPORT the claim FAILS', () => {
  // sess 89 refused this by hand: .875rem occurs in the stylesheet only as
  // --editor-h5/h6-font-size, so citing it for a settings heading is true
  // about the value and false about the claim.
  const css = "--editor-h5-font-size:.875rem;--editor-h6-font-size:.875rem;";
  const r = run({
    'pipeline/corpus/style/style-abc123.css': css,
    'src/ui/style.css.ts': 'export const C = `.h{font-size:.875rem}`',
    "src/ui/ui-facts.json": JSON.stringify({
      facts: [{ name: "settings heading size", value: ".875rem", cite: "style-*.css" }],
    }),
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /does not support the claim/);
});

test('leg 5 stays quiet when the value is used as a real declaration', () => {
  const css = ".sx-oxd7ts{font-size:.8125rem}--editor-h5-font-size:.875rem;";
  const r = run({
    'pipeline/corpus/style/style-abc123.css': css,
    'src/ui/style.css.ts': 'export const C = `.h{font-size:.8125rem}`',
    "src/ui/ui-facts.json": JSON.stringify({
      facts: [{ name: "settings heading size", value: ".8125rem", cite: ".sx-oxd7ts" }],
    }),
  });
  assert.equal(r.code, 0, r.out);
});

test('leg 5 is skipped without a corpus, not silently passed as checked', () => {
  // Legs 0-4 are corpus-free; leg 5 needs the stylesheet. Absent one, an
  // unsupportable citation is UNVERIFIABLE rather than fine.
  const r = run({
    'src/ui/style.css.ts': 'export const C = `.h{font-size:.875rem}`',
    "src/ui/ui-facts.json": JSON.stringify({
      facts: [{ name: "settings heading size", value: ".875rem", cite: "style-*.css" }],
    }),
  });
  assert.equal(r.code, 0, r.out);
});

test('leg 5 ignores non-dimensional values (font stacks live in tokens)', () => {
  // False positive caught reviewing #337: `--font-regular` IS how you consume
  // Linear's font stack, so flagging it rejected a correct citation. Leg 5 is
  // about a NUMBER borrowed from a differently-scoped token.
  const stack = '"Inter Variable", -apple-system, sans-serif';
  const r = run({
    'pipeline/corpus/style/style-abc123.css': `--font-regular:${stack};`,
    'src/ui/style.css.ts': `export const C = \`.a{font-family:${stack}}\``,
    'src/ui/ui-facts.json': JSON.stringify({
      facts: [{ name: 'font stack', value: stack, cite: '--font-regular' }],
    }),
  });
  assert.equal(r.code, 0, r.out);
});

// --- issue #351 regression ------------------------------------------------
// Seven fixtures here deliberately fail. With stderr INHERITED, each printed
// a "ui-facts: FAIL" banner into ci/check-src.sh's log beside the ✔ that
// asserts it. See the longer note in check-links.test.mjs; the option is
// pinned by reading run()'s source because e.stderr is filled either way, so
// output alone cannot tell piped from inherited.
test('run() pipes child stderr — else fixtures leak into the CI log (#351)', () => {
  const src = fs.readFileSync(new URL(import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function run('), src.indexOf('test('));
  assert.match(
    body,
    /stdio:\s*\[[^\]]*['"]pipe['"]\s*\]/,
    'run() must pass stdio with stderr piped',
  );
});

// --- leg 6 (#360): declared scope ---------------------------------------

test('leg 6 is inert when no fact declares a scope', () => {
  const r = run({
    'src/p/package.json': '{"name":"p","ui":true}',
    'src/p/style.css.ts': 'export const C = `.btn{gap:6px}`;',
    'src/p/ui-facts.json': JSON.stringify({
      facts: [{ name: 'input padding', value: '6px', cite: 'x' }],
    }),
  });
  assert.equal(r.code, 0, r.out);
});

test('leg 6 FAILS a value used outside its declared scope', () => {
  const r = run({
    'src/p/package.json': '{"name":"p","ui":true}',
    'src/p/style.css.ts':
      'export const C = `\n.btn { gap: 6px; }\n.input { padding-block: 6px; }\n`;',
    'src/p/ui-facts.json': JSON.stringify({
      facts: [
        { name: 'input padding', value: '6px', scope: ['.input'], cite: 'x' },
      ],
    }),
  });
  assert.equal(r.code, 1, 'a 6px button gap cited to the input must fail');
  assert.match(r.out, /is used in `\.btn`/);
  assert.match(r.out, /scoped to `\.input`/);
});

test('leg 6 allows the same value in a selector its own fact covers', () => {
  const r = run({
    'src/p/package.json': '{"name":"p","ui":true}',
    'src/p/style.css.ts':
      'export const C = `\n.btn { gap: 6px; }\n.input { padding-block: 6px; }\n`;',
    'src/p/ui-facts.json': JSON.stringify({
      facts: [
        { name: 'input padding', value: '6px', scope: ['.input'], cite: 'x' },
        { name: 'button gap', value: '6px', scope: ['.btn'], cite: 'y' },
      ],
    }),
  });
  assert.equal(r.code, 0, r.out);
});

test('leg 6 ignores values whose facts declare no scope, even in a scoped package', () => {
  // Partial adoption: one fact scoped, another not. The unscoped value must
  // not be accused, or adopting scope on one row would force it on all.
  const r = run({
    'src/p/package.json': '{"name":"p","ui":true}',
    'src/p/style.css.ts':
      'export const C = `\n.btn { gap: 6px; }\n.other { width: 42px; }\n`;',
    'src/p/ui-facts.json': JSON.stringify({
      facts: [
        { name: 'button gap', value: '6px', scope: ['.btn'], cite: 'x' },
        { name: 'unscoped thing', value: '42px', cite: 'y' },
      ],
    }),
  });
  assert.equal(r.code, 0, r.out);
});

test('a malformed scope is named, not silently ignored', () => {
  const r = run({
    'src/p/package.json': '{"name":"p","ui":true}',
    'src/p/style.css.ts': 'export const C = `.btn{gap:6px}`;',
    'src/p/ui-facts.json': JSON.stringify({
      facts: [{ name: 'button gap', value: '6px', scope: '.btn', cite: 'x' }],
    }),
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /"scope" must be a non-empty array/);
});

// --- nested files (CodeRabbit inline review on #327) ---------------------
// Both discovery paths read only immediate directory entries, so a nested
// UI source file escaped value scanning entirely and a nested
// stylesheet-named file did not trigger the declaration check. Found in my
// own gate, on the PR that is the root of the whole UI stack.

test(`a NESTED uncited value is caught, not skipped`, () => {
  const r = run({
    'src/p/package.json': '{"name":"p","ui":true}',
    'src/p/ui-facts.json': JSON.stringify({ facts: [{ name: 'x', value: '4px', cite: 'c' }] }),
    'src/p/style.css.ts': 'export const A = `.a{gap:4px}`;',
    'src/p/nested/style.css.ts': 'export const B = `.b{gap:777px}`;',
  });
  assert.equal(r.code, 1, 'a nested uncited value must fail');
  assert.match(r.out, /nested\/style\.css\.ts/);
  assert.match(r.out, /777px/);
});

test(`a NESTED stylesheet-named file still demands a declaration`, () => {
  const r = run({
    'src/q/package.json': '{"name":"q"}',
    'src/q/deep/style.css.ts': 'export const C = `.c{gap:9px}`;',
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /declares no UI/);
});

test(`leg 5 fires on a PERCENTAGE value (#327 inline review)`, () => {
  // `\b` after `75%` never matched — the next char is `;`, and neither is a
  // word character — so leg 5 skipped every percentage silently. A value
  // living only as a differently-scoped custom property should be caught.
  const r = run({
    'src/p/package.json': '{"name":"p","ui":true}',
    'src/p/ui-facts.json': JSON.stringify({
      facts: [{ name: 'sidebar nav width', value: '75%', cite: 'style-x.css' }],
    }),
    'src/p/style.css.ts': 'export const A = `.a{width:75%}`;',
    'pipeline/corpus/style/style-x.css': ':root{--editor-h5-width:75%;}',
  });
  assert.equal(r.code, 1, 'a percentage borrowed from an unrelated token must fail');
  assert.match(r.out, /editor-h5-width/);
});

test(`an unreadable corpus fails loudly instead of skipping leg 5`, () => {
  // ENOENT means "no corpus" and is fine. Any other read error means the
  // corpus is present and unreadable, which would disable leg 5 and still
  // report success (CodeRabbit, #327 inline review).
  const r = run(
    {
      'src/p/package.json': '{"name":"p","ui":true}',
      'src/p/ui-facts.json': JSON.stringify({
        facts: [{ name: 'x', value: '4px', cite: 'c' }],
      }),
      'src/p/style.css.ts': 'export const A = `.a{gap:4px}`;',
      'pipeline/corpus/style/style-x.css': ':root{--a:4px}',
    },
    (dir) => fs.chmodSync(path.join(dir, 'pipeline/corpus/style/style-x.css'), 0o000),
  );
  assert.equal(r.code, 1, 'an unreadable corpus must fail');
  assert.match(r.out, /cannot read the corpus stylesheet/);
});
