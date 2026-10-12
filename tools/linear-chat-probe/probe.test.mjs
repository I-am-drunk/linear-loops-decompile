import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { runProbe } from './probe.mjs';
import { exampleConfig, exampleIds } from './sample.mjs';
import { validateConfig, plan } from './config.mjs';
import { safeReport } from './main.mjs';
import { endpoint, pollQuery, sendQuery } from './protocol.mjs';

const config = { ...exampleConfig, token: 'private-test-secret', pollMs: 1, timeoutMs: 2000 };
const turn = '66666666-6666-4666-8666-666666666666';
const part = (type, extra = {}) => ({ type, id: 'part-1', metadata: { turnId: turn }, ...extra });
const json = (data) => new Response(JSON.stringify({ data }));
function scenario(snapshots = [], overrides = {}) {
  const calls = [];
  let input;
  let pollIndex = 0;
  const fetcher = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, ...init, body });
    if (body.query === sendQuery) {
      input = body.variables.input;
      if (overrides.send) return overrides.send(input);
      return json({ aiConversationSendMessage: { success: true, lastSyncId: 1,
        aiConversation: { id: input.conversationId }, userMessage: { id: input.userMessageId },
        assistantMessage: { id: turn } } });
    }
    if (!input) return overrides.preflight?.() ?? json({ aiConversations: { nodes: [] } });
    const snapshot = snapshots[Math.min(pollIndex++, snapshots.length - 1)];
    if (typeof snapshot === 'function') return snapshot();
    return json({ aiConversations: { nodes: snapshot === null ? [] :
      [{ id: input.conversationId, status: 'complete', parts: [], ...snapshot }] } });
  };
  return { fetcher, calls };
}

test('preflight, one send, fresh polls; correlate only the returned assistant turn', async () => {
  const stale = part('text', { body: 'old', metadata: { turnId: 'old-turn' } });
  const s = scenario([null, { parts: [stale] }, { status: 'active', parts: [part('text', { body: 'partial' })] },
    { parts: [stale, part('text', { body: 'CHAT-PROBE-OK' })] }]);
  const result = await runProbe(config, s);
  assert.equal(result.outcome, 'complete');
  assert.equal(result.content, 'CHAT-PROBE-OK');
  assert.equal(result.polls, 4);
  assert.equal(result.sendAttempts, 1);
  assert.equal(s.calls.filter((c) => c.body.query === sendQuery).length, 1);
  assert.equal(s.calls[0].body.query, pollQuery);
  assert.equal(s.calls[0].url, endpoint);
  assert.equal(s.calls[1].headers.authorization, config.token);
  assert.equal(s.calls[1].redirect, 'error');
  assert.equal(s.calls[1].body.variables.input.initialSource, undefined);
  assert.equal(s.calls[1].body.variables.input.resume, true);
});
test('schema rejection fails before any send and never exposes upstream text', async () => {
  const s = scenario([], { preflight: () => new Response(JSON.stringify({
    errors: [{ message: config.token, extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }],
  })) });
  const result = await runProbe(config, s);
  assert.equal(result.outcome, 'incompatibleProtocol');
  assert.equal(result.sendAttempts, 0);
  assert.equal(s.calls.length, 1);
  assert.ok(!JSON.stringify(result).includes(config.token));
});
for (const [status, outcome] of [[401, 'authentication'], [403, 'permission'], [429, 'rateLimited'], [503, 'unavailable']]) {
  test(`HTTP ${status} stops preflight`, async () => {
    const s = scenario([], { preflight: () => new Response(config.token, { status }) });
    const result = await runProbe(config, s);
    assert.equal(result.outcome, outcome);
    assert.equal(result.sendAttempts, 0);
  });
}
test('ambiguous send failure never retries or polls', async () => {
  const s = scenario([], { send: () => { throw new Error(config.token); } });
  const result = await runProbe(config, s);
  assert.equal(result.outcome, 'transportFailure');
  assert.equal(result.execution, 'mayHaveExecuted');
  assert.equal(s.calls.length, 2);
  assert.ok(!JSON.stringify(result).includes(config.token));
});
for (const snapshot of [
  { status: 'awaitingInput', parts: [part('elicitation', { kind: 'confirmation' })] },
  { status: 'waiting', parts: [part('ack', { kind: 'waiting' })] },
]) {
  test(`suspend on ${snapshot.status}, never confirm or cancel remotely`, async () => {
    const s = scenario([snapshot]);
    const result = await runProbe(config, s);
    assert.equal(result.outcome, 'requiresInput');
    assert.equal(s.calls.length, 3);
    assert.equal(result.remoteCancellation, 'notRequested');
  });
}
test('billing error inside a successful GraphQL response is not completion', async () => {
  const s = scenario([{ parts: [part('error', { errorType: 'usageLimit', usageLimitScope: 'workspace',
    usageLimitResetsAt: '2026-10-13T00:00:00Z' })] }]);
  const result = await runProbe(config, s);
  assert.equal(result.outcome, 'providerError');
  assert.equal(result.errorType, 'usageLimit');
  assert.equal(result.usageLimitScope, 'workspace');
});
test('known ack completes silently; unknown parts are incompatible', async () => {
  assert.equal((await runProbe(config, scenario([{ parts: [part('ack', { kind: 'done' })] }]))).outcome, 'complete');
  assert.equal((await runProbe(config, scenario([{ parts: [part('newVariant')] }]))).outcome, 'unsupportedPart');
  assert.equal((await runProbe(config, scenario([{ parts: [part('toolCall')] }]))).outcome, 'unsupportedOutput');
});
for (const makeResponse of [
  () => new Response('not-json'),
  () => json({ aiConversations: { nodes: 'wrong' } }),
  () => new Response('x'.repeat(1024 * 1024 + 1)),
]) {
  test('malformed or oversized preflight never sends', async () => {
    const s = scenario([], { preflight: makeResponse });
    const result = await runProbe(config, s);
    assert.equal(result.sendAttempts, 0);
    assert.ok(['invalidResponse', 'responseTooLarge'].includes(result.outcome));
  });
}
test('total deadline covers a fetch that ignores abort', async () => {
  const result = await runProbe({ ...config, timeoutMs: 25 }, {
    fetcher: () => new Promise(() => {}),
  });
  assert.equal(result.outcome, 'timeout');
  assert.equal(result.sendAttempts, 0);
});
test('deadline covers a stalled body; send is not repeated', async () => {
  const s = scenario([() => new Response(new ReadableStream({ start() {} }))]);
  const result = await runProbe({ ...config, timeoutMs: 25 }, s);
  assert.equal(result.outcome, 'timeout');
  assert.equal(result.sendAttempts, 1);
  assert.equal(result.execution, 'mayHaveExecuted');
});
test('external interruption stops local polling without claiming remote cancellation', async () => {
  const s = scenario([{ status: 'active', parts: [] }]);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25);
  const result = await runProbe(config, { ...s, signal: controller.signal });
  clearTimeout(timer);
  assert.equal(result.outcome, 'interrupted');
  assert.equal(result.remoteCancellation, 'notRequested');
});
test('private data is absent by default and literal tokens are always redacted', () => {
  const result = { outcome: 'complete', content: `answer ${config.token}` };
  const safe = safeReport(result, config.token);
  assert.ok(!safe.includes('answer'));
  assert.ok(!safe.includes(config.token));
  assert.ok(safe.includes('contentSha256'));
  assert.ok(!safeReport(result, config.token, true).includes(config.token));
});
test('configuration rejects endpoint override, header injection and invalid durations', () => {
  for (const input of [{ endpoint: 'http://example.com' }, { token: 'x\r\ncookie: y' },
    { timeoutMs: NaN }, { pollMs: 0 }, { userId: 'not-a-uuid' }, { message: '' }]) {
    assert.throws(() => validateConfig({ ...config, ...input }));
  }
  assert.deepEqual(validateConfig(config), config);
});
test('offline CLI outputs only fictional, redacted request plan', () => {
  const child = spawnSync(process.execPath, ['tools/linear-chat-probe/main.mjs', '--dry-run'], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), plan(exampleConfig, exampleIds));
  assert.ok(!child.stdout.includes(exampleConfig.token));
});
test('native fetch loopback transport preserves operation order and reads the answer', async () => {
  const s = scenario([{ parts: [part('text', { body: 'native-ok' })] }]);
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const answer = await s.fetcher(endpoint, { body: Buffer.concat(chunks).toString(), headers: req.headers });
    res.writeHead(answer.status, { 'content-type': 'application/json' });
    res.end(await answer.text());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const result = await runProbe(config, { fetcher: (_url, init) =>
      fetch(`http://127.0.0.1:${server.address().port}`, init) });
    assert.equal(result.content, 'native-ok');
    assert.equal(s.calls.length, 3);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
