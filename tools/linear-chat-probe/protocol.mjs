// Original requests built from the facts in docs/linear-chat-integration-map.md.
// Poll projection and id.eq are candidates, NOT a captured successful request.
export const endpoint = 'https://client-api.linear.app/graphql';
export const sendQuery = `mutation LinearChatProbeSend($input: AiConversationSendMessageInput!) {
  aiConversationSendMessage(input: $input) {
    success lastSyncId aiConversation { id } userMessage { id } assistantMessage { id }
  }
}`;
export const pollQuery = `query LinearChatProbePoll($filter: AiConversationFilter!) {
  aiConversations(first: 1, filter: $filter) {
    nodes {
      id status
      parts {
        __typename
        ... on AiConversationBasePart { id type metadata { turnId } }
        ... on AiConversationTextPart { body }
        ... on AiConversationAckPart { kind }
        ... on AiConversationErrorPart {
          errorType usageLimitScope usageLimitResetsAt
        }
        ... on AiConversationElicitationPart { kind }
      }
    }
  }
}`;
export const pollVariables = (id) => ({ filter: { id: { eq: id } } });
export function sendVariables(config, ids) {
  return { input: {
    conversationId: ids.conversationId, userMessageId: ids.userMessageId,
    bodyData: { type: 'doc', content: config.message.split('\n').map((text) => ({
      type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}),
    })) },
    context: [], resume: true,
  } };
}
export const operation = (query, variables) => ({ query, variables });
