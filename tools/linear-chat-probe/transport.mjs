import { ProbeError, headersFor } from './config.mjs';
import { endpoint } from './protocol.mjs';

export function abortable(promise, signal) {
  if (signal.aborted) {
    void promise.catch(() => {});
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    promise.then((v) => { cleanup(); resolve(v); }, (e) => { cleanup(); reject(e); });
  });
}
async function bodyJson(response, signal) {
  const reader = response.body?.getReader();
  if (!reader) throw new ProbeError('invalidResponse');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await abortable(reader.read(), signal);
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new ProbeError('responseTooLarge');
      chunks.push(Buffer.from(value));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new ProbeError('invalidResponse'); }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export function graphError(errors) {
  const codes = errors.map((e) => e?.extensions?.code);
  if (codes.some((c) => ['UNAUTHENTICATED', 'AUTHENTICATION_ERROR'].includes(c))) return 'authentication';
  if (codes.includes('FORBIDDEN')) return 'permission';
  if (codes.some((c) => ['RATELIMITED', 'RATE_LIMITED'].includes(c))) return 'rateLimited';
  if (codes.includes('GRAPHQL_VALIDATION_FAILED')) return 'incompatibleProtocol';
  return 'graphqlRejected';
}

export async function request(fetcher, config, payload, signal) {
  const response = await abortable(fetcher(endpoint, {
    method: 'POST', redirect: 'error', signal,
    headers: headersFor(config), body: JSON.stringify(payload),
  }), signal);
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    const status = response.status;
    throw new ProbeError(status === 401 ? 'authentication' :
      status === 403 ? 'permission' : status === 429 ? 'rateLimited' :
      status >= 500 ? 'unavailable' : 'httpRejected');
  }
  const json = await bodyJson(response, signal);
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new ProbeError('invalidResponse');
  if (json.errors !== undefined && !Array.isArray(json.errors)) throw new ProbeError('invalidResponse');
  if (json.errors?.length) throw new ProbeError(graphError(json.errors));
  if (!json.data || typeof json.data !== 'object' || Array.isArray(json.data)) {
    throw new ProbeError('invalidResponse');
  }
  return json.data;
}
