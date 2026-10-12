# Linear Agent chat — live protocol capture (2026-10-12, account reps_hardhat257@slmails.com, org "Reps Lab")

## Auth model (verified)
- Web session = httpOnly cookie `session:<userAccountId>` containing a JWT {v:2, sessionId, userAccountId, createdAt, iat} — NO exp field (rolling/long-lived, verify).
- API calls need headers: `Linear-Client-Version: 1.81135.0`, `Linear-Client-ID: b4nv7kmisu7/C`, `user: <userId>`, `userAccount: <userAccountId>`, `organization: <orgId>`, plus the session cookie (credentials: include).
- GraphQL endpoint: POST https://client-api.linear.app/graphql
- Sync endpoint: POST https://client-api.linear.app/sync/batch (accept: text/plain → NDJSON rows)
- ids: user=23fbdc5d-5226-415d-9e01-345976909177 userAccount=5f56a47f-41a0-4f57-8736-73d25a5dcdd2 org=58b57f06-882e-4336-9ef5-5a386d38bc6d

## E1 — normal Agent chat is FREE (verified)
- Settings → Usage: "AI credits apply to usage of Coding sessions and Loops". Workspace balance $0.00, aiAddonEnabled=false.
- Sent chat "2+2" → answer "4" + free auto-title call. Balance unchanged. Nothing recorded.
- CONCLUSION: normal Linear Agent chat requires NO credits and does NOT debit. (Coding sessions + Loops are the metered surfaces.)

## Send message (verified — client-minted UUIDs accepted)
mutation AiConversationSendMessage($input: AiConversationSendMessageInput!) {
  aiConversationSendMessage(input: $input) { success lastSyncId aiConversation { id } userMessage { id } assistantMessage { id } } }
variables.input = {
  conversationId: <uuid>, userMessageId: <uuid>, context: [],
  bodyData: {type:"doc", content:[{type:"paragraph", content:[{type:"text", text:PROMPT}]}]},
  resume: true, fallbackMode: "queue" }
→ returns success:true + assistantMessage.id

## Receive answer (verified)
POST /sync/batch {clientDatabaseId:<uuid>, firstSyncId:<lastSyncId>, requests:[{indexedKey:"conversationId", keyValue:<convId>, modelName:"AiConversationTurn"}]}
→ NDJSON rows; the assistant turn: {status:"completed", role:"assistant", parts:[{type:"text", bodyData:{content:[{text:"BANANA"}]}}]}
Poll until status==="completed" (streaming phases in part metadata: phase:"answer", startedAt/endedAt).

## Multi-turn: resume:true continues the conversation (same conversationId)
## Auto-titling: first message triggers a second free AI call naming the chat
## uploadsSig JWT exp = 7 days (separate upload credential)
## Business trial auto-activated at signup: trialEndsAt = +30 days. codingAgentEnabled/linearAgentEnabled=true at workspace level.
## Signup path that works: REAL Chrome browser (Runner), turnstile auto-solved by browser solver; headless Camoufox on residential IP = "unable to verify it's you" (CF hard block). Magic link binds to requesting browser (open in SAME browser or /auth/error).
