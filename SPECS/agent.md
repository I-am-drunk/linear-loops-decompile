<!-- HISTORICAL RECORD -->

> Dated Linear reference notes, not the current application contract.
> The product scope and runtime boundaries are in [target-architecture.md](target-architecture.md).
> Recheck each reference claim before using it; our UI/server transport does not establish T3 Code interoperability.

# SPEC — Agent runtime (conversations, sessions, activities)

Derived from KNOWLEDGE.md §5 + §3. Two related models in Linear; we merge the best of both.

## AiConversation (Linear Agent / loop runs)

- Sources: directChat | entityChat | comment | pullRequestComment | slack | microsoftTeams |
  mcp | **workflow** (loop run) | onboarding | subAgent.
- Fields of note: `turns, parts, status, iterationId, summary, context, promptPresetKey,
  traits, subAgents, parent, userState, pendingMessages, shouldQueueMessages`.
- Turns: `AiConversationTurn { conversation, position, responseToTurn, parts, status,
  role, user, externalUserId, authorDisplayName }`.
- Mutations observed: `AiConversationSendMessage` (→ returns userMessage+assistantMessage ids),
  `AiConversationCancel`, `AiConversationSendElicitationResponses`. Debug-only:
  thread state / executions / braintrust / compact / notify-loop-completed.
- Server holds: `threadState, allContext, usageCalls` (we keep equivalents: our runtime
  state + context pack + usage counters).

## AgentSession (delegated coding work)

- Created on mention/delegation; status enum: `pending, active, awaitingInput, error,
  complete, waiting` (+canceled externally). Has `summary, displayTitle, plan,
  availableSkills, modelSelection{kind: default|userOverride, restartedAt, explanation},
  queuedActivities, pendingElicitation{auth|select}, externalUrls, diffs, pullRequests`.
- Activities (`AgentActivity`): `content, signal, signalMetadata, ephemeral, queued,
  executionSkippedReason, sentAt` + user/source linkage. Signals drive UI badges
  (e.g. commit badges, "working" states).
- Coding harness notes (for R6 inspiration): harnesses claude/codex/openSource; model pref
  = `{model, effort}`; workspace default + per-session user override (restart on change);
  sandbox sizes S/M/L; SSH address exposure; commit signing toggle.

## OUR runtime contract (R5)

```
Run      = { id, loopId, target, status, iteration, createdAt, startedAt?, endedAt?,
             summary?, usage{input,output,costUsd}, error?, conversationId }
Turn     = { id, runId, position, role: user|agent|system, parts: Part[], status }
Part     = thought{text} | action{tool,label,argsSummary,resultSummary?} |
           response{text} | elicitation{kind,prompt,choices?} | error{message} |
           steered{text}
Brain    = interface { stream(message, ctx) → AsyncIter<Part>; cancel(runId) }
```

- State machine: pending → active ⇄ awaitingInput → complete | error | canceled.
- Continuation: user follow-up on a finished/active run appends a turn (same context pack
  + new message) — mirrors "continue previous runs".
- Steer: message into an active run queues (`shouldQueueMessages` analog).
- Cancel: cooperative (brain stream aborted → status canceled, partial parts kept).
- Elicitation kinds: freeText, auth (connect account), select (choices).
