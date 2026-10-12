import { randomUUID } from 'node:crypto';
import { endpoint, pollQuery, pollVariables, sendQuery, sendVariables } from './protocol.mjs';

export class ProbeError extends Error {
  constructor(kind) { super(kind); this.kind = kind; }
}
const bad = () => { throw new ProbeError('invalidConfig'); };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function validateConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad();
  const allowed = new Set(['token', 'userId', 'userAccountId', 'organizationId',
    'clientId', 'clientVersion', 'message', 'timeoutMs', 'pollMs']);
  if (Object.keys(value).some((key) => !allowed.has(key))) bad();
  for (const key of ['token', 'userId', 'userAccountId', 'organizationId', 'clientId', 'clientVersion']) {
    if (typeof value[key] !== 'string' || !value[key].trim() ||
        value[key].length > 8192 || !/^[\x20-\x7e]+$/.test(value[key])) bad();
  }
  for (const key of ['userId', 'userAccountId', 'organizationId']) if (!uuid.test(value[key])) bad();
  if (typeof value.message !== 'string' || !value.message.trim() || value.message.length > 4000) bad();
  const result = { ...value, timeoutMs: value.timeoutMs ?? 120000, pollMs: value.pollMs ?? 1000 };
  if (!Number.isSafeInteger(result.timeoutMs) || result.timeoutMs < 20 || result.timeoutMs > 300000) bad();
  if (!Number.isSafeInteger(result.pollMs) || result.pollMs < 1 || result.pollMs > 10000) bad();
  return result;
}
export const freshIds = () => ({ conversationId: randomUUID(), userMessageId: randomUUID() });
export const headersFor = (c) => ({
  'content-type': 'application/json', authorization: c.token,
  user: c.userId, userAccount: c.userAccountId, organization: c.organizationId,
  'Linear-Client-ID': c.clientId, 'Linear-Client-Version': c.clientVersion,
});
export function plan(c, ids) {
  return { mode: 'dry-run', networkRequests: 0, compatibility: 'UNVERIFIED',
    endpoint, headers: { ...headersFor(c), authorization: '[REDACTED]' },
    preflight: { query: pollQuery, variables: pollVariables(ids.conversationId) },
    send: { query: sendQuery, variables: sendVariables(c, ids) },
    poll: { query: pollQuery, variables: pollVariables('<returned-conversation-id>') },
  };
}
