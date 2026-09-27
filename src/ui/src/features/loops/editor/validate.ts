/**
 * T-702 — client-side mirror of the model's zod gate
 * (src/model/loop-config.ts → parseLoopConfig). Zero-dep by design: the UI
 * package carries no zod, so the refinements are mirrored by hand and held
 * in lockstep by test/loop-editor.test.ts, which runs both validators over
 * the same fixtures and asserts identical verdicts (and identical messages
 * where the schema names them).
 *
 * Publish is disabled while this returns issues; the first issue is named
 * next to the button (settled design, hub #21 00:04:17Z).
 */
import type { LoopConfig } from "../../../../../model/index.ts";
import type { ValidationIssue } from "./types.ts";

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const FREQ_RE = /(^|;)FREQ=/;

/** Mirror of parseLoopConfig — same verdicts, same named messages. */
export function validateLoopConfig(config: LoopConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  // identity
  if (config.name.trim().length === 0) push("name", "Name is required");
  else if (config.name.trim().length > 120) push("name", "Name is too long (max 120)");
  if (config.groupName !== undefined && config.groupName.length > 80)
    push("groupName", "Group name is too long (max 80)");
  if (config.description !== undefined && config.description.length > 2000)
    push("description", "Description is too long (max 2000)");
  if (config.icon !== undefined && (config.icon.length < 1 || config.icon.length > 32))
    push("icon", "Icon is too long (max 32)");
  if (config.color !== undefined && !COLOR_RE.test(config.color))
    push("color", "hex color like #5e6ad2");

  // prompt
  if (config.prompt.markdown.length === 0) push("prompt.markdown", "a loop needs a prompt");
  else if (config.prompt.markdown.length > 100_000)
    push("prompt.markdown", "Prompt is too long (max 100000)");

  // trigger
  const trigger = config.trigger;
  if (trigger.type === "schedule") {
    const r = trigger.schedule.rrule;
    if (r.length < 3) push("trigger.schedule.rrule", "Schedule rule is too short");
    else if (r.length > 500) push("trigger.schedule.rrule", "Schedule rule is too long (max 500)");
    else if (!FREQ_RE.test(r))
      push("trigger.schedule.rrule", "rrule must declare FREQ (RFC 5545), e.g. FREQ=DAILY;BYHOUR=9");
    if (trigger.schedule.timezone.trim().length === 0)
      push("trigger.schedule.timezone", "Timezone is required (IANA name)");
  } else if (trigger.type === "event") {
    if (trigger.event.kind === "inTriage" && trigger.event.entity !== "issue")
      push("trigger.event.kind", "the inTriage event only applies to issues");
    if (
      trigger.activationMode === "watchedPropertyChanged" &&
      !config.conditions.some((c) => c.kind === "watchedProperties")
    )
      push("conditions", "a watchedPropertyChanged trigger needs at least one watchedProperties condition");
  }

  // conditions
  if (config.conditions.length > 32) push("conditions", "Too many conditions (max 32)");
  config.conditions.forEach((c, i) => {
    const at = `conditions.${i}`;
    switch (c.kind) {
      case "watchedProperties":
        if (c.properties.length === 0) push(`${at}.properties`, "Add at least one property");
        if (c.properties.length > 64) push(`${at}.properties`, "Too many properties (max 64)");
        if (c.properties.some((p) => p.trim().length === 0))
          push(`${at}.properties`, "Property names must not be empty");
        break;
      case "collectionChange":
        if (c.property.trim().length === 0) push(`${at}.property`, "Property is required");
        break;
      case "commentMatch":
        if (c.pattern.length === 0) push(`${at}.pattern`, "Pattern is required");
        else if (c.isRegex) {
          try {
            new RegExp(c.pattern);
          } catch {
            push(`${at}.pattern`, "pattern is not a valid regular expression");
          }
        }
        break;
      case "propertyFilter":
        if (c.property.trim().length === 0) push(`${at}.property`, "Property is required");
        if (typeof c.value === "string" && c.value.length === 0)
          push(`${at}.value`, "Value is required");
        if (Array.isArray(c.value) && c.value.length === 0)
          push(`${at}.value`, "Add at least one value");
        break;
    }
  });

  // capabilities
  if (config.activities.length === 0) push("activities", "Select at least one activity");
  if (config.activities.length > 16) push("activities", "Too many activities (max 16)");
  if (config.trustedSourceKeys.length > 64)
    push("trustedSourceKeys", "Too many trusted sources (max 64)");

  return issues;
}

/** The one-line reason shown next to a disabled Publish button. */
export function firstIssue(issues: readonly ValidationIssue[]): ValidationIssue | null {
  return issues.length === 0 ? null : issues[0]!;
}
