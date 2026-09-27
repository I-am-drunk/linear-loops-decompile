/**
 * Demo loops for the pre-R9 registry wiring. Cover every branch of the list:
 * group/team/workspace grouping, schedule/chat/event triggers, every chip
 * tone, a disabled loop, and a never-run loop.
 */
import type { LoopSummary } from "./types.ts";

const NOW = Date.parse("2026-09-27T00:00:00.000Z");
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

export const demoLoops: readonly LoopSummary[] = [
  {
    id: "triage-daily",
    name: "Triage digest",
    icon: "📋",
    color: "#6e78e8",
    description: "Summarize new triage issues every morning.",
    groupName: "Support",
    teamName: "Support",
    ownerName: "Mara",
    enabled: true,
    trigger: { type: "schedule", schedule: { rrule: "FREQ=DAILY", timezone: "UTC" } },
    lastRun: { status: "complete", at: ago(3_600_000), durationMs: 41_000 },
  },
  {
    id: "sla-watch",
    name: "SLA watch",
    color: "#e5534b",
    teamName: "Support",
    ownerName: "Mara",
    enabled: true,
    trigger: {
      type: "event",
      event: { entity: "issue", kind: "inTriage" },
      activationMode: "collectionChanged",
    },
    lastRun: { status: "error", at: ago(86_400_000), durationMs: 12_000 },
  },
  {
    id: "standup-scribe",
    name: "Standup scribe",
    icon: "✍️",
    color: "#57ab5a",
    description: "Post a standup thread summary on weekdays.",
    groupName: "Eng",
    teamName: "Engineering",
    ownerName: "Tom",
    enabled: true,
    trigger: { type: "schedule", schedule: { rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", timezone: "UTC" } },
    lastRun: { status: "awaitingInput", at: ago(7_200_000) },
  },
  {
    id: "release-notes",
    name: "Release notes drafter",
    teamName: "Engineering",
    ownerName: "Tom",
    enabled: false,
    trigger: {
      type: "event",
      event: { entity: "release", kind: "created" },
      activationMode: "collectionChanged",
    },
    lastRun: { status: "canceled", at: ago(3 * 86_400_000) },
  },
  {
    id: "mention-helper",
    name: "Mention helper",
    icon: "💬",
    ownerName: "Workspace",
    enabled: true,
    trigger: { type: "chat" },
  },
];
