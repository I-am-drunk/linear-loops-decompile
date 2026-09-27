/**
 * M5 end-to-end fixture validation (claim #117, agent-01@gen6).
 *
 * The FULL composition in one process, zero external network:
 *   mock OpenAI-compatible provider (loopback SSE)
 *   → createLoopsServer (:memory:, real Store/Runner/brainFor/secret store)
 *   → orchestrator (real) → engine registry tick / trigger evaluator (real)
 *   → dataplane LinearClient over FixtureTransport (real) → DataplaneEntityReader (T-304)
 *   → HarnessBrain → provider SSE (real adapter + encrypted key resolve)
 *   → comment write-back via real dataplane createComment (T-303)
 *   → T-1103 domain RPCs as the UI consumes them (loops.list / runs.list / runs.get+lastSeq)
 *
 * Run from the repo root:  node --experimental-strip-types e2e/m5-fixture.ts
 */

import http from "node:http";
import assert from "node:assert/strict";

import { createLoopsServer } from "../src/server/index.ts";
import { createOrchestrator, commentWriteBack } from "../src/server/orchestrator.ts";
import { RunQueue, MemoryRunQueueStore } from "../src/engine/queue.ts";
import { ScheduleRegistry, MemoryScheduleStore } from "../src/engine/registry.ts";
import type { EntityEvent } from "../src/engine/trigger.ts";
import { LinearClient } from "../src/dataplane/dist/client.js";
import { createDemoWorkspace } from "../src/dataplane/dist/fixtures.js";
import { DataplaneEntityReader } from "../src/dataplane/dist/entityReader.js";
import { createComment } from "../src/dataplane/dist/writes.js";
import { defaultLoopConfig } from "../src/model/loop-config.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const report: Record<string, unknown> = { checks: [] };
const check = (name: string, ok: boolean, detail: unknown) => {
  (report.checks as unknown[]).push({ name, ok, detail });
  assert.ok(ok, `${name}: ${JSON.stringify(detail)}`);
};

// ---------------------------------------------------------------------------
// 1) Mock OpenAI-compatible provider (loopback; records requests)
// ---------------------------------------------------------------------------
const seenBodies: Record<string, unknown>[] = [];
const seenAuth: (string | undefined)[] = [];
const RESPONSE_TEXT = "Acknowledged: ENG-1 moved state — I noted it for the team.";
const provider = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seenBodies.push(JSON.parse(raw));
      seenAuth.push(req.headers.authorization);
      const chunk = (delta: object, finish: string | null = null) =>
        `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}\n\n`;
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(chunk({ reasoning_content: "Let me look at the issue context first." }));
      res.write(chunk({ content: RESPONSE_TEXT.slice(0, RESPONSE_TEXT.length / 2) }));
      res.write(chunk({ content: RESPONSE_TEXT.slice(RESPONSE_TEXT.length / 2) }));
      res.write(chunk({}, "stop"));
      res.write(`data: ${JSON.stringify({ usage: { prompt_tokens: 1234, completion_tokens: 42 } })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });
    return;
  }
  res.writeHead(404).end();
});
await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
const port = (provider.address() as { port: number }).port;
report.provider = `http://127.0.0.1:${port}/v1 (loopback mock, OpenAI-compatible SSE)`;

// ---------------------------------------------------------------------------
// 2) Full server composition (:memory:, real everything)
// ---------------------------------------------------------------------------
const rpcHandlers = new Map<string, (params: unknown, ctx: unknown) => unknown>();
const seqByRun = new Map<string, number>();
const channel = {
  register: (m: string, h: (p: unknown, c: unknown) => unknown) => rpcHandlers.set(m, h),
  lastSeqFor: (runId: string) => seqByRun.get(runId) ?? 0,
};
const reloadShim: { target?: { reloadLoops(): unknown }; reloadLoops(): unknown } = {
  target: undefined,
  reloadLoops() {
    return this.target?.reloadLoops();
  },
};
const loops = createLoopsServer({ dbPath: ":memory:", channel, orchestrator: reloadShim });

// 3) Seed the inference harness — the REAL encrypted-key path (ephemeral :memory: master key).
loops.harnessStore.create({
  name: "e2e-mock",
  provider: "openai-compatible",
  baseUrl: `http://127.0.0.1:${port}/v1`,
  apiKey: "sk-e2e-secret-key",
  model: "m5-mock-1",
  effort: "none",
  allowInsecureHttp: true,
  makeDefault: true,
});
check("harness seeded (secret write-only)", loops.harnessStore.list().length === 1, {
  publicDtoHasNoKey: !("apiKey" in (loops.harnessStore.list()[0] ?? {})),
});

// 4) Dataplane over the demo workspace fixture (+ the ops the run needs).
const transport = createDemoWorkspace();
const page = <T,>(nodes: T[]) => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });
const ISSUE = {
  id: "iss-0001",
  identifier: "ENG-1",
  title: "Set up CI pipeline",
  description: "We need CI before anything merges.",
  priority: 2,
  estimate: null,
  dueDate: null,
  url: "https://linear.app/demo/issue/ENG-1",
  createdAt: "2026-09-20T10:00:00.000Z",
  updatedAt: "2026-09-27T08:59:00.000Z",
  state: { id: "st-done", name: "Done", type: "completed" },
  team: { id: "team-eng-01", key: "ENG" },
  assignee: null,
  labels: { nodes: [] },
};
transport.add({ operationName: "DataplaneIssue", respond: { data: { issue: ISSUE } } });
transport.add({
  operationName: "DataplaneIssueComments",
  respond: {
    data: {
      issue: {
        comments: page([
          { id: "cmt-old-1", body: "picked this up today", createdAt: "2026-09-26T10:00:00.000Z", updatedAt: "2026-09-26T10:00:00.000Z", user: { id: "u-1", displayName: "Ada" } },
          { id: "cmt-old-2", body: "merged the workflow", createdAt: "2026-09-27T08:00:00.000Z", updatedAt: "2026-09-27T08:00:00.000Z", user: null },
        ]),
      },
    },
  },
});
transport.add({
  operationName: "DataplaneCreateComment",
  respond: {
    data: {
      commentCreate: {
        success: true,
        comment: { id: "cmt-e2e-1", body: "(server-echo)", createdAt: "2026-09-27T09:00:00.000Z", url: "https://linear.app/demo/issue/ENG-1#comment-cmt-e2e-1" },
      },
    },
  },
});
const client = new LinearClient({ transport });
const reader = new DataplaneEntityReader(client); // T-304, real

// 5) Orchestrator — the server's REAL brainFor + the REAL write-back adapter.
const queue = new RunQueue(new MemoryRunQueueStore());
const registry = new ScheduleRegistry(new MemoryScheduleStore());
const published: { runId: string; seq: number; type: string }[] = [];
const orchestrator = createOrchestrator({
  store: loops.store,
  runner: loops.runner,
  queue,
  registry,
  brainFor: loops.brainFor, // T-1105 real: harnessStore → decrypt → adapter → HarnessBrain
  reader,
  writeBack: commentWriteBack({
    createComment: async (input) => {
      const r = await createComment(client, input); // T-303 real, idempotency-keyed
      return { id: r.value.id, url: r.value.url ?? null, deduplicated: r.deduplicated };
    },
  }),
  publish: (runId, event) => {
    const seq = (seqByRun.get(runId) ?? 0) + 1;
    seqByRun.set(runId, seq);
    published.push({ runId, seq, type: event.type });
  },
});
reloadShim.target = orchestrator;

// 6) Two loops: one cron (scheduled), one event (watched state change).
loops.store.saveLoop("loop-cron-1", {
  ...defaultLoopConfig(),
  enabled: true,
  name: "e2e cron digest",
  // MINUTELY so the injected tick moment lands on the next grid boundary
  // (the rrule grid floors seconds; a real-clock hourly anchor sits an hour out).
  trigger: { type: "schedule", schedule: { rrule: "FREQ=MINUTELY", timezone: "UTC" } },
  prompt: { format: "markdown", markdown: "Post a one-line standup summary for the ENG workspace." },
});
loops.store.saveLoop("loop-event-1", {
  ...defaultLoopConfig(),
  enabled: true,
  name: "e2e state-change responder",
  trigger: { type: "event", event: { entity: "issue", kind: "updated" }, activationMode: "watchedPropertyChanged" },
  conditions: [{ kind: "watchedProperties", properties: ["stateId"] }],
  prompt: { format: "markdown", markdown: "An issue you watch changed state. Acknowledge it and say what changed, briefly." },
});
const reload = orchestrator.reloadLoops() as Record<string, number>;
check("reloadLoops schedules both loops", reload.scheduled === 1 && reload.event === 1, reload);

async function rpc(name: string, params?: unknown): Promise<any> {
  const h = rpcHandlers.get(name);
  assert.ok(h, `RPC ${name} not registered`);
  return h(params, null);
}
async function waitRun(loopId: string): Promise<any> {
  for (let i = 0; i < 300; i++) {
    const list = await rpc("runs.list", { loopId, limit: 5 });
    const run = list.runs[0];
    if (run && (run.status === "complete" || run.status === "error")) return run;
    await sleep(50);
  }
  throw new Error(`run for ${loopId} did not finish in time`);
}

// ---------------------------------------------------------------------------
// 7) CRON LEG: registry tick → scheduled run → complete (no target → no write-back, per spec)
// ---------------------------------------------------------------------------
// The tick's moment is injected (engine test convention): next minute boundary + 1s.
const tickMoment = new Date(Math.ceil((Date.now() + 1000) / 60_000) * 60_000 + 1000);
const tickRes = await orchestrator.tick(tickMoment);
check("cron tick fired the scheduled loop", (tickRes as any).fired >= 1 && (tickRes as any).enqueued === 1, tickRes);
const cronRun = await waitRun("loop-cron-1");
check("cron run completed", cronRun.status === "complete", { id: cronRun.id, status: cronRun.status });

// ---------------------------------------------------------------------------
// 8) EVENT LEG: real condition evaluation → run with target → write-back
// ---------------------------------------------------------------------------
const STATE_CHANGE: EntityEvent = {
  id: "evt-e2e-1",
  entity: "issue",
  kind: "updated",
  entityId: "iss-0001",
  changedProperties: ["stateId"],
};
const evtRes = await orchestrator.handleEvent(STATE_CHANGE);
check("event fired the watched-property loop", (evtRes as any).fired.includes("loop-event-1"), evtRes);
const evtRun = await waitRun("loop-event-1");
check("event run completed", evtRun.status === "complete", { id: evtRun.id, status: evtRun.status });

// ---------------------------------------------------------------------------
// 9) Evidence assembly
// ---------------------------------------------------------------------------
// Brain requests hit the mock with the loop prompt + entity context.
// Match by content (never request order) and assert the exact count.
check("provider received exactly two requests (cron + event)", seenBodies.length === 2, { count: seenBodies.length });
const bodies = seenBodies.map((b) => JSON.stringify(b));
const cronMsg = bodies.find((b) => b.includes("standup summary")) ?? "";
const evtMsg = bodies.find((b) => b.includes("An issue you watch changed state")) ?? "";
check("cron run carried its loop prompt to the brain", cronMsg !== "", { matched: cronMsg !== "" });
check(
  "event run carried the REAL entity context (T-304 reader over the dataplane fixture)",
  evtMsg.includes("Set up CI pipeline") && evtMsg.includes("merged the workflow"),
  { issueTitle: evtMsg.includes("Set up CI pipeline"), latestComment: evtMsg.includes("merged the workflow") },
);
check("the adapter sent the seeded API key as Bearer", seenAuth.every((a) => a === "Bearer sk-e2e-secret-key"), seenAuth);

// Write-back: the dataplane mutation went out, keyed; body = the brain's response text + marker.
const creates = transport.calls.filter((c) => c.operationName === "DataplaneCreateComment");
check("write-back: DataplaneCreateComment issued once, for the event run only", creates.length === 1, creates.map((c) => c.operationName));
const sentBody = (creates[0] as any)?.variables?.input?.body ?? "";
check("write-back body is the brain's response text (+ idempotency marker)", sentBody.includes(RESPONSE_TEXT) && sentBody.includes(`<!-- loops:write=run:${evtRun.id}:comment -->`), { bodyStart: sentBody.slice(0, 90) });

// Usage rail: SSE usage chunk → HarnessBrain → runner.recordUsage → run row.
const evtRunRow = await rpc("runs.get", { id: evtRun.id });
check("usage folded into the run (1234 in / 42 out)", evtRunRow.run.usage.inputTokens === 1234 && evtRunRow.run.usage.outputTokens === 42, evtRunRow.run.usage);

// RPC leg, exactly as the UI consumes it.
const loopsList = await rpc("loops.list");
check("loops.list returns both loops", loopsList.loops.length === 2, loopsList.loops.map((l: any) => l.name));
check(
  "runs.get carries turns/parts (thought + response) and lastSeq for the live subscribe seam",
  evtRunRow.turns.length >= 1 &&
    evtRunRow.turns.some((t: any) => t.parts.some((p: any) => p.kind === "thought")) &&
    evtRunRow.turns.some((t: any) => t.parts.some((p: any) => p.kind === "response" && p.text.includes("Acknowledged"))) &&
    (evtRunRow.lastSeq ?? 0) >= 1,
  { turns: evtRunRow.turns.length, lastSeq: evtRunRow.lastSeq },
);
check(
  "the publish fan-out streamed every event with gapless seq",
  published.filter((p) => p.runId === evtRun.id).every((p, i) => p.seq === i + 1),
  published.filter((p) => p.runId === evtRun.id).map((p) => `${p.seq}:${p.type}`),
);

await loops.close();
provider.close();
report.summary = "M5 E2E FIXTURE RUN: ALL CHECKS PASSED";
console.log(JSON.stringify(report, null, 2));
