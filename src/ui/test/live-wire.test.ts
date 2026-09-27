/**
 * T-1104 — live-seam tests.
 *
 * Part 1: pure mapper folds (wire DTOs → view models, stream-event folds).
 * Part 2: protocol parity — the browser client (LiveChannelClient, global
 * WebSocket as shipped by Node 22) against the REAL merged ChannelServer
 * (src/connect, T-902), including a reconnect gap-resume. This is the proof
 * that the UI consumes the channel exactly as merged, zero server changes.
 *
 * Run: node --experimental-strip-types --test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { TokenStore } from "../../connect/tokens.ts";
import type { Scope } from "../../connect/tokens.ts";
import { ChannelServer } from "../../connect/channel.ts";
import type { RuntimeCommands } from "../../connect/channel.ts";
import { LiveChannelClient } from "../src/live/client.ts";
import {
  applyRunEventToDetail,
  applyRunEventToSummary,
  loopsViewOf,
  loopSummaryOf,
  narrowStreamEvent,
  runDetailOf,
  runSummaryOf,
} from "../src/live/mappers.ts";
import { resolveConnection } from "../src/live/source.ts";
import type { LoopDto } from "../src/live/wire.ts";
import type { Run, Turn } from "../../runtime/types.ts";

const NOW = new Date("2026-09-27T06:00:00.000Z");
const iso = (ms: number): string => new Date(NOW.getTime() - ms).toISOString();

// ---- fixtures -------------------------------------------------------------

function makeLoop(over: Partial<LoopDto> = {}): LoopDto {
  return {
    id: "triage-daily",
    name: "Triage digest",
    enabled: true,
    version: 3,
    createdAt: iso(86_400_000),
    updatedAt: iso(3_600_000),
    config: {
      name: "Triage digest",
      groupName: "Workspace",
      description: "Daily triage summary",
      icon: "🌅",
      color: "#5e6ad2",
      prompt: { format: "markdown", markdown: "Summarize triage." },
      trigger: { type: "schedule", schedule: { rrule: "FREQ=DAILY;BYHOUR=9", timezone: "UTC" } },
      conditions: [],
      enabled: true,
      applyToSubTeams: false,
      activities: ["comment"],
      trustedSourceKeys: [],
      codeAccess: "none",
      editAccess: "organization",
      subscriberIds: [],
    },
    ...over,
  };
}

function makeRun(over: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    loopId: "triage-daily",
    status: "complete",
    iteration: 7,
    createdAt: iso(3_600_000),
    startedAt: iso(3_600_000),
    endedAt: iso(3_559_000),
    summary: "Posted the digest.",
    usage: { inputTokens: 2180, outputTokens: 412, costUsd: 0.0042 },
    target: { entity: "issue", id: "abc", label: "SUP-209" },
    ...over,
  };
}

const TURNS: Turn[] = [
  {
    id: "turn-1",
    runId: "run-1",
    position: 0,
    role: "agent",
    status: "complete",
    startedAt: iso(3_600_000),
    parts: [
      { kind: "thought", text: "Six new triage issues overnight." },
      { kind: "action", tool: "linear.commentCreate", label: "Post comment", argsSummary: "issue SUP-209", resultSummary: "comment created" },
    ],
  },
  {
    id: "turn-2",
    runId: "run-1",
    position: 1,
    role: "agent",
    status: "complete",
    startedAt: iso(3_580_000),
    parts: [{ kind: "response", text: "Digest posted: 6 issues, 2 urgent." }],
  },
];

// ---- part 1: mappers ------------------------------------------------------

test("loopSummaryOf maps config display fields with single-user defaults", () => {
  const s = loopSummaryOf(makeLoop());
  assert.equal(s.id, "triage-daily");
  assert.equal(s.name, "Triage digest");
  assert.equal(s.icon, "🌅");
  assert.equal(s.color, "#5e6ad2");
  assert.equal(s.groupName, "Workspace");
  assert.equal(s.ownerName, "You"); // no server-resolved names in v1
  assert.equal(s.enabled, true);
  assert.equal(s.trigger.type, "schedule");
  assert.equal(s.lastRun, undefined);
});

test("loopsViewOf joins the latest run per loop as the chip", () => {
  const older = makeRun({ id: "run-0", createdAt: iso(90_000_000) });
  const newer = makeRun({ id: "run-1", createdAt: iso(3_600_000), status: "error" });
  const [s] = loopsViewOf([makeLoop()], [older, newer], NOW);
  assert.equal(s?.lastRun?.status, "error");
  assert.equal(s?.lastRun?.at, newer.endedAt);
  assert.equal(s?.lastRun?.durationMs, 41_000);
});

test("runSummaryOf computes duration + suppresses zero cost; live runs measure to now", () => {
  const done = runSummaryOf(makeRun(), "Triage digest", NOW);
  assert.equal(done.durationMs, 41_000);
  assert.equal(done.costUsd, 0.0042);
  assert.equal(done.target?.label, "SUP-209");
  assert.equal(done.loopName, "Triage digest");

  const free = runSummaryOf(makeRun({ usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } }), undefined, NOW);
  assert.equal(free.costUsd, undefined);
  assert.equal(free.loopName, "triage-daily"); // falls back to the loop id

  const live = runSummaryOf(
    makeRun({ status: "active", startedAt: iso(20_000), endedAt: undefined }),
    undefined,
    NOW,
  );
  assert.equal(live.durationMs, 20_000);

  const queued = runSummaryOf(makeRun({ status: "pending", startedAt: undefined, endedAt: undefined }), undefined, NOW);
  assert.equal(queued.durationMs, undefined);
});

test("runDetailOf flattens turns into an ordered stream with usage + summary", () => {
  const d = runDetailOf(makeRun(), TURNS, "Triage digest", NOW);
  assert.deepEqual(d.activities.map((a) => a.kind), ["thought", "action", "response"]);
  assert.deepEqual(d.activities.map((a) => a.position), [1, 2, 3]);
  assert.equal(d.usage?.costUsd, 0.0042);
  assert.equal(d.summary, "Posted the digest.");
});

test("runDetailOf appends a record-only pending elicitation exactly once", () => {
  const pending = { kind: "elicitation" as const, elicitationKind: "select" as const, prompt: "Post it?", choices: ["Post", "Discard"] };
  const parked = makeRun({ status: "awaitingInput", endedAt: undefined, pendingElicitation: pending });
  const d = runDetailOf(parked, TURNS, undefined, NOW);
  const elicitations = d.activities.filter((a) => a.kind === "elicitation");
  assert.equal(elicitations.length, 1);
  assert.equal(elicitations[0]?.kind === "elicitation" && elicitations[0].prompt, "Post it?");

  // Already streamed as a part → not duplicated from the record.
  const turnsWithElicitation: Turn[] = [
    ...TURNS,
    {
      id: "turn-3",
      runId: "run-1",
      position: 2,
      role: "agent",
      status: "complete",
      startedAt: iso(3_570_000),
      parts: [pending],
    },
  ];
  const d2 = runDetailOf(parked, turnsWithElicitation, undefined, NOW);
  assert.equal(d2.activities.filter((a) => a.kind === "elicitation").length, 1);
});

test("applyRunEventToDetail folds status, parts, and usage", () => {
  let d = runDetailOf(makeRun({ status: "active", endedAt: undefined, summary: undefined }), TURNS, undefined, NOW);
  d = applyRunEventToDetail(d, {
    type: "partAppended",
    turnId: "turn-2",
    part: { kind: "thought", text: "Streaming tail." },
  });
  assert.equal(d.activities.length, 4);
  assert.equal(d.activities[3]?.kind, "thought");
  assert.equal(d.activities[3]?.position, 4);

  d = applyRunEventToDetail(d, { type: "usage", usage: { inputTokens: 5, outputTokens: 6, costUsd: 0.001 } });
  assert.equal(d.usage?.costUsd, 0.001);

  d = applyRunEventToDetail(d, {
    type: "runStatus",
    status: "complete",
    run: makeRun({ status: "complete", summary: "Done.", usage: { inputTokens: 5, outputTokens: 6, costUsd: 0.001 } }),
  });
  assert.equal(d.status, "complete");
  assert.equal(d.summary, "Done.");
  assert.equal(d.activities.length, 4); // status fold never touches the stream
});

test("applyRunEventToSummary folds status + cost into a list row", () => {
  const row = runSummaryOf(makeRun({ status: "active", endedAt: undefined }), undefined, NOW);
  const done = applyRunEventToSummary(row, { type: "runStatus", status: "error", run: makeRun({ status: "error" }) }, NOW);
  assert.equal(done.status, "error");
  assert.equal(done.durationMs, 41_000);
  const paid = applyRunEventToSummary(done, { type: "usage", usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.01 } }, NOW);
  assert.equal(paid.costUsd, 0.01);
});

test("narrowStreamEvent validates at the boundary and never throws", () => {
  assert.equal(narrowStreamEvent({ type: "mystery" }), null);
  assert.equal(narrowStreamEvent({ type: "partAppended" }), null);
  assert.equal(narrowStreamEvent({ type: "runStatus", status: "active" }), null);
  const ok = narrowStreamEvent({ type: "usage", usage: { inputTokens: 1, outputTokens: 2, costUsd: 0.5 } });
  assert.equal(ok?.type, "usage");
});

// ---- part 1b: connection resolution ---------------------------------------

test("resolveConnection: URL params persist and win over storage; absent → demo", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  assert.equal(resolveConnection(undefined), null);
  assert.equal(resolveConnection({ location: { search: "" }, localStorage: storage }), null);

  const viaUrl = resolveConnection({
    location: { search: "?t3url=ws://127.0.0.1:7373/connect&t3token=t3_abc" },
    localStorage: storage,
  });
  assert.deepEqual(viaUrl, { url: "ws://127.0.0.1:7373/connect", token: "t3_abc" });
  // Persisted for the next load without params.
  const fromStore = resolveConnection({ location: { search: "" }, localStorage: storage });
  assert.deepEqual(fromStore, viaUrl);
});

// ---- part 2: protocol parity against the real ChannelServer ---------------

const FULL: Scope[] = ["env:read", "loops:read", "loops:write", "runs:read", "runs:write"];

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

test("LiveChannelClient speaks the merged channel protocol (auth, RPC, subscribe, resume)", async () => {
  const tokens = new TokenStore();
  const active = new Set<string>(["run-1"]);
  const calls: { method: string; runId: string; text?: string }[] = [];
  const runtime: RuntimeCommands = {
    steer: (runId, text) => (calls.push({ method: "steer", runId, text }), { accepted: true }),
    cancel: (runId) => (calls.push({ method: "cancel", runId }), { canceled: true }),
    continue: (runId, text) => (calls.push({ method: "continue", runId, text }), { continued: true }),
  };
  const channel = new ChannelServer({
    tokens,
    registry: { has: (id) => active.has(id), activeRunIds: () => [...active] },
    runtime,
    descriptor: {
      id: "env-test",
      label: "test",
      platform: "linux",
      capabilities: ["loops", "runs", "settings"],
      protocol: 1,
      product: "loops-server",
      version: "0.1.0",
    },
  });
  // The composition-root seam the UI's wire contract targets (T-1103 shape).
  channel.register("loops.list", () => ({ loops: [{ id: "triage-daily", name: "Triage digest" }] }));
  const server = createServer((_req, res) => {
    res.writeHead(404).end();
  });
  channel.attach(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/connect`;

  try {
    const { token } = tokens.mint({ scopes: FULL });
    const client = new LiveChannelClient({ url, token, minDelayMs: 20, maxDelayMs: 100 });
    await client.connect();
    assert.equal(client.isOpen, true);

    // Plain request/response: env.describe + a composition-root method.
    const descriptor = (await client.request("env.describe")) as Record<string, unknown>;
    assert.equal(descriptor["product"], "loops-server");
    const loops = (await client.request("loops.list")) as { loops: { id: string }[] };
    assert.equal(loops.loops[0]?.id, "triage-daily");

    // Subscribe + live fan-out.
    const seen: { type: string; seq: number }[] = [];
    const sub = await client.subscribeRuns("run-1", (event, seq) => seen.push({ type: event.type, seq }));
    assert.equal(sub.ok, true);
    assert.deepEqual(sub.active, ["run-1"]);
    channel.publishRunEvent("run-1", { type: "runStatus", status: "active" });
    await wait(50);
    assert.deepEqual(seen, [{ type: "runStatus", seq: 1 }]);

    // Runtime delegation (the FollowUpBox intents).
    const steerResult = (await client.request("runs.steer", { id: "run-1", text: "focus on blockers" })) as Record<string, unknown>;
    assert.equal(steerResult["accepted"], true);
    assert.deepEqual(calls, [{ method: "steer", runId: "run-1", text: "focus on blockers" }]);

    // Reconnect: the subscription resumes from the last seen seq.
    channel.closeAll(1000);
    await wait(150); // backoff min 20ms → reopened by now
    assert.equal(client.isOpen, true);
    await wait(50); // resubscribe with sinceSeq=1 completes
    channel.publishRunEvent("run-1", { type: "usage", usage: { inputTokens: 1, outputTokens: 1, costUsd: 0.01 } });
    await wait(50);
    assert.deepEqual(seen, [
      { type: "runStatus", seq: 1 },
      { type: "usage", seq: 2 },
    ]);

    await client.close();
  } finally {
    channel.closeAll();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
