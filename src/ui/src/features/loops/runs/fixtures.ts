/**
 * T-703 — runs fixtures for the pre-R9 registry wiring. Cover: every status,
 * target/no-target, durations, costs, a live run with a streaming tail, an
 * awaitingInput run with an elicitation, and a finished run to continue.
 */
import type { RunDetail, RunSummary } from "./types.ts";

const NOW = Date.parse("2026-09-27T01:30:00.000Z");
const ago = (ms: number): string => new Date(NOW - ms).toISOString();

export const demoRuns: readonly RunSummary[] = [
  {
    id: "run-8", loopId: "standup-scribe", loopName: "Standup scribe",
    status: "awaitingInput", createdAt: ago(50_000), startedAt: ago(45_000),
  },
  {
    id: "run-7", loopId: "triage-daily", loopName: "Triage digest",
    status: "active", createdAt: ago(20_000), startedAt: ago(18_000),
    target: { entityType: "issue", label: "SUP-214" },
  },
  {
    id: "run-6", loopId: "triage-daily", loopName: "Triage digest",
    status: "complete", createdAt: ago(3_600_000), startedAt: ago(3_600_000), endedAt: ago(3_559_000),
    durationMs: 41_000, costUsd: 0.0042, target: { entityType: "issue", label: "SUP-209" },
  },
  {
    id: "run-5", loopId: "sla-watch", loopName: "SLA watch",
    status: "error", createdAt: ago(86_400_000), startedAt: ago(86_400_000), endedAt: ago(86_388_000),
    durationMs: 12_000, costUsd: 0.0018, target: { entityType: "issue", label: "SUP-201" },
  },
  {
    id: "run-4", loopId: "release-notes", loopName: "Release notes drafter",
    status: "canceled", createdAt: ago(2 * 86_400_000), startedAt: ago(2 * 86_400_000), endedAt: ago(2 * 86_400_000 - 8_000),
    durationMs: 8_000, target: { entityType: "release", label: "v2.14" },
  },
];

export const demoRunDetail: RunDetail = {
  ...demoRuns[0]!,
  summary: "Drafting the standup summary; one answer needed before posting.",
  usage: { inputTokens: 1240, outputTokens: 340, costUsd: 0.0031 },
  activities: [
    { kind: "thought", id: "p1", position: 1, text: "The thread has 14 new messages since yesterday 09:00." },
    { kind: "action", id: "p2", position: 2, tool: "linear.comments", label: "Read comments", argsSummary: "issue SUP-312", resultSummary: "14 comments" },
    { kind: "thought", id: "p3", position: 3, text: "Three people flagged blockers; group the summary by person." },
    { kind: "response", id: "p4", position: 4, text: "Draft ready. Mara: 2 updates, 1 blocker. Tom: 3 updates." },
    { kind: "elicitation", id: "p5", position: 5, elicitationKind: "select", prompt: "Post the summary as a comment on SUP-312?", choices: ["Post", "Edit first", "Discard"] },
  ],
};

export const demoRunDetailLive: RunDetail = {
  ...demoRuns[1]!,
  summary: "Summarizing new triage issues.",
  usage: { inputTokens: 610, outputTokens: 120, costUsd: 0.0011 },
  activities: [
    { kind: "thought", id: "p1", position: 1, text: "Two issues entered triage since the last run." },
    { kind: "action", id: "p2", position: 2, tool: "linear.issues", label: "Read issue", argsSummary: "SUP-214", resultSummary: "title, priority, labels" },
  ],
};

export const demoRunDetailDone: RunDetail = {
  ...demoRuns[2]!,
  summary: "Posted the triage digest as a comment on SUP-209.",
  usage: { inputTokens: 2_180, outputTokens: 412, costUsd: 0.0042 },
  activities: [
    { kind: "thought", id: "p1", position: 1, text: "Six new triage issues overnight." },
    { kind: "action", id: "p2", position: 2, tool: "linear.commentCreate", label: "Post comment", argsSummary: "issue SUP-209", resultSummary: "comment created" },
    { kind: "response", id: "p3", position: 3, text: "Digest posted: 6 issues, 2 urgent." },
  ],
};
