/**
 * Fixture tests for the loop-config schema. Runs on Node 22 type stripping:
 *   node --experimental-strip-types --test loop-config.test.ts
 * No Linear network access; fixtures are hand-built from SPECS/loops.md.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultLoopConfig,
  loopConfigSchema,
  parseLoopConfig,
} from "./loop-config.ts";
import type { LoopConfig } from "./loop.ts";

function validEventConfig(): LoopConfig {
  return {
    name: "Triage triager",
    groupName: "Support",
    description: "Replies to newly triaged support issues.",
    icon: "🎯",
    color: "#5e6ad2",
    teamId: "team_01",
    prompt: {
      format: "markdown",
      markdown: "Summarize the issue and suggest next steps as a comment.",
    },
    trigger: {
      type: "event",
      event: { entity: "issue", kind: "inTriage" },
      activationMode: "collectionChanged",
    },
    conditions: [
      {
        kind: "propertyFilter",
        property: "priority",
        op: "in",
        value: ["urgent", "high"],
      },
    ],
    enabled: true,
    applyToSubTeams: true,
    activities: ["comment"],
    trustedSourceKeys: ["slack-support"],
    codeAccess: "none",
    editAccess: "team",
    subscriberIds: ["user_01", "user_02"],
  };
}

test("a full event-triggered loop config parses", () => {
  const result = parseLoopConfig(validEventConfig());
  assert.ok(result.ok, JSON.stringify(result.ok ? {} : result.issues));
  assert.equal(result.config.trigger.type, "event");
});

test("the default new-loop scaffold parses", () => {
  const result = parseLoopConfig(defaultLoopConfig());
  assert.ok(result.ok, JSON.stringify(result.ok ? {} : result.issues));
});

test("schedule trigger rejects an rrule without FREQ", () => {
  const config = defaultLoopConfig();
  config.trigger = {
    type: "schedule",
    schedule: { rrule: "BYDAY=MO", timezone: "UTC" },
  };
  const result = parseLoopConfig(config);
  assert.ok(!result.ok);
  assert.ok(result.issues.some((i) => i.path === "trigger.schedule.rrule"));
});

test("inTriage events are rejected for non-issue entities", () => {
  const config = validEventConfig();
  config.trigger = {
    type: "event",
    event: { entity: "project", kind: "inTriage" },
    activationMode: "collectionChanged",
  };
  const result = parseLoopConfig(config);
  assert.ok(!result.ok);
  assert.ok(
    result.issues.some((i) => i.message.includes("inTriage")),
    JSON.stringify(result.issues),
  );
});

test("watchedPropertyChanged requires a watchedProperties condition", () => {
  const config = validEventConfig();
  config.trigger = {
    type: "event",
    event: { entity: "issue", kind: "updated" },
    activationMode: "watchedPropertyChanged",
  };
  config.conditions = [];
  const result = parseLoopConfig(config);
  assert.ok(!result.ok);
  assert.ok(result.issues.some((i) => i.path === "conditions"));
});

test("watchedPropertyChanged passes once watchedProperties is declared", () => {
  const config = validEventConfig();
  config.trigger = {
    type: "event",
    event: { entity: "issue", kind: "updated" },
    activationMode: "watchedPropertyChanged",
  };
  config.conditions = [
    { kind: "watchedProperties", properties: ["stateId", "assigneeId"] },
  ];
  assert.ok(parseLoopConfig(config).ok);
});

test("regex commentMatch patterns must compile", () => {
  const config = validEventConfig();
  config.conditions = [
    { kind: "commentMatch", pattern: "([unclosed", isRegex: true },
  ];
  const result = parseLoopConfig(config);
  assert.ok(!result.ok);
  assert.ok(
    result.issues.some((i) => i.path.endsWith("pattern")),
    JSON.stringify(result.issues),
  );
});

test("literal commentMatch needs no regex validation", () => {
  const config = validEventConfig();
  config.conditions = [
    { kind: "commentMatch", pattern: "([unclosed", isRegex: false },
  ];
  assert.ok(parseLoopConfig(config).ok);
});

test("an empty activities list is rejected (a loop must be able to act)", () => {
  const config = validEventConfig();
  config.activities = [];
  assert.ok(!parseLoopConfig(config).ok);
});

test("collectionChange condition round-trips", () => {
  const config = validEventConfig();
  config.conditions = [
    {
      kind: "collectionChange",
      property: "labelIds",
      operation: "added",
    },
  ];
  const result = parseLoopConfig(config);
  assert.ok(result.ok, JSON.stringify(result.ok ? {} : result.issues));
});

test("unknown condition kinds are rejected", () => {
  const config = validEventConfig();
  const tampered = {
    ...config,
    conditions: [{ kind: "telepathy", minds: 2 }],
  };
  const result = parseLoopConfig(tampered);
  assert.ok(!result.ok);
});

test("parse errors are flattened to path/message pairs", () => {
  const result = parseLoopConfig({ name: "" });
  assert.ok(!result.ok);
  for (const issue of result.issues) {
    assert.equal(typeof issue.path, "string");
    assert.equal(typeof issue.message, "string");
  }
});

test("chat trigger parses and needs no schedule or event", () => {
  const config = validEventConfig();
  config.trigger = { type: "chat" };
  config.conditions = [
    { kind: "commentMatch", pattern: "^@loops", isRegex: true },
  ];
  const result = loopConfigSchema.safeParse(config);
  assert.ok(result.success);
});
