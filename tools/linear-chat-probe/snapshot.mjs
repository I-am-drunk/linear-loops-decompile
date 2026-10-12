import { ProbeError } from './config.mjs';

const statuses = new Set(['pending', 'active', 'complete', 'error', 'awaitingInput', 'waiting']);
const kinds = new Set(['prompt', 'event', 'text', 'reasoning', 'toolCall', 'widget',
  'widgetPlaceholder', 'elicitation', 'elicitationResponse', 'error', 'ack']);
export function nodesFrom(data) {
  const nodes = data?.aiConversations?.nodes;
  if (!Array.isArray(nodes) || nodes.length > 1) throw new ProbeError('invalidResponse');
  return nodes;
}
export function inspectSnapshot(data, ids) {
  const nodes = nodesFrom(data);
  if (!nodes.length) return null;
  const node = nodes[0];
  if (!node || node.id !== ids.conversationId || !statuses.has(node.status) ||
      (node.parts !== null && !Array.isArray(node.parts))) throw new ProbeError('invalidResponse');
  if ((node.parts ?? []).some((part) => !part || typeof part.metadata?.turnId !== 'string')) {
    throw new ProbeError('invalidResponse');
  }
  const parts = (node.parts ?? []).filter((part) => part.metadata.turnId === ids.assistantMessageId);
  for (const part of parts) {
    if (!kinds.has(part.type) || typeof part.id !== 'string') throw new ProbeError('unsupportedPart');
  }
  const error = parts.find((part) => part.type === 'error');
  if (error) return { outcome: 'providerError',
    errorType: ['billing', 'usageLimit', 'untrustedSources', 'unknown'].includes(error.errorType)
      ? error.errorType : 'unknown',
    usageLimitScope: ['loop', 'workspace'].includes(error.usageLimitScope) ? error.usageLimitScope : null,
    usageLimitResetsAt: typeof error.usageLimitResetsAt === 'string' &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(error.usageLimitResetsAt)
      ? error.usageLimitResetsAt : null,
  };
  if (node.status === 'error') return { outcome: 'providerError', errorType: 'unknown' };
  if (!parts.length) return null; // A stale complete snapshot is not our response.
  if (['awaitingInput', 'waiting'].includes(node.status) || parts.some((part) =>
    part.type === 'elicitation' || (part.type === 'ack' && part.kind === 'waiting'))) {
    return { outcome: 'requiresInput' };
  }
  if (node.status !== 'complete') return null;
  const texts = parts.filter((part) => part.type === 'text');
  if (texts.some((part) => typeof part.body !== 'string')) throw new ProbeError('invalidResponse');
  const acknowledged = parts.some((part) => part.type === 'ack' &&
    ['done', 'ignored', 'skipped'].includes(part.kind));
  if (!texts.length && !acknowledged) return { outcome: 'unsupportedOutput' };
  return { outcome: 'complete', content: texts.map((part) => part.body).join('\n'),
    acknowledged, partCount: parts.length };
}
