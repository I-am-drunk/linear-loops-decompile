/**
 * Tests for the conversation mappers + the Part ⇄ ActivityPartContent
 * one-definition rule. Zero-dep: node --experimental-strip-types --test.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runToConversation, turnToConversationTurn, turnsToConversationTurns } from "./conversation-map.ts";
import { Runner } from "./runner.ts";
import { ScriptBrain } from "./brain.ts";
import type { Part } from "./types.ts";
import type { ActivityPartContent } from "../model/conversation.ts";

function deps() {
  let tick = 0;
  let id = 0;
  return {
    now: () => new Date(Date.UTC(2026, 8, 27, 1, 0, tick++)),
    idgen: () => `id-${id++}`,
  };
}

describe("conversation mapping", () => {
  it("maps a finished run to a workflow conversation", async () => {
    const brain = new ScriptBrain([[{ kind: "thought", text: "t" }, { kind: "response", text: "r" }]]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-9", message: "go", brain });
    const done = await runner.whenIdle(run.id);

    const conv = runToConversation(done, "2026-09-27T01:05:00.000Z");
    assert.equal(conv.id, run.id);
    assert.equal(conv.initialSource, "workflow");
    assert.equal(conv.isWorkflowRun, true);
    assert.equal(conv.workflowDefinitionId, "loop-9");
    assert.equal(conv.status, "complete");

    const convTurns = turnsToConversationTurns(runner.getTurns(run.id), conv.id);
    assert.equal(convTurns.length, 1);
    assert.equal(convTurns[0]!.conversationId, conv.id);
    assert.deepEqual(convTurns[0]!.parts.map((p) => p.kind), ["thought", "response"]);
  });

  it("maps user turns (steer/answer) with role + steered part intact", async () => {
    const brain = new ScriptBrain([
      [{ kind: "elicitation", elicitationKind: "freeText", prompt: "name?" }],
      [{ kind: "response", text: "hi" }],
    ]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    await runner.whenIdle(run.id);
    runner.respond(run.id, "agent-03");
    await runner.whenIdle(run.id);

    const convTurns = turnsToConversationTurns(runner.getTurns(run.id), run.id);
    assert.deepEqual(convTurns.map((t) => t.role), ["agent", "user", "agent"]);
    assert.deepEqual(convTurns[1]!.parts, [{ kind: "steered", text: "agent-03" }]);
  });

  it("conversation records survive a JSON round-trip (they are persisted)", async () => {
    const brain = new ScriptBrain([[{ kind: "response", text: "r" }]]);
    const runner = new Runner(deps());
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    await runner.whenIdle(run.id);
    const conv = runToConversation(runner.getRun(run.id), "2026-09-27T01:06:00.000Z");
    const roundTripped = JSON.parse(JSON.stringify(conv)) as unknown;
    assert.deepEqual(roundTripped, conv);
  });

  it("Part and ActivityPartContent are interchangeable at runtime AND type level", () => {
    const asModel: ActivityPartContent[] = [
      { kind: "thought", text: "t" },
      { kind: "action", tool: "linear", label: "Comment", argsSummary: "{…}" },
      { kind: "elicitation", elicitationKind: "select", prompt: "p", choices: ["a"] },
      { kind: "steered", text: "u" },
      { kind: "error", message: "e" },
      { kind: "response", text: "r" },
    ];
    // If these ever stop being the same union, conversation-map.ts's
    // compile-time guard breaks the build — this test is the runtime mirror.
    const asRuntime: Part[] = asModel;
    assert.equal(asRuntime.length, 6);
  });
});
