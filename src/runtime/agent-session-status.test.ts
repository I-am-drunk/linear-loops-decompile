/**
 * Tests for the official AgentSessionStatus mapping (T-504) — the export
 * rule from extracts/linear-official/AGENT-API.md's divergence table.
 * Zero-dep: node --experimental-strip-types --test.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RUN_STATUSES } from "../model/enums.ts";
import {
  OFFICIAL_AGENT_SESSION_STATUSES,
  toOfficialAgentSessionStatus,
} from "./agent-session-status.ts";

describe("toOfficialAgentSessionStatus (T-504)", () => {
  it("maps every RunStatus onto the official enum (exhaustive)", () => {
    for (const status of RUN_STATUSES) {
      const official = toOfficialAgentSessionStatus(status);
      assert.ok(
        (OFFICIAL_AGENT_SESSION_STATUSES as readonly string[]).includes(official),
        `${status} → ${official} must be an official AgentSessionStatus`,
      );
    }
  });

  it("resolves the divergence table: canceled → stale, stale → stale", () => {
    assert.equal(toOfficialAgentSessionStatus("canceled"), "stale");
    assert.equal(toOfficialAgentSessionStatus("stale"), "stale");
  });

  it("folds the queue hold state: waiting → pending", () => {
    assert.equal(toOfficialAgentSessionStatus("waiting"), "pending");
    assert.equal(toOfficialAgentSessionStatus("pending"), "pending");
  });

  it("passes the shared vocabulary through unchanged", () => {
    for (const status of ["active", "awaitingInput", "complete", "error"] as const) {
      assert.equal(toOfficialAgentSessionStatus(status), status);
    }
  });

  it("every official status is reachable from some RunStatus", () => {
    const reached = new Set(RUN_STATUSES.map((s) => toOfficialAgentSessionStatus(s)));
    for (const official of OFFICIAL_AGENT_SESSION_STATUSES) {
      assert.ok(reached.has(official), `${official} is reachable`);
    }
  });
});
