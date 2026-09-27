/**
 * Orchestrator tests — the M5 chain, zero network: cron fire → condition →
 * brain run → comment write-back → live event stream, plus the failure and
 * idempotency rails. Fixtures: node:sqlite :memory:, ScriptBrain, a stub
 * EntityReader, a spy write-back sink. Real Store/Runner/RunQueue/Registry
 * (integration, not mocks).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultLoopConfig } from "../model/loop-config.ts";
import type { LoopConfig } from "../model/loop.ts";
import { ScriptBrain } from "../runtime/brain.ts";
import type { Brain, BrainInput } from "../runtime/brain.ts";
import { Runner } from "../runtime/runner.ts";
import type { RunEvent } from "../runtime/types.ts";
import { RunQueue, MemoryRunQueueStore } from "../engine/queue.ts";
import { ScheduleRegistry, MemoryScheduleStore } from "../engine/registry.ts";
import type { EntityEvent } from "../engine/trigger.ts";

import { openDatabase } from "./db.ts";
import { Store } from "./store.ts";
import {
  createOrchestrator,
  commentWriteBack,
  responseText,
  type OrchestratorDeps,
  type WriteBackInput,
  type WriteBackResult,
} from "./orchestrator.ts";

const ANCHOR = "2026-01-01T09:00:00.000Z"; // loop rows are stamped here (daily 09:00 UTC schedule)
const TICK_AT = new Date("2026-01-01T09:00:01.000Z"); // one second past the first occurrence

const RESPONSE = "Done — ENG-1 moved to Done with a summary note.";

/** detail_json is NULL for detail-less rows (run.created) — never .includes raw. */
function detail(row: Record<string, unknown>): string {
  return String(row["detail_json"] ?? "");
}

interface Rig {
  store: Store;
  runner: Runner;
  queue: RunQueue;
  published: { runId: string; event: RunEvent }[];
  writeBackCalls: WriteBackInput[];
  brainInputs: BrainInput[];
  orchestrator: ReturnType<typeof createOrchestrator>;
}

function rig(overrides: Partial<OrchestratorDeps> = {}): Rig {
  const store = new Store(openDatabase(":memory:"), () => new Date(ANCHOR));
  const runner = new Runner();
  const queue = new RunQueue(new MemoryRunQueueStore());
  const registry = new ScheduleRegistry(new MemoryScheduleStore());
  const published: Rig["published"] = [];
  const writeBackCalls: WriteBackInput[] = [];
  const brainInputs: BrainInput[] = [];

  const brainFor = (): Brain => {
    const inner = new ScriptBrain([[{ kind: "response", text: RESPONSE }]]);
    return {
      seen: inner.seen,
      stream: (input: BrainInput, signal: AbortSignal) => {
        brainInputs.push(input);
        return inner.stream(input, signal);
      },
    } as Brain;
  };

  const orchestrator = createOrchestrator({
    store,
    runner,
    queue,
    registry,
    brainFor,
    reader: {
      readEntity: async (target) => ({
        title: `ENG-1: Flaky login on mobile (${target.id})`,
        description: "Users report the login spinner never resolves.",
        url: "https://linear.app/example/issue/ENG-1",
      }),
    },
    writeBack: async (input) => {
      writeBackCalls.push(input);
      return { commentId: "cmt-1", url: "https://linear.app/c/cmt-1", deduplicated: false } satisfies WriteBackResult;
    },
    publish: (runId, event) => published.push({ runId, event }),
    ...overrides,
  });

  return { store, runner, queue, published, writeBackCalls, brainInputs, orchestrator };
}

function scheduledLoop(enabled = true): LoopConfig {
  return { ...defaultLoopConfig(), enabled };
}

function eventLoop(): LoopConfig {
  return {
    ...defaultLoopConfig(),
    enabled: true,
    trigger: {
      type: "event",
      event: { entity: "issue", kind: "updated" },
      activationMode: "watchedPropertyChanged",
    },
    conditions: [{ kind: "watchedProperties", properties: ["stateId"] }],
  };
}

const STATE_CHANGE: EntityEvent = {
  id: "evt-1",
  entity: "issue",
  kind: "updated",
  entityId: "lin-issue-1",
  changedProperties: ["stateId"],
};

describe("orchestrator — schedule path (M5)", () => {
  it("cron fire → context → brain run → persisted + published", async () => {
    const r = rig();
    r.store.saveLoop("loop-1", scheduledLoop());
    assert.deepEqual(r.orchestrator.reloadLoops(), { scheduled: 1, event: 0, chat: 0 });

    const result = await r.orchestrator.tick(TICK_AT);
    assert.equal(result.fired, 1);
    assert.equal(result.enqueued, 1);
    assert.equal(result.started.length, 1);

    const runId = result.started[0]!;
    const run = await r.runner.whenIdle(runId);
    assert.equal(run.status, "complete");
    assert.equal(run.iteration, 1, "first durable run of the loop");

    // The brain answered the assembled loop prompt (name header + markdown).
    assert.equal(r.brainInputs.length, 1);
    assert.match(r.brainInputs[0]!.message, /^# New loop\n\n/);
    assert.match(r.brainInputs[0]!.message, /Describe what this loop should do/);

    // Persisted through the T-1101 bridge.
    const audit = r.store.listAudit({ runId });
    assert.ok(audit.some((row) => row["kind"] === "run.created"));
    assert.ok(audit.some((row) => row["kind"] === "run.status" && detail(row).includes("complete")));

    // Every event reached the UI fan-out, ending in the terminal status.
    const types = r.published.filter((p) => p.runId === runId).map((p) => p.event.type);
    assert.ok(types.includes("runStatus") && types.includes("turnStarted") && types.includes("partAppended"));
    const last = r.published.filter((p) => p.runId === runId).at(-1)!.event;
    assert.equal(last.type, "runStatus");
    if (last.type === "runStatus") assert.equal(last.status, "complete");

    // The waterline holds: re-ticking the same instant fires nothing.
    const again = await r.orchestrator.tick(TICK_AT);
    assert.deepEqual(again, { fired: 0, enqueued: 0, started: [] });
  });

  it("a disabled loop leaves the registry on reload and never runs", async () => {
    const r = rig();
    r.store.saveLoop("loop-1", scheduledLoop());
    r.orchestrator.reloadLoops();
    r.store.setLoopEnabled("loop-1", false);
    assert.deepEqual(r.orchestrator.reloadLoops(), { scheduled: 0, event: 0, chat: 0 });
    const result = await r.orchestrator.tick(TICK_AT);
    assert.deepEqual(result, { fired: 0, enqueued: 0, started: [] });
  });
});

describe("orchestrator — event path (M5)", () => {
  it("condition match → entity context → brain run → comment write-back", async () => {
    const r = rig();
    r.store.saveLoop("loop-e", eventLoop());

    const result = await r.orchestrator.handleEvent(STATE_CHANGE);
    assert.deepEqual(result.fired, ["loop-e"]);
    assert.equal(result.evaluated, 1);
    assert.equal(result.started.length, 1);
    assert.match(result.reasons["loop-e"]!.join(" "), /stateId/);

    const runId = result.started[0]!;
    const run = await r.runner.whenIdle(runId);
    assert.equal(run.status, "complete");
    assert.deepEqual(run.target, { entity: "issue", id: "lin-issue-1" });

    // Entity context made it into the exchange (EntityReader seam).
    assert.match(r.brainInputs[0]!.message, /## Target: issue/);
    assert.match(r.brainInputs[0]!.message, /ENG-1: Flaky login/);

    await r.orchestrator.flush();

    // M5's money shot: the run's response became a Linear comment write-back.
    assert.equal(r.writeBackCalls.length, 1);
    assert.equal(r.writeBackCalls[0]!.responseText, RESPONSE);
    assert.equal(r.writeBackCalls[0]!.target.id, "lin-issue-1");
    const writes = r.store.listAudit({ runId }).filter((row) => row["kind"] === "linear.write");
    assert.equal(writes.length, 1);
    assert.match(detail(writes[0]!), /"ok":true.*cmt-1/s);
  });

  it("duplicate delivery never double-runs (durable rail survives queue drain)", async () => {
    const r = rig();
    r.store.saveLoop("loop-e", eventLoop());

    const first = await r.orchestrator.handleEvent(STATE_CHANGE);
    await r.runner.whenIdle(first.started[0]!);
    await r.orchestrator.flush();
    // The run completed → its queue slot is gone. The durable claimRunKey
    // rail is what stops the redelivery now.
    assert.equal(r.queue.list().length, 0);

    const second = await r.orchestrator.handleEvent(STATE_CHANGE);
    assert.deepEqual(second.fired, ["loop-e"], "the trigger still fires…");
    assert.deepEqual(second.started, [], "…but no second run starts");
    const drops = r.store
      .listAudit({ loopId: "loop-e" })
      .filter((row) => detail(row).includes("durable idempotency rail"));
    assert.equal(drops.length, 1);
    assert.equal(r.writeBackCalls.length, 1, "and no second comment");
  });

  it("a non-matching event starts nothing, with reasons recorded", async () => {
    const r = rig();
    r.store.saveLoop("loop-e", eventLoop());
    const result = await r.orchestrator.handleEvent({ ...STATE_CHANGE, id: "evt-2", changedProperties: ["title"] });
    assert.deepEqual(result.fired, []);
    assert.deepEqual(result.started, []);
    assert.equal(result.evaluated, 1);
  });
});

describe("orchestrator — write-back rails", () => {
  it("write-back failure never un-completes the run; the audit log tells", async () => {
    const r = rig({
      writeBack: async () => {
        throw new Error("Linear API 429");
      },
    });
    r.store.saveLoop("loop-e", eventLoop());
    const { started } = await r.orchestrator.handleEvent(STATE_CHANGE);
    const run = await r.runner.whenIdle(started[0]!);
    await r.orchestrator.flush();
    assert.equal(run.status, "complete");
    const writes = r.store.listAudit({ runId: run.id }).filter((row) => row["kind"] === "linear.write");
    assert.match(detail(writes[0]!), /"ok":false.*Linear API 429/s);
  });

  it("no comment capability → no write-back call", async () => {
    const r = rig();
    r.store.saveLoop("loop-e", { ...eventLoop(), activities: ["issueUpdate"] });
    const { started } = await r.orchestrator.handleEvent(STATE_CHANGE);
    await r.runner.whenIdle(started[0]!);
    await r.orchestrator.flush();
    assert.equal(r.writeBackCalls.length, 0);
  });

  it("commentWriteBack keys the comment with the run id (retry-safe)", async () => {
    const seen: { issueId: string; body: string; idempotencyKey: string }[] = [];
    const sink = commentWriteBack({
      createComment: async (input) => {
        seen.push(input);
        return { id: "c-9", url: null, deduplicated: false };
      },
    });
    const result = await sink({
      run: { id: "run-7" } as WriteBackInput["run"],
      loop: {} as WriteBackInput["loop"],
      responseText: "hello",
      target: { entity: "issue", id: "lin-1" },
    });
    assert.deepEqual(seen, [{ issueId: "lin-1", body: "hello", idempotencyKey: "run:run-7:comment" }]);
    assert.deepEqual(result, { commentId: "c-9", url: null, deduplicated: false });
  });
});

describe("orchestrator — failure + manual rails", () => {
  it("a broken EntityReader drops the run loudly and frees the queue slot", async () => {
    const r = rig({
      reader: {
        readEntity: async () => {
          throw new Error("dataplane down");
        },
      },
    });
    r.store.saveLoop("loop-e", eventLoop());
    const result = await r.orchestrator.handleEvent(STATE_CHANGE);
    assert.deepEqual(result.started, []);
    assert.equal(r.queue.list().length, 0, "slot freed for the next event");
    const errors = r.store
      .listAudit({ loopId: "loop-e" })
      .filter((row) => detail(row).includes('"phase":"assemble"'));
    assert.equal(errors.length, 1);
    assert.match(detail(errors[0]!), /dataplane down/);
  });

  it("requestRun starts a manual run immediately when capacity allows", async () => {
    const r = rig();
    r.store.saveLoop("loop-1", scheduledLoop());
    const result = await r.orchestrator.requestRun({
      loopId: "loop-1",
      kind: "manual",
      requestedAt: new Date(ANCHOR).toISOString(),
    });
    assert.equal(result.outcome, "started");
    const run = await r.runner.whenIdle(result.runId!);
    assert.equal(run.status, "complete");
  });

  it("responseText concatenates agent response parts only", () => {
    const turns = [
      { role: "user", parts: [{ kind: "steered", text: "ignore me" }] },
      {
        role: "agent",
        parts: [
          { kind: "thought", text: "thinking" },
          { kind: "response", text: "part one" },
          { kind: "response", text: "part two" },
        ],
      },
    ] as unknown as Parameters<typeof responseText>[0];
    assert.equal(responseText(turns), "part one\n\npart two");
    assert.equal(responseText([]), null);
  });
});
