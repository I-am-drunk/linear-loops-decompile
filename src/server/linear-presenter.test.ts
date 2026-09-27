/**
 * Tests for the T-604 Linear agent-session presenter: part→activity mapping,
 * session lifecycle, replay idempotency, and failure rails. All Linear-side
 * calls are a recording fixture writer — no network, no credentials.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Runner } from "../runtime/runner.ts";
import { ScriptBrain } from "../runtime/brain.ts";
import type { Part } from "../runtime/types.ts";

import { openDatabase } from "./db.ts";
import { Store } from "./store.ts";
import {
  presentRun,
  partToActivity,
  partActivityId,
  type AgentSessionWriter,
  type PresentedActivityContent,
} from "./linear-presenter.ts";

// ---- fixture writer ---------------------------------------------------------

interface SessionCall {
  issueId: string;
  externalUrls?: { label: string; url: string }[];
}

interface ActivityCall {
  agentSessionId: string;
  content: PresentedActivityContent;
  signal?: "select";
  signalMetadata?: Record<string, unknown>;
  id?: string;
}

class FakeWriter implements AgentSessionWriter {
  sessions: SessionCall[] = [];
  activities: ActivityCall[] = [];
  failSessions = 0;
  failActivities = 0;
  #next = 0;

  createSessionOnIssue(input: SessionCall): Promise<{ sessionId: string }> {
    if (this.failSessions-- > 0) return Promise.reject(new Error("linear 503"));
    this.sessions.push(input);
    return Promise.resolve({ sessionId: `sess_${this.#next++}` });
  }

  createActivity(input: ActivityCall): Promise<{ id: string }> {
    if (this.failActivities-- > 0) return Promise.reject(new Error("linear 429"));
    this.activities.push(input);
    return Promise.resolve({ id: input.id ?? `act_${this.#next++}` });
  }
}

function auditDetails(store: Store, runId: string, kind: string): Record<string, unknown>[] {
  return store
    .listAudit({ runId })
    .filter((row) => row["kind"] === kind)
    .map((row) => JSON.parse(String(row["detail_json"])));
}

const URL_OF = (runId: string): string => `https://loops.local/#/run/${runId}`;

function setup(): { db: ReturnType<typeof openDatabase>; store: Store; runner: Runner; writer: FakeWriter } {
  const db = openDatabase(":memory:");
  const store = new Store(db);
  const runner = new Runner();
  const writer = new FakeWriter();
  return { db, store, runner, writer };
}

/** Drain the presenter's fire-and-forget emit queue. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
}

// ---- mapping ----------------------------------------------------------------

test("partToActivity: the ratified 1:1 map, steered skipped", () => {
  assert.deepEqual(partToActivity({ kind: "thought", text: "hmm" }), {
    content: { type: "thought", body: "hmm" },
  });
  assert.deepEqual(
    partToActivity({ kind: "action", tool: "linear.comment", label: "Comment", argsSummary: "issue LIN-1", resultSummary: "posted" }),
    { content: { type: "action", action: "Comment", parameter: "issue LIN-1", result: "posted" } },
  );
  assert.deepEqual(partToActivity({ kind: "response", text: "done" }), {
    content: { type: "response", body: "done" },
  });
  assert.deepEqual(partToActivity({ kind: "elicitation", elicitationKind: "freeText", prompt: "Proceed?" }), {
    content: { type: "elicitation", body: "Proceed?" },
  });
  assert.deepEqual(
    partToActivity({ kind: "elicitation", elicitationKind: "select", prompt: "Pick", choices: ["a", "b"] }),
    { content: { type: "elicitation", body: "Pick" }, signal: "select", signalMetadata: { choices: ["a", "b"] } },
  );
  assert.deepEqual(partToActivity({ kind: "error", message: "boom" }), {
    content: { type: "error", body: "boom" },
  });
  assert.equal(partToActivity({ kind: "steered", text: "user text" }), null);
});

test("partActivityId: deterministic, UUID v4 format", () => {
  const id = partActivityId("run1", "turn1:0");
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(id, partActivityId("run1", "turn1:0"));
  assert.notEqual(id, partActivityId("run1", "turn1:1"));
});

// ---- lifecycle --------------------------------------------------------------

test("a full run presents as one session with the activity stream in order", async () => {
  const { db, store, runner, writer } = setup();
  try {
    const parts: Part[] = [
      { kind: "thought", text: "reading the issue" },
      { kind: "action", tool: "linear.comment", label: "Comment", argsSummary: "LIN-1", resultSummary: "posted" },
      // Elicitation ENDS the exchange (the run parks awaitingInput and the
      // runtime stops consuming) — it is always the last part of a stream.
      { kind: "elicitation", elicitationKind: "select", prompt: "Which label?", choices: ["bug", "feat"] },
    ];
    const brain = new ScriptBrain([parts]);
    const run = runner.start({
      loopId: "loop-1",
      message: "triage",
      brain,
      target: { entity: "issue", id: "LIN-1" },
    });
    presentRun(runner, run.id, { writer, store, runViewUrl: URL_OF });
    const final = await runner.whenIdle(run.id);
    await settle();

    assert.equal(final.status, "awaitingInput"); // elicitation parks the run
    assert.equal(writer.sessions.length, 1);
    assert.equal(writer.sessions[0]!.issueId, "LIN-1");
    assert.deepEqual(writer.sessions[0]!.externalUrls, [
      { label: "Run view", url: `https://loops.local/#/run/${run.id}` },
    ]);

    const kinds = writer.activities.map((a) => a.content.type);
    assert.deepEqual(kinds, ["thought", "action", "elicitation"]);
    assert.equal(writer.activities[2]!.signal, "select");
    assert.deepEqual(writer.activities[2]!.signalMetadata, { choices: ["bug", "feat"] });
    for (const a of writer.activities) {
      assert.equal(a.agentSessionId, "sess_0");
      assert.match(a.id!, /^[0-9a-f-]{36}$/);
    }

    // The audit tells the same story (the durable rail).
    const sessionAudit = auditDetails(store, run.id, "linear.session");
    assert.deepEqual(sessionAudit, [{ ok: true, sessionId: "sess_0" }]);
    const activityAudit = auditDetails(store, run.id, "linear.activity");
    assert.equal(activityAudit.filter((d) => d["ok"] === true).length, 3);
  } finally {
    db.close();
  }
});

test("runs without an issue target are not presented", async () => {
  const { db, store, runner, writer } = setup();
  try {
    const run = runner.start({ loopId: "loop-1", message: "hi", brain: new ScriptBrain([[{ kind: "response", text: "x" }]]) });
    presentRun(runner, run.id, { writer, store, runViewUrl: URL_OF });
    await runner.whenIdle(run.id);
    await settle();
    assert.equal(writer.sessions.length, 0);
    assert.equal(writer.activities.length, 0);
  } finally {
    db.close();
  }
});

test("re-presenting a run never double-creates (replay idempotency)", async () => {
  const { db, store, runner, writer } = setup();
  try {
    const brain = new ScriptBrain([[{ kind: "response", text: "hello" }]]);
    const run = runner.start({
      loopId: "loop-1",
      message: "hi",
      brain,
      target: { entity: "issue", id: "LIN-2" },
    });
    const off1 = presentRun(runner, run.id, { writer, store, runViewUrl: URL_OF });
    await runner.whenIdle(run.id);
    await settle();
    off1();

    // A second presenter attaches (server restart): replay emits nothing new.
    const off2 = presentRun(runner, run.id, { writer, store, runViewUrl: URL_OF });
    await settle();
    off2();

    assert.equal(writer.sessions.length, 1);
    assert.equal(writer.activities.length, 1);
    assert.equal(writer.activities[0]!.content.type, "response");
  } finally {
    db.close();
  }
});

test("a failing writer lands in the audit and the session create retries", async () => {
  const { db, store, runner, writer } = setup();
  try {
    writer.failSessions = 1; // first create 503s; the retry on the next event succeeds
    const parts: Part[] = [
      { kind: "thought", text: "first" },
      { kind: "response", text: "second" },
    ];
    const run = runner.start({
      loopId: "loop-1",
      message: "hi",
      brain: new ScriptBrain([parts]),
      target: { entity: "issue", id: "LIN-3" },
    });
    presentRun(runner, run.id, { writer, store, runViewUrl: URL_OF });
    await runner.whenIdle(run.id);
    await settle();

    const sessionAudit = auditDetails(store, run.id, "linear.session");
    assert.equal(sessionAudit.filter((d) => d["ok"] === false).length, 1);
    assert.equal(sessionAudit.filter((d) => d["ok"] === true).length, 1);
    assert.equal(writer.sessions.length, 1); // retried once
  } finally {
    db.close();
  }
});

test("a run error emits a final error activity", async () => {
  const { db, store, runner, writer } = setup();
  try {
    class BoomBrain {
      async *stream(): AsyncIterable<Part> {
        yield { kind: "thought", text: "about to fail" };
        throw new Error("provider 500");
      }
    }
    const run = runner.start({
      loopId: "loop-1",
      message: "hi",
      brain: new BoomBrain(),
      target: { entity: "issue", id: "LIN-4" },
    });
    presentRun(runner, run.id, { writer, store, runViewUrl: URL_OF });
    const final = await runner.whenIdle(run.id);
    await settle();

    assert.equal(final.status, "error");
    const kinds = writer.activities.map((a) => a.content.type);
    assert.deepEqual(kinds, ["thought", "error"]);
    const errorActivity = writer.activities.at(-1)!;
    assert.match((errorActivity.content as { body: string }).body, /provider 500/);
  } finally {
    db.close();
  }
});
