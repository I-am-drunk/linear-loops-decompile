import { ProbeError } from './config.mjs';
import { endpoint } from './protocol.mjs';
import { abortable, bodyJson, graphError } from './transport.mjs';

// Original, deliberately small projections; no deprecated payload token field.
export const challengeQuery = `mutation ProbeEmailChallenge(
  $email: String!, $challengeResponse: String!, $clientAuthCode: String
) {
  emailUserAccountAuthChallenge(input: {
    email: $email, challengeResponse: $challengeResponse,
    clientAuthCode: $clientAuthCode, loginCodeOnly: true
  }) { success authType }
}`;
export const completeQuery = `mutation ProbeEmailComplete(
  $email: String!, $token: String!, $timezone: String!, $clientAuthCode: String
) {
  emailTokenUserAccountAuth(input: {
    email: $email, token: $token, timezone: $timezone, clientAuthCode: $clientAuthCode
  }) { id email users { id organization { id } } }
}`;
const validText = (x, max = 8192) =>
  typeof x === 'string' && x.length > 0 && x.length <= max && !/[\r\n\0]/.test(x);
export function authOperation(mode, input) {
  if (!input || !['challenge', 'complete'].includes(mode) ||
      !validText(input.email, 320)) throw new ProbeError('invalidAuthInput');
  if (input.clientAuthCode !== undefined && !validText(input.clientAuthCode)) {
    throw new ProbeError('invalidAuthInput');
  }
  const variables = { email: input.email, clientAuthCode: input.clientAuthCode };
  if (mode === 'challenge') {
    if (!validText(input.challengeResponse)) throw new ProbeError('challengeRequired');
    variables.challengeResponse = input.challengeResponse;
  } else {
    if (!validText(input.code, 256) || !validText(input.timezone, 100)) {
      throw new ProbeError('codeAndTimezoneRequired');
    }
    Object.assign(variables, { token: input.code, timezone: input.timezone });
  }
  return { query: mode === 'challenge' ? challengeQuery : completeQuery, variables };
}
export function sessionFromResponse(data, setCookies, receivedAt) {
  const account = data?.emailTokenUserAccountAuth;
  if (!validText(account?.id, 100) || !Array.isArray(account.users)) {
    throw new ProbeError('invalidAuthResponse');
  }
  const pairs = setCookies.map((line) => line.split(';', 1)[0]);
  const tokens = pairs.filter((line) => line.startsWith('authenticationToken='));
  if (tokens.length !== 1 || !validText(tokens[0].slice(20))) {
    throw new ProbeError('missingOrAmbiguousSessionCookie');
  }
  const memberships = account.users.map((user) => {
    if (!validText(user?.id, 100) || !validText(user.organization?.id, 100)) {
      throw new ProbeError('invalidAuthResponse');
    }
    return { userId: user.id, organizationId: user.organization.id };
  });
  return { token: tokens[0].slice(20), userAccountId: account.id, memberships,
    // Reception time is NOT a claimed server-issued-at timestamp.
    cookieObservedAt: receivedAt, firstVerifiedUseAt: null,
    cookieNames: pairs.map((line) => line.split('=', 1)[0]) };
}
export async function authenticate(mode, input, options = {}) {
  const payload = authOperation(mode, input);
  const signal = options.signal ?? AbortSignal.timeout(30000);
  signal.throwIfAborted();
  const response = await abortable((options.fetcher ?? fetch)(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    credentials: 'include', redirect: 'error', signal, body: JSON.stringify(payload),
  }), signal);
  const receivedAt = new Date().toISOString();
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    throw new ProbeError('authHttpRejected');
  }
  const json = await bodyJson(response, signal);
  if (Array.isArray(json?.errors) && json.errors.length) throw new ProbeError(graphError(json.errors));
  if (mode === 'complete') return sessionFromResponse(json?.data, response.headers.getSetCookie(), receivedAt);
  if (json?.data?.emailUserAccountAuthChallenge?.success !== true) throw new ProbeError('challengeRejected');
  return { challengeAccepted: true, receivedAt };
}
