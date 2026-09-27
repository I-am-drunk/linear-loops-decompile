# Linear Loops feature matrix (the acceptance bar)

Every Loops feature, enumerated from the decompile corpus (Linear v1.32.4,
2026-09-27; `pipeline/corpus/analysis/` in the vault) plus `SPECS/` and
`KNOWLEDGE.md`. This file is the acceptance bar for the rebuild: a feature is done
when its behavior is implemented AND verified against the corpus. EXACT is the bar,
not plausible.

Status values: `corpus` (exists in the decompile, evidence named) -> `spec`
(behavior documented in SPECS/KNOWLEDGE) -> `built` (implemented in src/) ->
`exact` (verified against the corpus; release bar, issue #20).

All rows are currently `corpus`; nothing is built (rebuild era, R3 pending).

## A. Loops management UI

| Feature | Corpus evidence | Status |
|---|---|---|
| Loops management page | `LoopsManagementPage.{BAhf8Ti3,CVnaEF7c}.js` | corpus |
| Loop detail page | route `/:orgKey/loop/:loopId` | corpus |
| Loop runs page | route `/:orgKey/loop/:loopId/runs`; `AutomationRunsPage.{CwJzxL5C,DR4Bss0s}.js` | corpus |
| Automations list page | `AutomationsPage.CRjHv_XJ.js`, `AutomationsList.wnFzBYvh.js`, `AutomationPage.{CNGjpM23,FVNODuJW}.js` | corpus |
| New-loop dialog + button | `AutomationNewDialog.Wu-wKkiY.js`, `AutomationNewButton.DnfgotrN.js` | corpus |
| Template library + launcher | `LoopTemplateLibrary.C__UMpNm.js`, `useLoopTemplateLauncher.O9-_gagH.js` | corpus |
| AI-assisted loop compose | `ComposeLoopWithAgentButton.7ayZbu8h.js`, `LoopCreationTracker.BAiVgMLN.js` | corpus |
| Recent-loops tracking | `useTrackRecentLoop.DJGSsw3v.js` | corpus |
| Loop view types | `LoopViewType.BzPUaBkC.js` | corpus |
| Run history dialog | `AutomationHistoryDialog.{B86oepp7,DYWJ3DgX}.js` | corpus |
| Automation inbox view | `AutomationInboxView.Dv2kC_0t.js` | corpus |
| Owner select | `AutomationOwnerSelect.Cl2Nhq6T.js` | corpus |
| Empty states | `AutomationsEmptyStateIcon.CWP-Klc2.js`, `AgentAutomationEmptyStateIcon.BW9M5hMw.js` | corpus |

## B. Loop definition and triggers

| Feature | Corpus evidence | Status |
|---|---|---|
| WorkflowDefinition model (trigger, triggerType, activationMode, intelligence, conditions, schedule, triggerConfig, enabled, applyToSubTeams, editAccess, stats, policies) | `models.json` | corpus |
| Draft lifecycle | `WorkflowDefinitionDraft` model | corpus |
| Definition history | `WorkflowDefinitionHistory` model | corpus |
| Cron scheduling | `WorkflowCronJobDefinition` model | corpus |
| Trusted sources | ops `AutomationTrustedSources(WithUsage)`, `WorkflowDefinitionSourceTrustUpdate`; chunks `AutomationTrustedSource{Display,EditorOptions}` | corpus |
| Chat-trigger channels | op `IntegrationWorkflowChatTriggerChannels` | corpus |
| MCP approval | op `WorkflowDefinitionMcpApprovalUpdate` | corpus |
| Stats refresh | op `WorkflowDefinitionStatsRefresh` | corpus |

## C. Loop runs

| Feature | Corpus evidence | Status |
|---|---|---|
| LoopExecution model (links aiConversation + workflowDefinition + issue/project/initiative/document/team/cycle/release) | `models.json` | corpus |
| Run stats | op `LoopRunStats` | corpus |
| Credit metering surface | op `FreeLoopCredit`; chunks `RegisterLoopRunUsageCostTarget.C-IK2SWk.js`, `LoopLimitsPage.BrXlWYB3.js` | corpus |
| Run conversation UI | `AgentAutomationConversation.{CJ-vqVie,D4kx9f1U}.js` | corpus |

## D. Chat substrate (the golden goose, issue #14)

Loop chat and normal AI chat are one substrate: the `AiConversation` entity
carries BOTH `workflowDefinition` and `loopExecution` links plus `isWorkflowRun`.
Sending is one mutation; responses ride the sync queue. The credit gate lives on
the loop/workflow side (`RegisterLoopRunUsageCostTarget`), not on send.
Full route trace (send input fields, auth headers, stream subscribe envelope,
part vocabulary, meter placement): `docs/golden-goose-chat-route.md`.

| Feature | Corpus evidence | Status |
|---|---|---|
| AiConversation model (turns, parts, pendingMessages, context, traits, subAgents, promptPresetKey, workflowDefinition, loopExecution, isWorkflowRun) | `models.json` | corpus |
| AiConversationTurn model (position, parts, status, role, responseToTurn) | `models.json` | corpus |
| Send message | mutation `AiConversationSendMessage` (returns `success`, `lastSyncId`, `userMessage.id`, `assistantMessage.id`) | corpus |
| Cancel | mutation `AiConversationCancel` | corpus |
| Elicitations | mutation `AiConversationSendElicitationResponses`; `AgentElicitationResponseQueue.BM8OrYyq.js` | corpus |
| Prompt progress | mutation `AddUserMessageToAiPromptProgress` | corpus |
| Conversation list/hydration | query `AiConversationsQuery`; `useHydrateAgentConversations.DJ4Hg1po.js` | corpus |
| Entity chat hooks | `useEntityAgentChat.DCgQcFjU.js`, `useEntityAgentChatRoute.UazehM1s.js` | corpus |
| Chat UI | `LinearAgentMessages.BuUfncdI.js`, `AgentConversationItems.DoHFAP_d.js`, `AgentInput.ekPPAiwd.js`, `AgentPanel*` chunks | corpus |
| Streaming: NO GraphQL subscriptions exist anywhere in the bundle; turns arrive over the LSE sync queue (`wss://sync.linear.app`, `lastSyncId` model) | `graphql-ops.json` (zero subscription ops); SPECS/sync-protocol.md | corpus |
| Debug surfaces | ops `AiConversationDebugExecutions`, `AiConversationDebugThreadState`, `DebugAiConversationUsage` | corpus |

## E. Agent Sessions (presenter/write-back; never the brain)

| Feature | Corpus evidence | Status |
|---|---|---|
| AgentSession model (status, plan, agentActivities, codingEnvironment, modelSelection, externalUrls, diffs, availableSkills) | `models.json` | corpus |
| AgentActivity model (content, signal, ephemeral, sourceComment, queued) | `models.json` | corpus |
| Session UI | `AgentSessionPage.D4DhwkML.js`, `AgentSessionActivities.B9yu6arN.js`, `LinearAgentCommentContent.C---p7AT.js`, `LinearAgentEmptyState(+Hero)` | corpus |
| Coding harness | ops `AgentSessionCodingHarness(ModelLabel)`, `AgentSessionSandbox`, `AgentSessionSshAddress`, `AgentSessionRestartWithDefaultModel`; `CodingAgentModelSelect.USYHzowP.js` | corpus |
| PR integration | ops `PullRequestAgentSessionCreate`, `PullRequestAgentFixDispatch`, `PullRequestCommentDispatchToAgent`; model `AgentSessionToPullRequest`; `canOpenAgentSessionInReview.BbTwURTH.js` | corpus |
| Official public API surface | `extracts/linear-official/AGENT-API.md` (12 ops) | corpus |

## F. Settings surfaces

| Feature | Corpus evidence | Status |
|---|---|---|
| Workspace agent settings | `WorkspaceAgent(s)SettingsPage.*` | corpus |
| Team agent settings (skills, connectors) | `TeamAgentsSettingsPage`, `TeamAgentSkillsSettingsPage`, `TeamAgentConnectorsSettingsPage` | corpus |
| Account agents | `AccountAgentsSettingsPage.*`, `ActiveAgentsSection`, `useActiveAgents` | corpus |
| Agent guidance | `AgentGuidanceSettings.BgeC_uVo.js` | corpus |
| Skills | `AgentSkillDetailSuggestion`, `agentSkillsSettingsBackLink` | corpus |
| Issuers | `AgentIssuersSettingsPage`, `NewAgentIssuerSettingsPage` | corpus |
| Workflow automation settings | `WorkflowAgentAutomationSettings{Constants,Page}`, `TeamAutomationSettingsPage` | corpus |
| MCP settings | `LinearAgentMcpSettings.8HfTvzal.js` | corpus |
| Coding agent settings | `CodingAgentSettingsPage.{C73HMBrM,lcMyXnM7}.js` | corpus |

Regenerate the evidence side after each 30-day corpus refresh and diff this file.
