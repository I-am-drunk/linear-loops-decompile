/**
 * Tests for HarnessBrain (T-1201): history→wire mapping, delta→part
 * buffering, usage delta normalization, cooperative cancel, error
 * propagation, and an end-to-end pass through the real Runner.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { BrainInput } from "./brain.ts";
import {
  HarnessBrain,
  toChatMessages,
  type ChatAdapterLike,
  type HarnessStreamEvent,
} from "./harness-brain.ts";
import { Runner } from "./runner.ts";
import type { Part, RunUsage, Turn } from "./types.ts";

// --- fakes -----------------------------------------------------------------

class FakeAdapter implements ChatAdapterLike {
  seen: { messages: { role: string; content: string }[]; signal?: AbortSignal }[] = [];
  #script: HarnessStreamEvent[][];
  constructor(script: HarnessStreamEvent[][]) {
    this.#script = script;
  }
  async *streamChat(req: {
    messages: { role: string; content: string }[];
    signal?: AbortSignal;
  }): AsyncGenerator<HarnessStreamEvent> {
    this.seen.push(req);
    for (const event of this.#script.shift() ?? []) {
      if (req.signal?.aborted) return;
      yield event;
    }
  }
}

class AbortingAdapter implements ChatAdapterLike {
  async *streamChat(req: { signal?: AbortSignal }): AsyncGenerator<HarnessStreamEvent> {
    yield { type: "text", text: "partial" };
    // Simulate a fetch torn down by the abort: the next read throws.
    await new Promise((r) => setTimeout(r, 5));
    if (req.signal?.aborted) throw new Error("fetch aborted");
    yield { type: "text", text: "rest" };
  }
}

class ThrowingAdapter implements ChatAdapterLike {
  async *streamChat(): AsyncGenerator<HarnessStreamEvent> {
    yield { type: "reasoning", text: "hmm" };
    throw new Error("401 unauthorized: bad api key");
  }
}

let seq = 0;
const mkTurn = (role: Turn["role"], parts: Part[]): Turn => ({
  id: `t${++seq}`,
  runId: "r1",
  position: seq,
  role,
  parts,
  status: "complete",
  startedAt: "2026-09-27T00:00:00.000Z",
});

const mkInput = (history: Turn[], message: string): BrainInput => ({
  run: {
    id: "r1",
    loopId: "loop1",
    status: "active",
    iteration: 1,
    createdAt: "2026-09-27T00:00:00.000Z",
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  },
  history,
  message,
});

const collect = async (iter: AsyncIterable<Part>): Promise<Part[]> => {
  const out: Part[] = [];
  for await (const p of iter) out.push(p);
  return out;
};

// --- history → wire mapping -------------------------------------------------

test("toChatMessages: user turns→user, agent responses→assistant, thoughts dropped, system prefix first", () => {
  const history = [
    mkTurn("user", [{ kind: "steered", text: "first ask" }]),
    mkTurn("agent", [
      { kind: "thought", text: "secret reasoning" },
      { kind: "response", text: "first answer" },
    ]),
    mkTurn("user", [{ kind: "steered", text: "follow up" }]),
    mkTurn("agent", [{ kind: "response", text: "second answer" }]),
  ];
  const messages = toChatMessages(mkInput(history, "current ask"), "You are a loop.");
  assert.deepEqual(messages, [
    { role: "system", content: "You are a loop." },
    { role: "user", content: "first ask" },
    { role: "assistant", content: "first answer" },
    { role: "user", content: "follow up" },
    { role: "assistant", content: "second answer" },
    { role: "user", content: "current ask" },
  ]);
});

test("toChatMessages: elicitation prompts stay on the wire (context for the answer); empty turns skipped; no prefix → no system message", () => {
  const history = [
    mkTurn("agent", [
      { kind: "response", text: "working on it" },
      { kind: "elicitation", elicitationKind: "select", prompt: "which env?", choices: ["staging", "prod"] },
    ]),
    mkTurn("agent", [{ kind: "thought", text: "only thoughts here" }]),
    mkTurn("user", [{ kind: "steered", text: "staging" }]),
  ];
  const messages = toChatMessages(mkInput(history, "and go"));
  assert.deepEqual(messages, [
    { role: "assistant", content: "working on it\n\n[Asked the user] which env? (choices: staging / prod)" },
    { role: "user", content: "staging" },
    { role: "user", content: "and go" },
  ]);
});

// --- delta → part buffering --------------------------------------------------

test("stream: one part per contiguous block; reasoning→thought, text→response; done ends", async () => {
  const adapter = new FakeAdapter([[
    { type: "reasoning", text: "think " },
    { type: "reasoning", text: "more" },
    { type: "text", text: "Hello" },
    { type: "text", text: " world" },
    { type: "reasoning", text: "afterthought" },
    { type: "text", text: "!" },
    { type: "done", finishReason: "stop" },
  ]]);
  const brain = new HarnessBrain(adapter);
  const parts = await collect(brain.stream(mkInput([], "hi"), new AbortController().signal));
  assert.deepEqual(parts, [
    { kind: "thought", text: "think more" },
    { kind: "response", text: "Hello world" },
    { kind: "thought", text: "afterthought" },
    { kind: "response", text: "!" },
  ]);
  // the abort signal went straight through to the adapter
  assert.equal(adapter.seen.length, 1);
  assert.ok(adapter.seen[0]!.signal instanceof AbortSignal);
});

// --- usage → onUsage deltas ---------------------------------------------------

test("stream: usage events become positive deltas (cumulative snapshots do not double-count)", async () => {
  const adapter = new FakeAdapter([[
    { type: "usage", inputTokens: 25, outputTokens: 1 }, // Anthropic-style start
    { type: "text", text: "answer" },
    { type: "usage", inputTokens: 25, outputTokens: 87 }, // cumulative snapshot
    { type: "done", finishReason: "stop" },
  ]]);
  const usage: { runId: string; delta: { inputTokens?: number; outputTokens?: number } }[] = [];
  const brain = new HarnessBrain(adapter, {
    onUsage: (runId, delta) => usage.push({ runId, delta }),
  });
  await collect(brain.stream(mkInput([], "hi"), new AbortController().signal));
  assert.deepEqual(usage, [
    { runId: "r1", delta: { inputTokens: 25, outputTokens: 1 } },
    { runId: "r1", delta: { outputTokens: 86 } },
  ]);
});

test("stream: usage arriving AFTER done is still reported (the real OpenAI wire order)", async () => {
  // stream_options.include_usage sends finish_reason in one chunk, then a
  // final usage chunk, then [DONE] — so done reaches us before usage.
  const adapter = new FakeAdapter([[
    { type: "text", text: "answer" },
    { type: "done", finishReason: "stop" },
    { type: "usage", inputTokens: 11, outputTokens: 4 },
  ]]);
  const usage: { runId: string; delta: { inputTokens?: number; outputTokens?: number } }[] = [];
  const brain = new HarnessBrain(adapter, {
    onUsage: (runId, delta) => usage.push({ runId, delta }),
  });
  const parts = await collect(brain.stream(mkInput([], "hi"), new AbortController().signal));
  assert.deepEqual(parts, [{ kind: "response", text: "answer" }]);
  assert.deepEqual(usage, [{ runId: "r1", delta: { inputTokens: 11, outputTokens: 4 } }]);
});

test("stream: no onUsage → no crash; final-total style usage forwarded once", async () => {
  const adapter = new FakeAdapter([[
    { type: "text", text: "x" },
    { type: "usage", inputTokens: 10, outputTokens: 4 }, // OpenAI-style final total
    { type: "done", finishReason: "stop" },
  ]]);
  const brain = new HarnessBrain(adapter); // no onUsage
  const parts = await collect(brain.stream(mkInput([], "hi"), new AbortController().signal));
  assert.deepEqual(parts, [{ kind: "response", text: "x" }]);
});

test("stream: model/effort/maxTokens overrides pass through to the adapter", async () => {
  const adapter = new FakeAdapter([[{ type: "text", text: "ok" }, { type: "done", finishReason: "stop" }]]);
  const brain = new HarnessBrain(adapter, { model: "anthropic/claude-opus-4", effort: "high", maxTokens: 2048 });
  await collect(brain.stream(mkInput([], "hi"), new AbortController().signal));
  const req = adapter.seen[0]! as unknown as Record<string, unknown>;
  assert.equal(req.model, "anthropic/claude-opus-4");
  assert.equal(req.effort, "high");
  assert.equal(req.maxTokens, 2048);
});

// --- cancel + errors -----------------------------------------------------------

test("stream: abort mid-stream flushes buffered text and returns quietly", async () => {
  const controller = new AbortController();
  const brain = new HarnessBrain(new AbortingAdapter());
  const iter = brain.stream(mkInput([], "hi"), controller.signal)[Symbol.asyncIterator]();
  const p1 = iter.next(); // pulls "partial" into the buffer, then parks on the adapter
  controller.abort();
  const first = await p1;
  // the buffered "partial" survived as a final part; no throw
  assert.deepEqual(first, { done: false, value: { kind: "response", text: "partial" } });
  assert.deepEqual(await iter.next(), { done: true, value: undefined });
});

test("stream: adapter failure propagates and fails the run (unflushed block discarded)", async () => {
  const brain = new HarnessBrain(new ThrowingAdapter());
  await assert.rejects(
    collect(brain.stream(mkInput([], "hi"), new AbortController().signal)),
    /401 unauthorized/,
  );
});

// --- end-to-end through the real Runner ---------------------------------------

test("runner integration: full exchange completes with parts + usage folded via recordUsage", async () => {
  const adapter = new FakeAdapter([[
    { type: "reasoning", text: "thinking" },
    { type: "text", text: "done!" },
    { type: "usage", inputTokens: 12, outputTokens: 7 },
    { type: "done", finishReason: "stop" },
  ]]);
  const runner = new Runner();
  const brain = new HarnessBrain(adapter, {
    onUsage: (runId, delta) => runner.recordUsage(runId, delta),
  });
  const run = runner.start({ loopId: "loop1", message: "run the loop", brain });
  const final = await runner.whenIdle(run.id);
  assert.equal(final.status, "complete");
  const turns = runner.getTurns(run.id);
  const agent = turns.find((t) => t.role === "agent");
  assert.ok(agent);
  assert.deepEqual(agent.parts, [
    { kind: "thought", text: "thinking" },
    { kind: "response", text: "done!" },
  ]);
  const usage: RunUsage = runner.getRun(run.id).usage;
  assert.deepEqual(usage, { inputTokens: 12, outputTokens: 7, costUsd: 0 });
});
