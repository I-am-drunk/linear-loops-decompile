import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('land.mjs', import.meta.url));
const source = (login, body) => ({ user: { login, type: 'User' }, body });
const block = (path, text) => `### FILE: ${path}\n\`\`\`\n${text}\n\`\`\``;

test('land imports FILE blocks only from the authorized account, including issue bodies', () => {
  const dir = mkdtempSync(join(tmpdir(), 'land-auth-'));
  try {
    mkdirSync(join(dir, 'bin'));
    writeFileSync(join(dir, 'event.json'), JSON.stringify({
      comment: source('I-am-drunk', '/land branch=fix-security/test from=#1'), issue: { number: 2 },
    }));
    const comments = [source('I-am-drunk', block('src/result.ts', 'trusted')),
      source('participant', block('src/result.ts', 'overwrite') + '\n' + block('src/injected.ts', 'injected'))];
    writeFileSync(join(dir, 'bin/gh'), `#!${process.execPath}\nconst args = process.argv.slice(2);\nif (args[0] === 'api') console.log(JSON.stringify(args[1].includes('/comments?') ? ${JSON.stringify(comments)} : ${JSON.stringify(source('participant', block('src/body.ts', 'injected')))}));`, { mode: 0o700 });
    writeFileSync(join(dir, 'bin/git'), `#!${process.execPath}\nif (process.argv.includes('--quiet')) process.exit(1);`, { mode: 0o700 });
    const env = { ...process.env, PATH: join(dir, 'bin'), GITHUB_EVENT_PATH: join(dir, 'event.json'), GITHUB_REPOSITORY: 'fixture/repo', GH_TOKEN: 'synthetic' };
    execFileSync(process.execPath, [script], { cwd: dir, env });
    assert.equal(readFileSync(join(dir, 'src/result.ts'), 'utf8'), 'trusted\n');
    assert.equal(existsSync(join(dir, 'src/injected.ts')), false);
    assert.equal(existsSync(join(dir, 'src/body.ts')), false);
    writeFileSync(join(dir, 'event.json'), JSON.stringify({ comment: source('participant', '/land branch=fix-security/test'), issue: { number: 2 } }));
    assert.throws(() => execFileSync(process.execPath, [script], { cwd: dir, env, stdio: 'pipe' }), /unauthorized/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
