# Shard map — the claim queue

One shard = one file under `docs/remap/sections/` = one PR. Claim on #225 with
the normal discipline (check tail + open PRs; earliest wins). The "research"
column names the #295 comments (by timestamp) the shard-taker harvests — the
research is DONE; a shard is mostly transcription of converged findings into
ledger rows.

Offers recorded on the #295 thread are honored here but are not claims: a
standing offer yields to any earlier #225 claim, per the boot rules.

| Shard | File | Scope | Research inputs (#295) | Offered by |
|---|---|---|---|---|
| R-A | sections/a-loops-routes.md | The 29 loops/automation routes: management, detail, list, new, view types, aliases, deep links | 23:37Z, 23:40Z, 00:56Z | (open) |
| R-EDITOR | sections/editor.md | `/loops/new` + `/loop/:loopId` edit: the AutomationHistoryDialog inventory — trigger picker taxonomy, 20 placeholder strings, schedule UI (RecurringIssueTemplateControls + AutomationHelper validation), team-access section, connector/trust UI, model select, publish flow, versions/history, run-now gating, draft quotas | 01:17:39Z (+ publish-lifecycle detail from 01:22:53Z §3) | sess_01a0eaaf-fcf6 |
| R-CONTENT | sections/content.md | Doc-schema module (node/mark vocabulary), markdown↔doc transcoder + corpus-exec golden family, readonly renderer row, compose-send-path/mention-builder/draft-tracker facts | 01:22:53Z, 01:25:06Z reconciliation | sess_01a0eaaf-ed60 |
| R-RUNS | sections/runs.md | Run render pipeline, stats chart + cost caption, preference keys, retryResolution degraded renders, `src/ui-store` row, run-event stream row (OURS transport), paginated run-feed endpoint | 00:54:38Z, 00:54:59Z §3, 00:56:14Z | sess_01a0ea9a-460c |
| R-GOV | sections/governance.md | Trusted sources ×3 layers (policy statics, source-key grammar/editor algorithm, degraded flow), tool approvals (chat-ride semantics), memories row group (3-valued enum, 3 surfaces), MCP disposition | 01:16:24Z, 01:16:55Z §2, 01:17:52Z | sess_01a0eaaf-cdef |
| R-TPL | sections/templates.md | Client-baked catalog (12 templates + 7 presets, ~52 KB transcription inventory, `RM.presetData()` second site), `resolveTrigger`/`requiresTriage`/`manageableTriageTeam` goldens, flag census (8 flags) | 01:16:55Z §1 §3, 01:17:52Z | sess_01a0eaaf-e1a7 |
| R-T | sections/team-select.md | Team-select ADAPT spec: `canCreateLoop`/`defaultTeamForNewLoop`/ContextualMenuActions resolvers, AutomationHelper boundary/scope kernel, activeTeams ordering kernel, TeamLabel | 23:37Z §2, 23:38Z §1, 00:54:08Z | (open) |
| R-W | sections/workspace.md | Workspace context: org projection, gates (owner-decision #3), workspace-scoped settings routes in scope | 23:37Z, 00:48Z | (open) |
| R-PROJ | sections/data-projection.md | SPECS/data-projection.md: per-field public/derived/ours marks (Team 32/191, Org 20/214, User 22/115 measured) + teach `tools/coverage` the ledger (route-completeness + disposition-consistency legs) | 00:48Z, 00:49Z §4, 00:54:08Z | sess_01a0ea99-eb5c |
| R-SEAM | sections/seam-contract.md | The ~34-chunk platform seam list + seam rule, flag-fork table + flag column, send-path degraded-state literals (closed enum in useSendAiMessage) | 00:54:59Z, 00:56:14Z | sess_01a0ea9a-5fa6 |
| R-FACADE | sections/assembly.md | Closure sizing (generated roots), monster facades with tool-emitted demand lists, fan-in build order, foundation kit | 00:49Z, 00:56:02Z; tools/remap-graph claimed 00:53Z (#225) | sess_01a0ea9a-1616 |
| R-triggers | sections/triggers.md | 48-entry trigger catalog × webhook contract, per-triggerType feed table, engine-semantics golden targets (trigger table, coercion lattice, validators) | 23:45:49Z, 23:45:11Z | sess_01a0ea5a-ff65 |
| R-SRV | sections/server-rows.md | NEW server rows: run engine, event intake (webhook + poll legs), run-feed endpoint, trust store, memory store, audit | 23:45:07Z §2, 23:45:49Z | sess_01a0ea5b-4409 |
| R-OLD | sections/old-code.md | The `archive/v0-swarm-era` disposition column: engine/dataplane/runtime = REFERENCE, v0 UI = IGNORE-values/INDEX-existence | 23:45:07Z §1 | sess_01a0ea5b-4409 |

Interlocks recorded on the thread (cross-link, don't duplicate):
- R-GOV owns the trust kernels; R-EDITOR cites the trust editor as a mounted
  region (`AutomationTrustedSourceEditorOptions` is imported by the editor chunk).
- Owner-decision #5 (MCP) disposes both R-GOV approval rows and R-EDITOR
  connector rows — one decision, two consuming shards.
- Owner-decision #8 (prompt format) constrains R-CONTENT, R-EDITOR, and R-TPL.
- The node-render tier (Finding 2) is sequenced ONCE, early, serving both
  R-EDITOR and R-RUNS.
- R-SEAM's `useSendAiMessage` row lists three plane-collision sites:
  useToolApprovalActions (R-GOV), ComposeLoopWithAgentButton (R-CONTENT), and
  the send path itself.
