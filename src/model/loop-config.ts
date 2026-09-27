/**
 * Zod schema for the loop config the server persists, plus parse helpers.
 *
 * This is the single validation gate between the editor (R7) / connect RPCs
 * (R9) and the SQLite store: a loop config is only ever written after
 * `parseLoopConfig` accepts it. The schema's output is checked at compile
 * time to stay assignable to the hand-written `LoopConfig` (loop.ts), which
 * remains the canonical domain type.
 *
 * Cross-field rules Linear enforces (verified in KNOWLEDGE.md §3) are encoded
 * here as refinements rather than left to convention:
 *   - an RRULE must declare FREQ;
 *   - `inTriage` events only apply to issues;
 *   - `watchedPropertyChanged` triggers must declare watched properties;
 *   - regex comment patterns must compile.
 */

import { z } from "zod";
import {
  CODE_ACCESS_LEVELS,
  COLLECTION_CHANGE_OPERATIONS,
  LOOP_ACTIVATION_MODES,
  LOOP_ACTIVITIES,
  LOOP_EDIT_ACCESS,
  LOOP_EVENT_ENTITIES,
  LOOP_EVENT_KINDS,
  PROPERTY_FILTER_OPS,
} from "./enums.ts";
import type { LoopConfig } from "./loop.ts";

const idSchema = z.string().min(1).max(64);

export const promptContentSchema = z.object({
  format: z.literal("markdown"),
  markdown: z.string().min(1, "a loop needs a prompt").max(100_000),
});

export const loopScheduleSchema = z
  .object({
    rrule: z.string().min(3).max(500),
    timezone: z.string().min(1).max(64),
  })
  .refine((s) => /(^|;)FREQ=/.test(s.rrule), {
    message: "rrule must declare FREQ (RFC 5545), e.g. FREQ=DAILY;BYHOUR=9",
    path: ["rrule"],
  });

const loopEventSchema = z
  .object({
    entity: z.enum(LOOP_EVENT_ENTITIES),
    kind: z.enum(LOOP_EVENT_KINDS),
  })
  .refine((e) => e.kind !== "inTriage" || e.entity === "issue", {
    message: "the inTriage event only applies to issues",
    path: ["kind"],
  });

export const loopTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("schedule"), schedule: loopScheduleSchema }),
  z.object({ type: z.literal("chat") }),
  z.object({
    type: z.literal("event"),
    event: loopEventSchema,
    activationMode: z.enum(LOOP_ACTIVATION_MODES),
  }),
]);

/**
 * Note on `commentMatch`: when `isRegex` is set the pattern is user-supplied.
 * The engine (R4) must evaluate it with a bounded matcher (timeout or a
 * linear-time engine) — the schema only guarantees it compiles.
 */
export const loopConditionSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("watchedProperties"),
      properties: z.array(z.string().min(1).max(128)).min(1).max(64),
    }),
    z.object({
      kind: z.literal("collectionChange"),
      property: z.string().min(1).max(128),
      operation: z.enum(COLLECTION_CHANGE_OPERATIONS),
    }),
    z.object({
      kind: z.literal("commentMatch"),
      pattern: z.string().min(1).max(1000),
      isRegex: z.boolean(),
    }),
    z.object({
      kind: z.literal("propertyFilter"),
      property: z.string().min(1).max(128),
      op: z.enum(PROPERTY_FILTER_OPS),
      value: z.union([
        z.string().max(1000),
        z.number(),
        z.boolean(),
        z.array(z.string().max(1000)).min(1).max(64),
      ]),
    }),
  ])
  .superRefine((c, ctx) => {
    if (c.kind === "commentMatch" && c.isRegex) {
      try {
        new RegExp(c.pattern);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "pattern is not a valid regular expression",
          path: ["pattern"],
        });
      }
    }
  });

export const loopConfigSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    groupName: z.string().max(80).optional(),
    description: z.string().max(2000).optional(),
    icon: z.string().min(1).max(32).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "hex color like #5e6ad2")
      .optional(),
    teamId: idSchema.optional(),
    projectId: idSchema.optional(),
    prompt: promptContentSchema,
    trigger: loopTriggerSchema,
    conditions: z.array(loopConditionSchema).max(32),
    enabled: z.boolean(),
    applyToSubTeams: z.boolean(),
    activities: z.array(z.enum(LOOP_ACTIVITIES)).min(1).max(16),
    trustedSourceKeys: z.array(z.string().min(1).max(128)).max(64),
    codeAccess: z.enum(CODE_ACCESS_LEVELS),
    editAccess: z.enum(LOOP_EDIT_ACCESS),
    subscriberIds: z.array(idSchema).max(256),
  })
  .superRefine((c, ctx) => {
    if (
      c.trigger.type === "event" &&
      c.trigger.activationMode === "watchedPropertyChanged" &&
      !c.conditions.some((x) => x.kind === "watchedProperties")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "a watchedPropertyChanged trigger needs at least one watchedProperties condition",
        path: ["conditions"],
      });
    }
  });

export type LoopConfigParsed = z.output<typeof loopConfigSchema>;
export type LoopConfigInput = z.input<typeof loopConfigSchema>;

/**
 * Compile-time guard: the schema's parsed output must remain assignable to
 * the canonical hand-written type. If a schema edit drifts from LoopConfig,
 * this line stops compiling.
 */
const _schemaMatchesDomainType: (parsed: LoopConfigParsed) => LoopConfig = (
  parsed,
) => parsed;

export type ParseLoopConfigResult =
  | { ok: true; config: LoopConfig }
  | { ok: false; issues: { path: string; message: string }[] };

/**
 * Validate an untrusted config (from the editor, an RPC payload, or a row
 * read back from SQLite). Never throws; issues are flattened to
 * `path: message` pairs suitable for form display.
 */
export function parseLoopConfig(input: unknown): ParseLoopConfigResult {
  const result = loopConfigSchema.safeParse(input);
  if (result.success) return { ok: true, config: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}

/**
 * Scaffold for the "New loop" flow (R7): a disabled, hourly schedule loop
 * with comment-only capability. Passes parseLoopConfig as-is.
 */
export function defaultLoopConfig(): LoopConfig {
  return {
    name: "New loop",
    prompt: { format: "markdown", markdown: "Describe what this loop should do each time it runs." },
    trigger: { type: "schedule", schedule: { rrule: "FREQ=HOURLY", timezone: "UTC" } },
    conditions: [],
    enabled: false,
    applyToSubTeams: false,
    activities: ["comment"],
    trustedSourceKeys: [],
    codeAccess: "none",
    editAccess: "owner",
    subscriberIds: [],
  };
}
