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
| R-A | sections/a-loops-routes.md | **LANDED** — the 29 loops/automation routes: 15 mounted views + 10 redirects + 2 notification deep-links + 2 pattern-registry entries, generated from `analysis/routes.json` | 23:37Z, 23:40Z, 00:56Z | sess_01a0ed1c-05eb (claimed #225 12:52:47Z) |
| R-LIST | sections/list-browse.md | The loops list/browse view-model: grouping/ordering/preference lattice (AutomationListProvider), exact filter vocabulary, connector-health badge lattice, spend-limits table + limit-math kernel, usage/limits op family (29 ops, zero public roots — Finding 1 extension) | 02:15:43Z | sess_01a0ead7-d729 |
| R-EDITOR | sections/editor.md | `/loops/new` + `/loop/:loopId` edit: the AutomationHistoryDialog inventory — trigger picker taxonomy, 20 placeholder strings, schedule UI (RecurringIssueTemplateControls + AutomationHelper validation), team-access section, connector/trust UI, model select, publish flow, versions/history, run-now gating, draft quotas | 01:17:39Z (+ publish-lifecycle detail from 01:22:53Z §3) | sess_01a0eaaf-fcf6 |
| R-CONTENT | sections/content.md | Doc-schema module (node/mark vocabulary), markdown↔doc transcoder + corpus-exec golden family, readonly renderer row, compose-send-path/mention-builder/draft-tracker facts | 01:22:53Z, 01:25:06Z reconciliation | sess_01a0eaaf-ed60 |
| R-RUNS | sections/runs.md | Run render pipeline, stats chart + cost caption, preference keys, retryResolution degraded renders, `src/ui-store` row, run-event stream row (OURS transport), paginated run-feed endpoint | 00:54:38Z, 00:54:59Z §3, 00:56:14Z | sess_01a0ea9a-460c |
| R-GOV | sections/governance.md | Trusted sources ×3 layers (policy statics, source-key grammar/editor algorithm, degraded flow), tool approvals (chat-ride semantics), memories row group (3-valued enum, 3 surfaces), MCP disposition | 01:16:24Z, 01:16:55Z §2, 01:17:52Z | sess_01a0eaaf-cdef |
| R-TPL | sections/templates.md | Client-baked catalog (12 templates + 7 presets, ~52 KB transcription inventory, `RM.presetData()` second site), `resolveTrigger`/`requiresTriage`/`manageableTriageTeam` goldens, flag census (14 flags per the 01:26Z UNION rule) | 01:16:55Z §1 §3, 01:17:52Z | sess_01a0eaaf-e1a7 |
| R-T | sections/team-select.md | **LANDED** — team-select ADAPT spec: resolver kernels (four-cell ADAPT rows), the THREE-ordering-kernel table + picker-site state map, AutomationHelper boundary/scope kernel, TeamLabel, reduced Team projection (32/191 resolved), OUT rows incl. the ParentTeamSelect false friend | 23:37Z §2, 23:38Z §1, 00:54:08Z, 02:18:03Z, 20:57:45Z + PR #307 | sess_01a0ef9f-c1b4 (claimed #225 2026-09-30 00:11:44Z) |
| R-W | sections/workspace.md | Workspace context: org projection, gates (owner-decision #3), workspace-scoped settings routes in scope | 23:37Z, 00:48Z | (open) |
| R-PROJ | sections/data-projection.md | SPECS/data-projection.md: per-field public/derived/ours marks (Team 32/191, Org 20/214, User 22/115 measured) + teach `tools/coverage` the ledger (route-completeness + disposition-consistency legs) | 00:48Z, 00:49Z §4, 00:54:08Z | sess_01a0ea99-eb5c |
| R-SEAM | sections/seam-contract.md | The ~34-chunk platform seam list + seam rule, flag-fork table + flag column, send-path degraded-state literals (closed enum in useSendAiMessage) | 00:54:59Z, 00:56:14Z | sess_01a0ea9a-5fa6 |
| R-FACADE | sections/assembly.md | Closure sizing (generated roots, TWO-TIER eager/lazy per the 01:26Z method fix — all pre-fix demand lists regenerate), monster facades with tool-emitted demand lists, fan-in build order, foundation kit, `__vite__mapDeps` self-check leg | 00:49Z, 00:56:02Z, 01:26:32Z; tools/remap-graph claimed 00:53Z (#225) | sess_01a0ea9a-1616 |
| R-triggers | sections/triggers.md | 48-entry trigger catalog × webhook contract, per-triggerType feed table, engine-semantics golden targets (trigger table, coercion lattice, validators) | 23:45:49Z, 23:45:11Z | sess_01a0ea5a-ff65 |
| R-SRV | sections/server-rows.md | NEW server rows: run engine, event intake (webhook + poll legs, at-least-once dedupe), run-feed endpoint, trust store, memory store, audit, write-back identity (echo suppression, credential mode = owner decision #10, attribution synthesis + the sourceMetadata zod-grammar golden) | 23:45:07Z §2, 23:45:49Z, 02:31Z write-back leg | sess_01a0ea5b-4409 (+ sess_01a0eae3-f740 write-back rows) |
| R-ACTIONS | sections/actions.md | The 13-action loop command catalog (contextual menu + palette = one registry in rootActions), edit-access lattice (pure golden kernel), Move flow wire op + consequence builder, manual-run loop ranking (second ordering kernel), subscribers feature (flag-gated, OURS, exact limits) | 02:18:03Z | sess_01a0ead7-e6b4 |
| R-OLD | sections/old-code.md | The `archive/v0-swarm-era` disposition column: engine/dataplane/runtime = REFERENCE, v0 UI = IGNORE-values/INDEX-existence | 23:45:07Z §1 | sess_01a0ea5b-4409 |
| R-SCHED | sections/schedule.md | The schedule kernel (`Issue.DRYymPCa.js` ~6092–6360, export `yC`): recurrence engine (nextDate, month-end clamp — NOT rrule, hours catch-up collapse), zod schemas + exact validation copy, `inWords` humanizer grid, `isEqual`/`alignsWith`; shared with recurring-issue templates. Kernel reimpl + goldens = SCHED-1, claimed on #225 12:30:03Z | 12:30:51Z–12:41Z four-way recovery + reconciliation | sess_01a0ed1c-2a7c (SCHED-1) |
| TYPE-LATTICE | sections/type-lattice.md | **LANDED** — the six-value WorkflowDefinition `type` dispositions (OUT rows for sla/viewSubscription/release, the triage ADAPT row, the store rule) + the `resolveTypeForTrigger` ⇄ conversion kernel reimplemented golden-backed in `src/loops-type-lattice` (first golden executing the model-layer chunk `Issue.DRYymPCa.js` directly — the config-bootstrap seam) | triage-plane input 2026-09-29 + owner-decision #11 | sess_01a0ede8-f9a3 (claimed #225 2026-09-29) |
| R-DRAFT | sections/draft-publish.md | The draft/publish state machine: per-user drafts (table keyed workflowDefinitionId+creatorId), the publishDraft transaction as our publish endpoint's field-for-field spec (canonicalization, exact copy list, trim rule, create-only fields, enablement rule), history/versions model, validator-declared team projection | 01:31:03Z, 01:22:53Z §3 | sess_01a0eaae-45af |
| R-BOOT | sections/boot-config.md | The boot/config plane: boot-order row group (html.CjyPLfH8 → entry.BGeHYrTB spine), prototype-extension ambient kernel (KEEP-EXACT, golden-required, A1-gating), 90-key config seam (`window.CLIENT_ENV` over baked fallbacks, throwing-proxy contract, required-key coverage leg), telemetry OUT via unset-key self-disable, SW ADAPT + sw.js pipeline gap, missing index.html gap + DesktopServer OUT | 16:21Z (#295 boot/config leg) | sess_01a0edec-d03b (claimed #225 16:22:39Z) |

| NOTIF-COPY | (kernel slice, no section file — digest §3.7 is the disposition) | **LANDED** — the three loop-notification copy-builder kernels (failure copy: five-reason vocabulary, single-positive-reason collapse, tz-sensitive "N times today" day-bucketing; response copy: awaitingApproval `||` fallback; user-message copy: `??` fallback) reimplemented golden-backed in `src/notif-copy` via the TYPE-LATTICE config-bootstrap seam; branch-invariant-fixture determinism pattern for clock-reading goldens (#295 input 2026-09-29) | 14:41:10Z + 14:42:39Z notification legs (settled 2×) | sess_01a0eeb4-bf4d (claimed #225 20:38:02Z) |

Interlocks recorded on the thread (cross-link, don't duplicate):
- R-GOV owns the trust kernels; R-EDITOR cites the trust editor as a mounted
  region (`AutomationTrustedSourceEditorOptions` is imported by the editor chunk).
- **Trust-plane keying is owned by R-SRV** (it is a server-store concern: the
  key grammar the trust store persists and the echo-suppression/attribution
  rules read). Handoff: R-GOV defines the source-key grammar and the
  allow/deny policy kernels (client-exact, golden-backed); R-SRV consumes that
  grammar unchanged as the trust-store key and applies the SAME keying to
  actor attribution and write-back echo suppression (owner decision #10) —
  one keying rule, defined once in R-GOV's kernel rows, cited by R-SRV.
- Owner-decision #5 (MCP) disposes both R-GOV approval rows and R-EDITOR
  connector rows — one decision, two consuming shards.
- Owner-decision #8 (prompt format) constrains R-CONTENT, R-EDITOR, and R-TPL.
- The node-render tier (Finding 2) is sequenced ONCE, early, serving both
  R-EDITOR and R-RUNS.
- R-SEAM's `useSendAiMessage` row lists three plane-collision sites:
  useToolApprovalActions (R-GOV), ComposeLoopWithAgentButton (R-CONTENT), and
  the send path itself.
