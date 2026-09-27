/**
 * Tests for the T-1105 brain binding: persisted settings → real adapter →
 * HarnessBrain → run, with the usage rail landing on run.usage. All
 * provider traffic is a scripted fixture fetch — no real network (PLAN.md).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Runner } from "../runtime/runner.ts";
import type { Part } from "../runtime/types.ts";
import type { WorkflowDefinition } from "../model/loop.ts";
import { SqliteSecretStore, HarnessSettingsStore } from "../inference/src/index.ts";
import { randomBytes } from "node:crypto";

import { openDatabase } from "./db.ts";
import { createBrainFor, createInferenceStores } from "./brain.ts";
import { createLoopsServer } from "./index.ts";

/** v1 resolves the default harness and never reads the loop (see brain.ts). */
const FAKE_LOOP = {} as WorkflowDefinition;

/** Scripted SSE body as a real Response (adapter reads res.body as a stream). */
function sseResponse(payloads: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const payload of payloads) {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

const SCRIPTED_STREAM = [
  JSON.stringify({ choices: [{ delta: { reasoning_content: "thinking…" } }] }),
  JSON.stringify({ choices: [{ delta: { content: "Hello " } }] }),
  JSON.stringify({ choices: [{ delta: { content: "world" } }] }),
  JSON.stringify({
    choices: [{ delta: {}, finish_reason: "stop" }],
    usage: { prompt_tokens: 11, completion_tokens: 4 },
  }),
  "[DONE]",
];

interface FetchCall {
  url: string;
  headers: Record<string, string>;
  body: { model: string; messages: { role: string; content: string }[]; stream: boolean };
}

/** A fixture fetch: records the call, replies with the scripted SSE stream. */
function fixtureFetch(): { fetchFn: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchFn = (async (input: unknown, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    return sseResponse(SCRIPTED_STREAM);
  }) as typeof fetch;
  return { fetchFn, calls };
}

function partsOf(runner: Runner, runId: string): Part[] {
  return runner.getTurns(runId).flatMap((turn) => turn.parts);
}

test("binds the default harness: settings → adapter → run end to end", async () => {
  const db = openDatabase(":memory:");
  try {
    const { harnessStore } = createInferenceStores(db, ":memory:");
    const created = harnessStore.create({
      name: "local",
      provider: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234/v1",
      apiKey: "sekret-key",
      model: "test-model",
      allowInsecureHttp: true,
    });
    assert.equal(created.isDefault, true); // first harness becomes default

    const runner = new Runner();
    const { fetchFn, calls } = fixtureFetch();
    const brainFor = createBrainFor({ harnessStore, runner, fetchFn });

    const run = runner.start({
      loopId: "loop-1",
      message: "Say hi",
      brain: brainFor(FAKE_LOOP),
    });
    const final = await runner.whenIdle(run.id);

    assert.equal(final.status, "complete");
    const parts = partsOf(runner, run.id);
    assert.deepEqual(
      parts.filter((p) => p.kind === "thought").map((p) => (p as { text: string }).text),
      ["thinking…"],
    );
    assert.deepEqual(
      parts.filter((p) => p.kind === "response").map((p) => (p as { text: string }).text),
      ["Hello world"],
    );

    // Usage rail: adapter usage event → HarnessBrain delta → runner.recordUsage.
    assert.equal(final.usage.inputTokens, 11);
    assert.equal(final.usage.outputTokens, 4);

    // The provider call: baseUrl from settings, key decrypted from the secret
    // store into the authorization header, model from settings, stream on.
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "http://127.0.0.1:1234/v1/chat/completions");
    assert.equal(calls[0]!.headers.authorization, "Bearer sekret-key");
    assert.equal(calls[0]!.body.model, "test-model");
    assert.equal(calls[0]!.body.stream, true);
    assert.deepEqual(calls[0]!.body.messages, [{ role: "user", content: "Say hi" }]);
  } finally {
    db.close();
  }
});

test("no harness configured → one actionable error part, never a throw", async () => {
  const db = openDatabase(":memory:");
  try {
    const { harnessStore } = createInferenceStores(db, ":memory:");
    const runner = new Runner();
    const brainFor = createBrainFor({ harnessStore, runner });

    const brain = brainFor(FAKE_LOOP);
    const parts: Part[] = [];
    for await (const part of brain.stream(
      { run: { id: "run-x" } as never, history: [], message: "hi" },
      new AbortController().signal,
    )) {
      parts.push(part);
    }
    assert.equal(parts.length, 1);
    assert.equal(parts[0]!.kind, "error");
    assert.match((parts[0] as { message: string }).message, /No inference harness is configured/);
  } finally {
    db.close();
  }
});

test("undecryptable key → error part naming the harness", async () => {
  const db = openDatabase(":memory:");
  try {
    const { harnessStore } = createInferenceStores(db, ":memory:");
    harnessStore.create({
      name: "local",
      provider: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234/v1",
      apiKey: "sekret-key",
      model: "test-model",
      allowInsecureHttp: true,
    });

    // A second store over the same rows but a DIFFERENT master key: the GCM
    // auth tag fails on decrypt (SecretUndecryptableError).
    const wrongKeyStore = new HarnessSettingsStore(
      db,
      new SqliteSecretStore(db, randomBytes(32)),
    );
    const runner = new Runner();
    const brainFor = createBrainFor({ harnessStore: wrongKeyStore, runner });

    const brain = brainFor(FAKE_LOOP);
    const parts: Part[] = [];
    for await (const part of brain.stream(
      { run: { id: "run-y" } as never, history: [], message: "hi" },
      new AbortController().signal,
    )) {
      parts.push(part);
    }
    assert.equal(parts.length, 1);
    assert.equal(parts[0]!.kind, "error");
    assert.match((parts[0] as { message: string }).message, /Harness "local" cannot be used/);
  } finally {
    db.close();
  }
});

test("a harness update invalidates the cached adapter", async () => {
  const db = openDatabase(":memory:");
  try {
    const { harnessStore } = createInferenceStores(db, ":memory:");
    const created = harnessStore.create({
      name: "local",
      provider: "openai-compatible",
      baseUrl: "http://127.0.0.1:1234/v1",
      model: "old-model",
      allowInsecureHttp: true,
    });

    const runner = new Runner();
    const { fetchFn, calls } = fixtureFetch();
    const brainFor = createBrainFor({ harnessStore, runner, fetchFn });

    const first = runner.start({
      loopId: "loop-1",
      message: "one",
      brain: brainFor(FAKE_LOOP),
    });
    await runner.whenIdle(first.id);
    assert.equal(calls[0]!.body.model, "old-model");

    harnessStore.update(created.id, { model: "new-model" });

    const second = runner.start({
      loopId: "loop-1",
      message: "two",
      brain: brainFor(FAKE_LOOP),
    });
    await runner.whenIdle(second.id);
    assert.equal(calls[1]!.body.model, "new-model");
  } finally {
    db.close();
  }
});

test("the composition root exposes brainFor + the harness store", async () => {
  const loops = createLoopsServer({ dbPath: ":memory:" });
  try {
    assert.equal(typeof loops.brainFor, "function");
    assert.deepEqual(loops.harnessStore.list(), []);
    // With no harness configured the factory still never throws.
    const brain = loops.brainFor(FAKE_LOOP);
    assert.equal(typeof brain.stream, "function");
  } finally {
    await loops.close();
  }
});
