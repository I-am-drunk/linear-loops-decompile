# @loops/model — domain types + validation (R2, T-201)

Original TypeScript types for the loops server and UI, with a zod schema as
the single write-gate for persisted loop configs. Behavior is derived from
decompiling Linear 1.32.4 (KNOWLEDGE.md §3, SPECS/loops.md); no Linear code
is used here.

## Files

| File | Contents |
|---|---|
| `enums.ts` | All string-literal unions + their runtime `as const` value arrays. |
| `loop.ts` | `LoopConfig`, `WorkflowDefinition`, `WorkflowDefinitionDraft`, `WorkflowCronJobDefinition`, `LoopExecution`, triggers/conditions/schedule/stats. |
| `loop-config.ts` | Zod schemas, `parseLoopConfig()` (never throws), `defaultLoopConfig()`. |
| `loop-config.test.ts` | Fixture tests (no network). |
| `index.ts` | Barrel export. |

## Concept → spec map

| Our type | Linear concept (KNOWLEDGE.md §3) | Spec |
|---|---|---|
| `WorkflowDefinition` | `WorkflowDefinition` (a "Loop") | SPECS/loops.md §concepts |
| `LoopConfig` | the persisted config fields | SPECS/loops.md §loop-config-fields |
| `WorkflowDefinitionDraft` | `WorkflowDefinitionDraft` | SPECS/loops.md §concepts (draft/publish) |
| `WorkflowCronJobDefinition` | `WorkflowCronJobDefinition` | SPECS/loops.md §trigger-model |
| `LoopExecution` | `LoopExecution` (run ↔ target join) | SPECS/loops.md §concepts |
| `LoopTrigger` / `LoopCondition` | triggerType / activationMode / conditions | SPECS/loops.md §trigger-model, §condition-semantics |
| `RUN_STATUSES`, part kinds | run/conversation lifecycle | SPECS/agent.md §runtime-contract |
| `LoopStats` | `loopRunStats` (our cost = own inference, R6) | SPECS/target-architecture.md §data-ownership |

## Field mapping vs Linear (for anyone reading the corpus)

| Linear field | Ours |
|---|---|
| `triggerType` + `trigger` + `activationMode` (siblings) | one `trigger` discriminated union (`trigger.type`, `trigger.activationMode`) |
| `triggerConfig` / `schedule` | `trigger.schedule` (only on schedule triggers) |
| flat entity fields on `LoopExecution` (issue, project, …) | one `target: { entityType, entityId }` |
| `prompt` (rich doc) | `prompt: { format: "markdown", markdown }` (v1) |
| `editAccess` | `editAccess: owner | team | organization` (v1 simplification) |
| `stats` / `lastExecutedAt` | same names, our computation |
| server/sync fields (policies, traits, drafts-on-model, notifications…) | not built (non-goals, SPECS/target-architecture.md) |

## Design decisions (log-worthy)

- **zod dependency justified** — KNOWLEDGE.md §3 shows Linear validates loop
  config with zod; mirroring with our own schema is in the T-201 contract.
  Runtime deps: zod only. Everything else stdlib.
- **Discriminated unions over sibling optionals** — invalid trigger/condition
  combinations are unrepresentable instead of runtime-checked conventions.
- **`as const` arrays + derived types** — zod enums and TS types share one
  source of truth.
- **`.ts` import extensions + `allowImportingTsExtensions`** — the package is
  consumed as source (house style: Node 22 + TS, no build step); tests run on
  Node 22 type stripping. `tsc --noEmit` is the only gate.

## Verify

```bash
cd src/model
npm install
npm run typecheck   # tsc --noEmit — must be clean
npm test            # node --experimental-strip-types --test
```

## Consuming

Until the repo root gains workspace config (integrator), import by relative
path, e.g. `import type { LoopConfig } from "../model/index.ts"`. The package
name `@loops/model` is reserved for when a root `package.json` lands.
