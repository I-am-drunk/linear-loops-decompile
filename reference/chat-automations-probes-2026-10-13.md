# Chat automation live probes — 2026-10-13

Sacrificial Reps Lab account from the existing October 12 captures. Web-session
cookie method; no credentials, headers, raw account payloads or vendor source
copied here. HTTPS certificate validation enabled. Local scratch captures were
reduced to the fields below. These are API observations, not browser screenshots.

## L1 — read capability and empty native state

viewer read succeeded. aiConversations(first:3,filter:{initialSource:{eq:workflow}})
with nodes.id/pageInfo.hasNextPage returned [], false. workflowDefinitions(first:2)
returned no nodes. Ordinary conversations selected with id/initialSource/status/
workflowDefinition returned directChat, complete and null definition.
A quoted string for the inline source enum was rejected; the enum literal worked.
Introspection of AiConversationCreateInput returned HTTP 400 with AUTHENTICATION_ERROR,
requiring super-user access. No introspection bypass was attempted.

## L2 — plain-chat unpublished creation did not happen

Sent ordinary aiConversationSendMessage with generated conversation/user-message
UUIDs, context=[], ProseMirror text, resume=true and fallbackMode=queue.
Requested only an unpublished draft named Chat Automation Mapping Probe, instructions
PROBE_OK only; explicitly excluded publishing, enabling, scheduling and running.
Response success=true; conversation e62d0cd1-2ab0-43b6-9250-93b7d6d4e3e0;
assistant 128e41ac-a5d0-4c66-abdc-22715a0f5ecb; lastSyncId 4119454458.

/sync/batch polls correlated that assistant ID: pending, active, completed.
Parts: SearchDocumentation toolCall and answer-phase text. Agent said it could not
create an unpublished Loop from that chat without publishing; no card or mutation
result. This is one observed response, not a capability theorem or successful creation.

## L3 — create a disabled draft, without publishing

workflowDefinitionDraftCreate(input: WorkflowDefinitionDraftCreateInput!) accepted:
id (generated UUID), name=Chat Automation Mapping Probe, type=automation,
enabled=false, trigger=entityCreated, triggerType=issue, activities=[].
An earlier incomplete input was rejected for missing trigger/triggerType/activities.
Selected success/lastSyncId/workflowDefinitionDraft.id. Result success=true,
draft ad822a19-1caa-47a0-b078-41586e5c12d6, lastSyncId 4119736307.
This does not establish the full input schema or published-definition creation.

## L4 — contextual chat edits that saved draft

New send, context=[{type:WorkflowDefinitionDraft,id:the L3 draft}], same ordinary
send envelope. Requested rename to Chat Automation Mapping Probe Edited and
instructions PROBE_OK only; preserve unpublished/disabled state and do not run.
Result success=true, conversation 871d1d52-0ba0-490b-a97e-1f6b3071919e,
assistant b92ecf05-184e-4466-ad7f-81dbc53029a8, lastSyncId 4119770535.
Poll correlated that ID through pending/active/completed. Parts:

- commentary-phase text announcing the scoped edit;
- UpdateEntity args.entity type WorkflowDefinitionDraft, id=L3 draft;
- result.updatedEntities contains the same typed ID;
- answer-phase text reporting name/instructions changed, no publication/run.

No explicit widget part occurred. Independent workflowDefinitionDraft(id) read
confirmed name=Chat Automation Mapping Probe Edited, enabled=false,
workflowDefinition=null. aiConversations filtered by this conversation ID confirmed
initialSource=directChat, context=L3 draft, workflowDefinition=null.
Repeated workflowDefinitions and native-workflow conversation queries stayed empty.

## L5 — document hydration and limits

Selecting workflowDefinitionDraft.documentContent in GraphQL failed validation.
Normal /sync/batch with modelName=DocumentContent, indexedKey=workflowDefinitionDraftId
and keyValue=L3 draft succeeded. It returned DocumentContent
4c037c90-5b81-4a8e-9934-8aa29c936611 linked to the draft, created during L4,
with base64 contentState. Decoded binary contains the literal “Reply PROBE_OK only.”
No full CRDT/document semantic decode was performed; client contentData is a
projection, not established as a GraphQL field. This supports the separate prompt
storage link independently of the agent's narrative.

No native workflow run, publish, RunLoop invocation, connector connection, approval,
billing comparison, socket replay or browser visual comparison was performed.
The two ordinary probe conversations are retained as evidence.
The probe draft was cleaned up with workflowDefinitionDraftDelete: success=true,
lastSyncId 4120865834. No published automation was created or deleted.
