/**
 * sendElicitationResponses — clean reimplementation of the corpus chunk
 * `aiConversationSendElicitationResponsesMutation.CEPAjw5J.js` export `t`
 * (matrix §D "Elicitations" row: the wire caller that submits elicitation
 * answers on the chat substrate). Original code; the behavior is verified
 * byte-for-byte against the committed corpus-executed golden
 * (`golden/send-elicitation-responses.wire.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * Reproduced exactly from the corpus source:
 * - the GraphQL document (op name, `$input:
 *   AiConversationSendElicitationResponsesInput!`, the
 *   success/lastSyncId/aiConversation.id/userTurn.id/assistantTurn.id
 *   selection, and the original indentation — the corpus builds it with a
 *   plain template-join tag, so the exact bytes are the wire fact);
 * - the per-kind payload serialization, including the corpus quirks the
 *   golden pins: the confirmation branch HARDCODES `confirmed: true`
 *   (ignoring any caller value), and each response entry narrows to exactly
 *   `{elicitationId, data}` while the TOP-level input spread passes every
 *   field through;
 * - the unknown-kind default throws `Unreachable case: ${value}` (the corpus
 *   UnreachableCaseError message shape, an Error subclass).
 */

export const elicitationResponseKind = {
  multipleChoice: `multipleChoice`,
  mcpServerConnection: `mcpServerConnection`,
  confirmation: `confirmation`,
  entitySelection: `entitySelection`,
} as const;

export type ElicitationResponseData =
  | { kind: `multipleChoice`; selectedOptionIndex: number }
  | { kind: `confirmation`; confirmed?: boolean }
  | { kind: `entitySelection`; selectedEntityIds: string[] }
  | { kind: `mcpServerConnection`; integrationId: string };

export interface ElicitationResponse {
  elicitationId: string;
  data: ElicitationResponseData;
}

export interface SendElicitationResponsesInput {
  responses: ElicitationResponse[];
  [key: string]: unknown;
}

export interface GraphQlMutationClient {
  mutate(document: string, variables: Record<string, unknown>): Promise<unknown>;
}

/** The corpus UnreachableCaseError shape (`Unreachable case: ${case}`). */
class UnreachableCaseError extends Error {
  constructor(value: unknown) {
    super(`Unreachable case: ${value}`);
  }
}

/** The exact corpus document bytes (template-join of a zero-interpolation
 * template: leading newline and trailing two-space indent included). */
export const SEND_ELICITATION_RESPONSES_MUTATION = `
    mutation AiConversationSendElicitationResponses($input: AiConversationSendElicitationResponsesInput!) {
      aiConversationSendElicitationResponses(input: $input) {
        success
        lastSyncId
        aiConversation {
          id
        }
        userTurn {
          id
        }
        assistantTurn {
          id
        }
      }
    }
  `;

/** Corpus chunk-local `i`: response data → wire payload, per kind. */
function serializeResponseData(data: ElicitationResponseData): Record<string, unknown> {
  switch (data.kind) {
    case elicitationResponseKind.multipleChoice:
      return { multipleChoice: { selectedOptionIndex: data.selectedOptionIndex } };
    case elicitationResponseKind.confirmation:
      // Corpus hardcodes true (`confirmed:!0`); the caller's value is ignored.
      return { confirmation: { confirmed: true } };
    case elicitationResponseKind.entitySelection:
      return { entitySelection: { selectedEntityIds: data.selectedEntityIds } };
    case elicitationResponseKind.mcpServerConnection:
      return { mcpServerConnection: { integrationId: data.integrationId } };
    default:
      throw new UnreachableCaseError(data);
  }
}

/** Corpus chunk-local `r` (export `t`): build the wire input and mutate. */
export async function sendElicitationResponses(
  client: GraphQlMutationClient,
  input: SendElicitationResponsesInput,
): Promise<unknown> {
  return client.mutate(SEND_ELICITATION_RESPONSES_MUTATION, {
    input: {
      ...input,
      responses: input.responses.map((r) => ({
        elicitationId: r.elicitationId,
        data: serializeResponseData(r.data),
      })),
    },
  });
}
