import { ProbeError } from './config.mjs';

export function socketPlan(c) {
  const fields = ['userId', 'userAccountId', 'clientType', 'flagClient',
    'clientDatabaseId', 'clientVersion', 'cellName', 'token'];
  if (fields.some((key) => c[key] === undefined || c[key] === null)) {
    throw new ProbeError('capturedHandshakeFieldsRequired');
  }
  if (fields.some((key) => !['string', 'number', 'boolean'].includes(typeof c[key])) ||
      typeof c.token !== 'string' || !c.token || c.token.length > 8192) {
    throw new ProbeError('invalidHandshakeFields');
  }
  const url = new URL('wss://sync.linear.app');
  url.searchParams.set('userId', c.userId);
  url.searchParams.set('userAccountId', c.userAccountId);
  const handshake = { cmd: 'hshk', protocolVersion: 3, supportsSpectatorMode: true };
  for (const key of fields) handshake[key] = c[key];
  // No binary protocol, dictionary version, or URL compression negotiation.
  return { url: url.href, handshake };
}
export async function frameSummary(data) {
  const kind = typeof data === 'string' ? 'text' : 'binary';
  const bytes = typeof data === 'string' ? Buffer.from(data) :
    data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : Buffer.from(data);
  if (bytes.length > 1024 * 1024) return { kind, bytes: bytes.length, jsonDecodable: null, oversized: true };
  try {
    const frame = JSON.parse(bytes.toString('utf8'));
    return { kind, bytes: bytes.length, jsonDecodable: true,
      cmd: typeof frame?.cmd === 'string' ? frame.cmd : null,
      hasSync: frame?.cmd === 'hshk' && frame.sync !== undefined,
      keys: frame && typeof frame === 'object' ? Object.keys(frame) : [] };
  } catch { return { kind, bytes: bytes.length, jsonDecodable: false }; }
}
export async function probeSocket(config, options = {}) {
  const { url, handshake } = socketPlan(config);
  const durationMs = options.durationMs ?? 30000;
  if (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > 60000) {
    throw new ProbeError('invalidSocketDuration');
  }
  const startedAt = new Date().toISOString();
  const socket = new (options.WebSocketClass ?? WebSocket)(url);
  const frames = [];
  const pending = [];
  let opened = false;
  let error = false;
  const result = await new Promise((resolve) => {
    let settled = false;
    const finish = (reason, code = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* Capture the result even if already closed. */ }
      resolve({ reason, closeCode: code });
    };
    const timer = setTimeout(() => finish('observationWindowEnded'), durationMs);
    socket.addEventListener('open', () => {
      opened = true;
      try { socket.send(JSON.stringify(handshake)); }
      catch { error = true; finish('sendError'); }
    });
    socket.addEventListener('message', ({ data }) => {
      // Stop rather than collecting an unbounded workspace stream.
      if (pending.length >= 256) { finish('frameLimit'); return; }
      const index = pending.length;
      pending.push(frameSummary(data).then((frame) => { frames[index] = frame; }));
    });
    socket.addEventListener('error', () => { error = true; finish('socketError'); });
    socket.addEventListener('close', ({ code }) => finish('serverClosed', code));
  });
  await Promise.all(pending);
  return { startedAt, endedAt: new Date().toISOString(), opened, error, ...result,
    handshakeAccepted: frames.some((f) => f.cmd === 'hshk' && f.hasSync),
    syncDictionaryObserved: frames.some((f) => f.cmd === 'syncDictionary'),
    frames };
}
