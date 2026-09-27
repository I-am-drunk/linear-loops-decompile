/**
 * T-702 — editor fixtures for the pre-R9 registry wiring.
 */
import type { LoopConfig } from "../../../../../model/index.ts";
import type { NamedId, TrustedSourceOption } from "./types.ts";

export const demoEditorConfig: LoopConfig = {
  name: "Standup scribe",
  icon: "✍️",
  color: "#57ab5a",
  groupName: "Eng",
  description: "Post a standup thread summary on weekdays.",
  teamId: "team-eng",
  prompt: {
    format: "markdown",
    markdown:
      "Summarize the standup thread since yesterday.\n\n- Group by person\n- Flag blockers\n- Post as a comment on the standup issue",
  },
  trigger: {
    type: "schedule",
    schedule: { rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0", timezone: "UTC" },
  },
  conditions: [],
  enabled: true,
  applyToSubTeams: false,
  activities: ["comment"],
  trustedSourceKeys: ["slack"],
  codeAccess: "none",
  editAccess: "team",
  subscriberIds: [],
};

export const demoTeams: readonly NamedId[] = [
  { id: "team-eng", name: "Engineering" },
  { id: "team-support", name: "Support" },
];

export const demoProjects: readonly NamedId[] = [
  { id: "proj-mobile", name: "Mobile app" },
  { id: "proj-api", name: "API v2" },
];

export const demoTrustedSources: readonly TrustedSourceOption[] = [
  { key: "slack", label: "Slack" },
  { key: "github", label: "GitHub" },
  { key: "sentry", label: "Sentry" },
];
