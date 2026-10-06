import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK_UI = fileURLToPath(new URL('../../ci/check-ui.sh', import.meta.url));

// Exercise the shell's handling of the corpus-exec CLI contract without a
// vendor corpus or Rust. The trace proves later golden/value legs still run.
function run(states, withUi = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-ui-'));
  const write = (file, text, mode) => {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text, mode ? { mode } : undefined);
  };
  try {
    fs.mkdirSync(path.join(dir, 'pipeline/corpus/client'), { recursive: true });
    if (withUi) write('src/ui/ui-facts.json', '{}');
    states.forEach((state, i) => {
      write(`src/cases/golden/${i} case.json`, state);
      write(`src/cases/golden/${i} case.expected.json`, '{}');
    });
    write('bin/node', `#!/bin/sh
if [ "$3" != "verify" ]; then exit 0; fi
printf 'verify %s\\n' "$4" >> "$CHECK_UI_TRACE"
case "$(cat "$4")" in
  ok) echo 'verify: OK' >&2; exit 0 ;;
  stale) echo 'corpus-exec: chunk not found in corpus: Missing.js' >&2; exit 2 ;;
  mismatch) echo 'verify: MISMATCH in output' >&2; exit 1 ;;
  tooling) echo 'corpus-exec: invalid case file' >&2; exit 2 ;;
esac
exit 3
`, 0o755);
    write('bin/cargo', `#!/bin/sh
printf 'cargo %s\\n' "$*" >> "$CHECK_UI_TRACE"
`, 0o755);
    const trace = path.join(dir, 'trace.txt');
    const result = spawnSync('bash', [CHECK_UI], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: path.join(dir, 'bin') + path.delimiter + process.env.PATH,
        CHECK_UI_TRACE: trace,
      },
    });
    assert.ifError(result.error);
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      trace: fs.readFileSync(trace, 'utf8'),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function completedValueLegs(result) {
  assert.match(result.trace, /cargo .* -- extract/);
  assert.match(result.trace, /cargo .* -- check/);
}

test('golden mismatches fail after all remaining cases and value legs run', () => {
  for (const states of [['mismatch', 'ok'], ['ok', 'mismatch']]) {
    const r = run(states);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /golden verification exited 1/);
    assert.equal(r.trace.match(/^verify /gm).length, 2);
    completedValueLegs(r);
  }
});

test('non-pin tooling errors remain failures', () => {
  for (const states of [['tooling', 'ok'], ['ok', 'tooling']]) {
    const r = run(states);
    assert.equal(r.status, 1, r.output);
    assert.match(r.output, /golden verification exited 2/);
    assert.doesNotMatch(r.output, /SKIPPED/);
    completedValueLegs(r);
  }
});

test('only identified missing pinned chunks are skipped', () => {
  const r = run(['stale', 'ok']);
  assert.equal(r.status, 0, r.output);
  assert.match(r.output, /SKIPPED .*pinned chunk absent/);
  assert.match(r.output, /1 passed, 1 skipped/);
  assert.equal(r.trace.match(/^verify /gm).length, 2);
  completedValueLegs(r);
});

test('a missing pin cannot hide a later mismatch', () => {
  const r = run(['stale', 'mismatch', 'ok']);
  assert.equal(r.status, 1, r.output);
  assert.match(r.output, /1 passed, 1 skipped/);
  assert.equal(r.trace.match(/^verify /gm).length, 3);
  completedValueLegs(r);
});

test('the no-UI exit retains golden failures after extraction', () => {
  const r = run(['mismatch'], false);
  assert.equal(r.status, 1, r.output);
  assert.match(r.trace, /cargo .* -- extract/);
  assert.doesNotMatch(r.trace, /cargo .* -- check/);
});
