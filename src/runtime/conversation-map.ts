/**
 * Conversation mappers — runtime records (Run/Turn) → conversation records
 * (AiConversation/AiConversationTurn, src/model).
 *
 * Two consumers:
 * 1. The server (T-1101), which persists runs AS conversation rows — a run
 *    is a conversation with initialSource "workflow" (KNOWLEDGE §3).
 * 2. The golden-goose adapter (#14), which reuses these shapes when it
 *    presents our runs through Linear's agent surface.
 *
 * Original code.
 */

import type { ActivityPartContent, AiConversation, AiConversationTurn } from "../model/conversation.ts";
import type { EntityId, ISODateTime } from "../model/loop.ts";
import type { Part, Run, Turn } from "./types.ts";

/**
 * Compile-time guard: the runtime's Part must remain exactly the model's
 * ActivityPartContent (both directions). If either union drifts, this line
 * stops compiling — the one-definition rule from T-202.
 */
const _partIsActivityPartContent: (p: Part) => ActivityPartContent = (p) => p;
const _activityPartContentIsPart: (c: ActivityPartContent) => Part = (c) => c;
void _partIsActivityPartContent;
void _activityPartContentIsPart;

/**
 * Package a run as a conversation record for persistence. Turns are separate
 * records (turnToConversationTurn below) — AiConversation holds no inline
 * turn list.
 *
 * `conversationId` defaults to the run id (one conversation per run in v1;
 * the server may override with its own id and store the link on the run).
 */
export function runToConversation(
  run: Run,
  at: ISODateTime,
  conversationId: EntityId = run.id,
): AiConversation {
  const conversation: AiConversation = {
    id: conversationId,
    initialSource: "workflow",
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: at,
    isWorkflowRun: true,
    workflowDefinitionId: run.loopId,
    usage: { ...run.usage },
  };
  if (run.summary !== undefined) conversation.summary = run.summary;
  return conversation;
}

/** Package one runtime turn as a conversation turn (parts pass through — the guard above pins the shapes). */
export function turnToConversationTurn(turn: Turn, conversationId: EntityId): AiConversationTurn {
  const out: AiConversationTurn = {
    id: turn.id,
    conversationId,
    position: turn.position,
    role: turn.role,
    status: turn.status,
    parts: [...turn.parts],
    startedAt: turn.startedAt,
  };
  if (turn.endedAt !== undefined) out.endedAt = turn.endedAt;
  return out;
}

/** Map a run's whole turn list. */
export function turnsToConversationTurns(turns: readonly Turn[], conversationId: EntityId): AiConversationTurn[] {
  return turns.map((t) => turnToConversationTurn(t, conversationId));
}
