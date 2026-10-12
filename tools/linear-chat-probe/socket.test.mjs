import { test } from 'node:test';
import assert from 'node:assert/strict';
import { socketPlan, frameSummary, probeSocket } from './socket.mjs';
const config = { userId: 'user', userAccountId: 'account', clientType: 'fixture',
  flagClient: false, clientDatabaseId: 'database', clientVersion: 'fixture-version',
  cellName: 'fixture-cell', token: 'fixture-secret' };
test('JSON plan has neither compression nor binary negotiation', () => {
  const { url, handshake } = socketPlan({ ...config, useBinaryProtocol: true,
    compressionDictionaryVersion: 5, syncCompression: 'zstd-v1' });
  assert.deepEqual([...new URL(url).searchParams.keys()], ['userId', 'userAccountId']);
  assert.equal(handshake.protocolVersion, 3);
  assert.equal(handshake.useBinaryProtocol, undefined);
  assert.equal(handshake.compressionDictionaryVersion, undefined);
  assert.throws(() => socketPlan({ token: 'x' }));
});
test('JSON payloads and binary payloads stay distinguishable; no frame values escape', async () => {
  const text = await frameSummary('{"cmd":"hshk","sync":{"secret":"hidden"}}');
  assert.equal(text.hasSync, true);
  assert.equal(text.kind, 'text');
  assert.ok(!JSON.stringify(text).includes('hidden'));
  const binary = await frameSummary(Buffer.from('{"cmd":"syncDictionary"}'));
  assert.equal(binary.kind, 'binary');
  assert.equal(binary.jsonDecodable, true);
  assert.equal((await frameSummary(Buffer.from([0x81, 0xa3]))).jsonDecodable, false);
  assert.equal((await frameSummary(Buffer.from([0x22, 0xff, 0x22]))).jsonDecodable, false);
});
test('opening a socket is not handshake acceptance', async () => {
  class FakeSocket extends EventTarget {
    constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
    send() { this.dispatchEvent(new MessageEvent('message', { data: '{"cmd":"noauth"}' })); }
    close() {}
  }
  const result = await probeSocket(config, { WebSocketClass: FakeSocket, durationMs: 5 });
  assert.equal(result.opened, true);
  assert.equal(result.handshakeAccepted, false);
  assert.equal(result.frames[0].cmd, 'noauth');
});
test('server handshake, dictionary and binary frames are independently reported', async () => {
  class FakeSocket extends EventTarget {
    constructor() { super(); queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
    send() {
      for (const data of ['{"cmd":"hshk","sync":{}}', '{"cmd":"syncDictionary"}', Buffer.from([0x81])]) {
        this.dispatchEvent(new MessageEvent('message', { data }));
      }
    }
    close() {}
  }
  const result = await probeSocket(config, { WebSocketClass: FakeSocket, durationMs: 5 });
  assert.equal(result.handshakeAccepted, true);
  assert.equal(result.syncDictionaryObserved, true);
  assert.equal(result.frames[2].jsonDecodable, false);
  assert.equal(result.frames[2].kind, 'binary');
});
