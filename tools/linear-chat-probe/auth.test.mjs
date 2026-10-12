import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authOperation, authenticate, sessionFromResponse, completeQuery } from './auth.mjs';
import { readPrivate } from './auth-main.mjs';
const account = { id: 'account-1', users: [{ id: 'user-1', organization: { id: 'org-1' } }] };
const data = { emailTokenUserAccountAuth: account };
const cookie = 'authenticationToken=fixture-session; Secure; HttpOnly; SameSite=Lax';

test('auth completion takes the session from Set-Cookie, not a deprecated payload token', () => {
  const result = sessionFromResponse({ emailTokenUserAccountAuth: { ...account, token: 'not-session' } },
    [cookie, 'other=value; Expires=Tue, 13 Oct 2026 12:00:00 GMT'], 'observed-time');
  assert.equal(result.token, 'fixture-session');
  assert.equal(result.userAccountId, 'account-1');
  assert.deepEqual(result.memberships, [{ userId: 'user-1', organizationId: 'org-1' }]);
  assert.deepEqual(result.cookieNames, ['authenticationToken', 'other']);
  assert.equal(result.cookieObservedAt, 'observed-time');
  assert.equal(result.firstVerifiedUseAt, null);
});
test('missing, empty and ambiguous cookies fail; a new account can have no memberships', () => {
  for (const cookies of [[], ['authenticationToken=; Max-Age=0'], [cookie, cookie]]) {
    assert.throws(() => sessionFromResponse(data, cookies, 't'));
  }
  assert.deepEqual(sessionFromResponse({ emailTokenUserAccountAuth: { ...account, users: [] } },
    [cookie], 't').memberships, []);
});
test('auth inputs require a real challenge or code; no challenge solver exists', () => {
  assert.throws(() => authOperation('challenge', { email: 'probe@example.test' }));
  assert.throws(() => authOperation('complete', { email: 'probe@example.test', code: '123' }));
  assert.throws(() => authOperation('invalid', {}));
  const operation = authOperation('complete', { email: 'probe@example.test', code: '123', timezone: 'UTC' });
  assert.equal(operation.query, completeQuery);
  assert.equal(operation.variables.token, '123');
  assert.equal(operation.variables.timezone, 'UTC');
});
test('one fixed-endpoint completion, bounded response and no redirects', async () => {
  let calls = 0;
  const result = await authenticate('complete', {
    email: 'probe@example.test', code: '123', timezone: 'UTC',
  }, { fetcher: async (url, init) => {
    calls++;
    assert.equal(url, 'https://client-api.linear.app/graphql');
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'include');
    assert.equal(init.headers.authorization, undefined);
    return new Response(JSON.stringify({ data }), { headers: { 'set-cookie': cookie } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.token, 'fixture-session');
});
test('private inputs reject public files and symlinks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'linear-auth-test-'));
  try {
    const file = join(dir, 'input.json');
    await writeFile(file, '{"email":"probe@example.test"}', { mode: 0o600 });
    assert.equal((await readPrivate(file)).email, 'probe@example.test');
    await symlink(file, join(dir, 'link.json'));
    await assert.rejects(readPrivate(join(dir, 'link.json')));
    await chmod(file, 0o644);
    await assert.rejects(readPrivate(file));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('HTTP and GraphQL refusals never retry or expose upstream messages', async () => {
  for (const response of [new Response('secret-error', { status: 403 }),
    new Response(JSON.stringify({ errors: [{ message: 'secret-error',
      extensions: { code: 'FORBIDDEN' } }] }))]) {
    let calls = 0;
    await assert.rejects(authenticate('challenge', { email: 'probe@example.test', challengeResponse: 'challenge' },
      { fetcher: async () => { calls++; return response; } }), (e) => !e.message.includes('secret-error'));
    assert.equal(calls, 1);
  }
});
test('an already aborted authentication never dispatches a mutation', async () => {
  let calls = 0;
  await assert.rejects(authenticate('challenge', { email: 'probe@example.test', challengeResponse: 'challenge' },
    { signal: AbortSignal.abort(), fetcher: async () => { calls++; } }));
  assert.equal(calls, 0);
});
