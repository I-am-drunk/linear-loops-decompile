# #225 — historical harness findings

Closed thread; body and all 250 comments reviewed. These are retained findings and in-thread corrections, not fresh verification of current code. Old claims, freezes, vault tooling, effort ratios and reclaim windows are retired.

| Retain | Evidence and consequence |
|---|---|
| Independent reference execution | Comparing two authored fact sets cannot establish parity. The [owner pivot](https://github.com/I-am-drunk/linear-loops-decompile/issues/220) requires real reference execution with declared observations. |
| Provenance | [Source](https://github.com/I-am-drunk/linear-loops-decompile/issues/225#issuecomment-5860636924). Record corpus identity, drivers, stubs and intercepted imports. Replaying old output is not a fresh reference run. |
| Ambient assumptions | [Source](https://github.com/I-am-drunk/linear-loops-decompile/issues/225#issuecomment-5860750577). A correction reduced 52 alleged module-time captures to three and revised timezone behavior. Shared assumptions can make independent analyses agree incorrectly. |
| Faithful serialization | [Source](https://github.com/I-am-drunk/linear-loops-decompile/issues/225#issuecomment-5861139718). Dates collapsing to empty objects hide real differences. Preserve supported types and reject shapes the format cannot distinguish. |
| Declared renderer boundaries | [Source](https://github.com/I-am-drunk/linear-loops-decompile/issues/225#issuecomment-5861290410). An H-only React bridge failed on transition-slot use. Equal icon output did not prove component, context or interaction equivalence. |
| Error visibility and fixtures | [Source](https://github.com/I-am-drunk/linear-loops-decompile/issues/225#issuecomment-5861587679). Suspense could turn missing contexts into stable empty output; proxy fixtures could become accidental thenables. Report errors and actual exercised branches. |
| Raw source authority | [Source](https://github.com/I-am-drunk/linear-loops-decompile/issues/225#issuecomment-5860907180). Parse success missed value-changing prettifier edits. Raw execution is authoritative; readable projections need semantic checks. |
| Same lifecycle on both sides | [Source](https://github.com/I-am-drunk/linear-loops-decompile/issues/225#issuecomment-5898413949). A clean-side observation driver must execute the same inputs and lifecycle as the reference; importing a golden does not establish that. |
| Probe untested branches | [Source](https://github.com/I-am-drunk/linear-loops-decompile/issues/225#issuecomment-5900530077). The team-tree flat branch diverged despite passing covered cases. A test of a plausible derivation was not independent evidence. |
| Verify consumers and files | [Source](https://github.com/I-am-drunk/linear-loops-decompile/issues/225#issuecomment-5901469858). Review corrected a claim that notification kernels were wired into views which did not exist. Intended integration must stay labeled until implemented. |

Coverage counts must name their unit and source version: routes, chunks, exports and rendered behaviors are different denominators. Import scans missed backtick lazy imports; matrix grammar dropped valid references. Details and corrections continue in the #295 synthesis.

The thread retired claims to #314–#319. Its final claim that all learnings were preserved is historical prose: the cited digest was subsequently removed. This audit restores original summaries and source links, not that removed transcription.
