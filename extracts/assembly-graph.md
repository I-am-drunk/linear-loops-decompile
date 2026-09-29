# assembly-graph: the #295 widened-scope import closure, measured

GENERATED — do not hand-edit. Regenerate: `node --experimental-strip-types tools/remap-graph/main.ts report` (needs the local corpus; see tools/remap-graph/README.md). Corpus head: `c44f2cfc2d29bf57a064f741763f9e872b300aac` (1550 chunks, 29.2 MB).

## Roots (tools/remap-graph/roots.json)

- `AutomationsPage.CRjHv_XJ.js`
- `AutomationPage.FVNODuJW.js`
- `AutomationRunsPage.CwJzxL5C.js`
- `ScratchpadMemoriesPage.CVgbHpr0.js`
- `LoopsManagementPage.BAhf8Ti3.js`
- `LoopLimitsPage.BrXlWYB3.js`
- `TeamAutomationSettingsPage.kFQqkao4.js`
- `WorkflowAgentAutomationSettingsPage._wV8723k.js`
- `AgentSessionPage.D4DhwkML.js`

## Closure

| measure | chunks | bytes |
|---|---:|---:|
| full transitive closure | 571 | 14.0 MB |
| monster: `ContextualMenuActions.Dlg9Oa2U.js` | 1 | 4.7 MB |
| monster: `Issue.DRYymPCa.js` | 1 | 1.7 MB |
| reachable ONLY via monsters | 44 | 0.2 MB |
| assembly set (closure minus monsters) | 525 | 7.4 MB |
| — vendor-named (consumed, not reimplemented) | 198 | 1.9 MB |
| — app-named (the real assembly surface) | 327 | 5.5 MB |

Assembly-size histogram: 419 chunks < 12 KB · 82 at 12–64 KB · 24 ≥ 64 KB.

## Fan-in (build-order signal; top 40 within the assembly set)

| importers | chunk | bytes | vendor |
|---:|---|---:|---|
| 342 | `rolldown-runtime.C0FnF6B9.js` | 1648 | yes |
| 297 | `react.Bfm_Hgom.js` | 8234 | yes |
| 261 | `jsx-runtime.BH9nBM82.js` | 793 | yes |
| 111 | `mobxreactlite.BAMBvwfh.js` | 3520 | yes |
| 97 | `mixins.stylex.BUgiQC4g.js` | 6007 | yes |
| 93 | `Flex.BS495mgi.js` | 4952 |  |
| 91 | `RefreshManager.DpVjn8XM.js` | 614563 |  |
| 86 | `Text.gv7OudGa.js` | 3186 |  |
| 85 | `Icon.DpisucLQ.js` | 4112 |  |
| 72 | `ThemeProvider.BNrg3wTr.js` | 11644 |  |
| 63 | `stylex.CiFZl61Z.js` | 1800 | yes |
| 63 | `Tooltip.D36Ev20e.js` | 20538 |  |
| 62 | `types.7f0h45Sh.js` | 76355 | yes |
| 58 | `mobx.BEIB-Y2s.js` | 48195 | yes |
| 57 | `Avatar.DGwSs61a.js` | 271487 |  |
| 57 | `time.Dn7wnS7i.js` | 15326 | yes |
| 53 | `Button.DD4dEZh7.js` | 11034 |  |
| 53 | `UnreachableCaseError.gONpwKHj.js` | 521 |  |
| 53 | `useStore.BpZDR8VN.js` | 551 | yes |
| 49 | `Logger.qFaEBF6-.js` | 243018 |  |
| 46 | `ActionGroups.DFZZ7QMk.js` | 22253 |  |
| 46 | `useUser.CGqqjeJr.js` | 430 | yes |
| 43 | `PullRequestsFeatureHelper.woc0KNxh.js` | 54748 |  |
| 42 | `hooks.D4LfSm6u.js` | 73952 | yes |
| 41 | `ActionTrigger.CLIWDN56.js` | 9876 |  |
| 41 | `browser.B82UtVRh.js` | 3872 | yes |
| 40 | `FeatureFlagIcon.DOHP4b1a.js` | 17066 |  |
| 40 | `nodes.DrSymAVM.js` | 261187 | yes |
| 35 | `MarkdownTransformer.DI8Fsgra.js` | 178846 |  |
| 34 | `IconButton.B46fVFUo.js` | 1289 |  |
| 33 | `Toast.BT3vaG2a.js` | 12193 |  |
| 32 | `useAsRef.CJh9aSjD.js` | 544 | yes |
| 32 | `useComputed.Vpsf1omy.js` | 570 | yes |
| 31 | `Link.B583WaeA.js` | 17349 |  |
| 31 | `resolvePromise.B8FauNXm.js` | 3077 | yes |
| 31 | `useScreenSize.BOSsj2U3.js` | 920 | yes |
| 30 | `Decorators.Du6V7UQY.js` | 148839 |  |
| 30 | `validation.DM_YZW7p.js` | 41684 | yes |
| 29 | `DecorativeIcon.DUPAyWLO.js` | 9069 |  |
| 29 | `suspenseObserver.Cawdgu7K.js` | 4979 | yes |

## Monster demand (facade surface per #295 R-FACADE)

| monster | exports total | demanded by assembly set | importing chunks |
|---|---:|---:|---:|
| `ContextualMenuActions.Dlg9Oa2U.js` | 2325 | 506 | 96 |
| `Issue.DRYymPCa.js` | 1316 | 639 | 137 |

Full demanded-symbol lists and the complete assembly file list live in the machine snapshot `extracts/assembly-graph.json` (same generation run).
