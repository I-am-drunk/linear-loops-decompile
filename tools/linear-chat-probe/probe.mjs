import { setTimeout as delay } from 'node:timers/promises';
import { ProbeError, freshIds, validateConfig } from './config.mjs';
import { operation, pollQuery, pollVariables, sendQuery, sendVariables } from './protocol.mjs';
import { request } from './transport.mjs';
import { inspectSnapshot, nodesFrom } from './snapshot.mjs';

// No retry of any mutation; callers must reconcile unknown execution outcomes.
export async function runProbe(input, options = {}) {
  const config = validateConfig(input);
  const ids = freshIds();
  const fetcher = options.fetcher ?? fetch;
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new ProbeError('timeout')), config.timeoutMs);
  const signal = options.signal ? AbortSignal.any([deadline.signal, options.signal]) : deadline.signal;
  let phase = 'preflight';
  let sendAttempts = 0;
  let polls = 0;
  try {
    signal.throwIfAborted();
    const preflight = await request(fetcher, config,
      operation(pollQuery, pollVariables(ids.conversationId)), signal);
    if (nodesFrom(preflight).length) throw new ProbeError('conversationIdCollision');
    signal.throwIfAborted();
    phase = 'send';
    sendAttempts = 1;
    const sent = await request(fetcher, config,
      operation(sendQuery, sendVariables(config, ids)), signal);
    const payload = sent.aiConversationSendMessage;
    if (payload?.success === false) throw new ProbeError('sendRejected');
    const id = (value) => typeof value === 'string' &&
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
    if (payload?.success !== true || !id(payload.aiConversation?.id) ||
        !id(payload.userMessage?.id) || !id(payload.assistantMessage?.id) ||
        !Number.isSafeInteger(payload.lastSyncId) || payload.lastSyncId < 0) {
      throw new ProbeError('invalidResponse');
    }
    ids.conversationId = payload.aiConversation.id;
    ids.userMessageId = payload.userMessage.id;
    ids.assistantMessageId = payload.assistantMessage.id;
    phase = 'poll';
    while (true) {
      signal.throwIfAborted();
      const data = await request(fetcher, config,
        operation(pollQuery, pollVariables(ids.conversationId)), signal);
      polls++;
      const result = inspectSnapshot(data, ids);
      if (result) return { ...result, phase, ids, sendAttempts, polls,
        remoteCancellation: 'notRequested', usageKnown: false, costKnown: false };
      await delay(config.pollMs, undefined, { signal });
    }
  } catch (error) {
    const reason = deadline.signal.aborted ? 'timeout' : signal.aborted ? 'interrupted' :
      error instanceof ProbeError ? error.kind : 'transportFailure';
    return { outcome: reason, phase, ids, sendAttempts, polls,
      execution: sendAttempts ? 'mayHaveExecuted' : 'notSent',
      remoteCancellation: 'notRequested' };
  } finally {
    clearTimeout(timer);
  }
}
