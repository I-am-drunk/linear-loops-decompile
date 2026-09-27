/**
 * Trigger → one-line label for the row sub-line ("trigger · owner").
 * Pure; strip-types safe. The RRULE reader is deliberately tiny: it labels
 * the common FREQ shapes and falls back to the raw rule for anything else —
 * the editor (T-702) never rewrites a rule it doesn't understand, and the
 * list never hides one.
 */
import type { LoopTrigger } from "../../../../model/index.ts";

const FREQ_LABELS: Record<string, string> = {
  HOURLY: "Hourly",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const WEEKDAYS: Record<string, string> = {
  MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
};

/** "Weekly · Mon, Wed" / "Daily" / "Hourly"; raw rule when it's not a FREQ shape. */
export function scheduleLabel(rrule: string): string {
  const parts: Record<string, string> = {};
  for (const kv of rrule.split(";")) {
    const eq = kv.indexOf("=");
    if (eq > 0) parts[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1).toUpperCase();
  }
  const freq = parts["FREQ"];
  if (!freq) return "Custom schedule";
  const base = FREQ_LABELS[freq] ?? `Custom (${rrule})`;
  if (freq === "WEEKLY" && parts["BYDAY"]) {
    const days = parts["BYDAY"]
      .split(",")
      .map((d) => WEEKDAYS[d.trim()] ?? d.trim())
      .join(", ");
    return `${base} · ${days}`;
  }
  const interval = parts["INTERVAL"];
  if (interval && interval !== "1") return `${base} · every ${interval}`;
  return base;
}

const ENTITY_LABELS: Record<string, string> = {
  issue: "Issue",
  project: "Project",
  initiative: "Initiative",
  document: "Document",
  comment: "Comment",
  team: "Team",
  cycle: "Cycle",
  release: "Release",
};

/** "Issue created", "Project updated", "Issue in triage", "Chat", "Daily"… */
export function triggerLabel(trigger: LoopTrigger): string {
  switch (trigger.type) {
    case "schedule":
      return scheduleLabel(trigger.schedule.rrule);
    case "chat":
      return "Chat mention";
    case "event": {
      const entity = ENTITY_LABELS[trigger.event.entity] ?? trigger.event.entity;
      const kind =
        trigger.event.kind === "inTriage"
          ? "in triage"
          : trigger.event.kind; // created | updated
      return `${entity} ${kind}`;
    }
  }
}
