/**
 * Official AgentSessionStatus mapping (T-504) — the golden-goose seam.
 *
 * The official enum (extracts/linear-official/AGENT-API.md, MIT schema):
 *
 *   AgentSessionStatus { active, awaitingInput, complete, error, pending, stale }
 *
 * Our runtime vocabulary is a superset: two extras (`waiting`, `canceled`)
 * plus — since T-504 — the same `stale`. Export rule (the AGENT-API.md
 * divergence table's resolution):
 *
 * - `canceled → stale` — Linear has no canceled; a session the user stopped
 *   with the `stop` signal derives no further activity, which is exactly
 *   what `stale` means on their side.
 * - `waiting → pending` — the queue hold folds into not-yet-started.
 * - `stale → stale` — unresponsive is unresponsive.
 *
 * Consumers: the dataplane agent-sessions module (T-305) when it presents
 * our runs through Linear's agent surface, and any status badge that wants
 * the official vocabulary. Original code.
 */

import type { RunStatus } from "../model/enums.ts";

export const OFFICIAL_AGENT_SESSION_STATUSES = [
  "active",
  "awaitingInput",
  "complete",
  "error",
  "pending",
  "stale",
] as const;
export type OfficialAgentSessionStatus = (typeof OFFICIAL_AGENT_SESSION_STATUSES)[number];

/** Exhaustive by construction — adding a RunStatus without a mapping stops compiling. */
const TO_OFFICIAL: Readonly<Record<RunStatus, OfficialAgentSessionStatus>> = {
  pending: "pending",
  waiting: "pending",
  active: "active",
  awaitingInput: "awaitingInput",
  complete: "complete",
  error: "error",
  canceled: "stale",
  stale: "stale",
};

/** Map one of our run statuses onto Linear's official AgentSessionStatus. */
export function toOfficialAgentSessionStatus(status: RunStatus): OfficialAgentSessionStatus {
  return TO_OFFICIAL[status];
}
