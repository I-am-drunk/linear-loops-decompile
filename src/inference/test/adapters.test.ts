/**
 * T-602 verification: OpenAI-compatible adapter (OpenRouter + LiteLLM/vLLM/
 * Ollama) — SSE streaming normalization, effort mapping, headers, error and
 * cancel handling. All fetches are mocked; no network. Run: npm test
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AdapterHttpError,
  AnthropicAdapter,
  createChatAdapter,
  OpenAiCompatibleAdapter,
  type HarnessSettings,
  type InferenceStreamEvent,
  type StreamChatRequest,
} from "../src/index.ts";

// --- fixtures ---------------------------------------------------------------

const SETTINGS: HarnessSettings = {
  id: "har_test",
  name: "or",
  provider: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKeyRef: "sec_x",
  model: "anthropic/claude-sonnet-4",
  effort: "medium",
  extraHeaders: { "X-Title": "loops" },
  allowInsecureHttp: false,
  isDefault: true,
  createdAt: "2026-09-26T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
};

const REQ: StreamChatRequest = {
  messages: [{ role: "user", content: "hi" }],
};

function sseResponse(parts: string[], status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(new TextEncoder().encode(p));
      c.close();
    },
  });
  return new Response(stream, { status });
}

interface CapturedCall {
  url: string;
  init: { headers: Record<string, string>; body: string; signal?: AbortSignal };
}

/** Mock fetch that records the call and returns the given response factory. */
function mockFetch(respond: (call: CapturedCall) => Response) {
  const calls: CapturedCall[] = [];
  const fetchFn = (async (input: unknown, init?: unknown) => {
    const call: CapturedCall = {
      url: String(input),
      init: init as CapturedCall["init"],
    };
    calls.push(call);
    return respond(call);
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

async function drain(
  it: AsyncGenerator<InferenceStreamEvent>,
): Promise<InferenceStreamEvent[]> {
  const events: InferenceStreamEvent[] = [];
  for await (const e of it) events.push(e);
  return events;
}

// --- streaming ---------------------------------------------------------------

test("stream: text, reasoning, usage, done are normalized in order", async () => {
  const { fetchFn } = mockFetch(() =>
    sseResponse([
      'data: {"choices":[{"delta":{"reasoning_content":"thinking "}}]}\n',
      'data: {"choices":[{"delta":{"reasoning":"hard"},"finish_reason":null}]}\n',
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
      'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2}}\n',
      "data: [DONE]\n",
    ]),
  );
  const events = await drain(
    new OpenAiCompatibleAdapter({ settings: SETTINGS, apiKey: "sk-or", fetchFn }).streamChat(REQ),
  );
  assert.deepEqual(events, [
    { type: "reasoning", text: "thinking " },
    { type: "reasoning", text: "hard" },
    { type: "text", text: "Hello" },
    { type: "text", text: " world" },
    { type: "done", finishReason: "stop" },
    { type: "usage", inputTokens: 3, outputTokens: 2 },
    { type: "done", finishReason: null },
  ]);
});

test("stream: parser survives chunks split mid-line", async () => {
  const { fetchFn } = mockFetch(() =>
    sseResponse([
      'data: {"choices":[{"delta":{"con',
      'tent":"split"}}]}\r\ndata: [D',
      "ONE]\n",
    ]),
  );
  const events = await drain(
    new OpenAiCompatibleAdapter({ settings: SETTINGS, apiKey: null, fetchFn }).streamChat(REQ),
  );
  assert.deepEqual(events, [
    { type: "text", text: "split" },
    { type: "done", finishReason: null },
  ]);
});

// --- request shaping ----------------------------------------------------------

test("headers: bearer key when present, none when null, extraHeaders merged", async () => {
  const { calls, fetchFn } = mockFetch(() => sseResponse(["data: [DONE]\n"]));
  await drain(
    new OpenAiCompatibleAdapter({ settings: SETTINGS, apiKey: "sk-or", fetchFn }).streamChat(REQ),
  );
  assert.equal(calls[0]!.init.headers.authorization, "Bearer sk-or");
  assert.equal(calls[0]!.init.headers["X-Title"], "loops");
  assert.equal(calls[0]!.url, "https://openrouter.ai/api/v1/chat/completions");

  await drain(
    new OpenAiCompatibleAdapter({ settings: SETTINGS, apiKey: null, fetchFn }).streamChat(REQ),
  );
  assert.ok(!("authorization" in calls[1]!.init.headers));
});

test("effort: openrouter uses reasoning.effort, openai-compatible uses reasoning_effort, none omits", async () => {
  const { calls, fetchFn } = mockFetch(() => sseResponse(["data: [DONE]\n"]));
  const mk = (provider: HarnessSettings["provider"], effort: HarnessSettings["effort"]) =>
    new OpenAiCompatibleAdapter({
      settings: { ...SETTINGS, provider, effort },
      apiKey: null,
      fetchFn,
    });

  await drain(mk("openrouter", "high").streamChat(REQ));
  assert.deepEqual(JSON.parse(calls[0]!.init.body).reasoning, { effort: "high" });

  await drain(mk("openai-compatible", "low").streamChat(REQ));
  assert.equal(JSON.parse(calls[1]!.init.body).reasoning_effort, "low");

  await drain(mk("openai-compatible", "none").streamChat(REQ));
  const body = JSON.parse(calls[2]!.init.body);
  assert.ok(!("reasoning" in body) && !("reasoning_effort" in body));
});

test("model: request overrides harness default; stream_options include usage", async () => {
  const { calls, fetchFn } = mockFetch(() => sseResponse(["data: [DONE]\n"]));
  const adapter = new OpenAiCompatibleAdapter({ settings: SETTINGS, apiKey: null, fetchFn });
  await drain(adapter.streamChat(REQ));
  assert.equal(JSON.parse(calls[0]!.init.body).model, "anthropic/claude-sonnet-4");
  assert.deepEqual(JSON.parse(calls[0]!.init.body).stream_options, { include_usage: true });
  await drain(adapter.streamChat({ ...REQ, model: "gpt-5.5" }));
  assert.equal(JSON.parse(calls[1]!.init.body).model, "gpt-5.5");
});

// --- errors + cancel ------------------------------------------------------------

test("http errors: AdapterHttpError with status and hints", async () => {
  const mk = (status: number, text: string) =>
    new OpenAiCompatibleAdapter({
      settings: SETTINGS,
      apiKey: null,
      fetchFn: (async () => new Response(text, { status })) as unknown as typeof fetch,
    });
  const e401 = await drain(mk(401, "bad key").streamChat(REQ)).then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(e401 instanceof AdapterHttpError);
  assert.equal(e401.status, 401);
  assert.match(e401.message, /check the harness API key/);

  const e429 = await drain(mk(429, "slow down").streamChat(REQ)).then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(e429 instanceof AdapterHttpError);
  assert.equal(e429.status, 429);
  assert.match(e429.message, /rate limit/);
});

test("cancel: aborted signal reaches fetch and rejects the stream", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchFn = (async (_input: unknown, init?: { signal?: AbortSignal }) => {
    if (init?.signal?.aborted) {
      throw new DOMException("This operation was aborted", "AbortError");
    }
    return sseResponse(["data: [DONE]\n"]);
  }) as unknown as typeof fetch;
  const it = new OpenAiCompatibleAdapter({ settings: SETTINGS, apiKey: null, fetchFn }).streamChat({
    ...REQ,
    signal: controller.signal,
  });
  await assert.rejects(it.next(), /abort/i);
});

// --- model probe (T-603) ----------------------------------------------------------

test("listModels: parses OpenAI-shaped /models responses", async () => {
  const { calls, fetchFn } = mockFetch(
    () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "anthropic/claude-sonnet-4", name: "Anthropic: Claude Sonnet 4" },
            { id: "gpt-5.5", name: "gpt-5.5" },
            { nope: true },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  const models = await new OpenAiCompatibleAdapter({
    settings: SETTINGS,
    apiKey: "sk-or",
    fetchFn,
  }).listModels();
  assert.equal(calls[0]!.url, "https://openrouter.ai/api/v1/models");
  assert.equal(calls[0]!.init.headers.authorization, "Bearer sk-or");
  assert.deepEqual(models, [
    { id: "anthropic/claude-sonnet-4", label: "Anthropic: Claude Sonnet 4" },
    { id: "gpt-5.5", label: null },
  ]);
});

test("listModels: non-2xx raises AdapterHttpError", async () => {
  const fetchFn = (async () => new Response("bad key", { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(
    new OpenAiCompatibleAdapter({ settings: SETTINGS, apiKey: null, fetchFn }).listModels(),
    AdapterHttpError,
  );
});

// --- factory ---------------------------------------------------------------------

test("factory: serves all three providers (anthropic via T-603 adapter)", () => {
  assert.ok(
    createChatAdapter({ settings: SETTINGS, apiKey: null }) instanceof OpenAiCompatibleAdapter,
  );
  assert.ok(
    createChatAdapter({
      settings: { ...SETTINGS, provider: "anthropic", baseUrl: "https://api.anthropic.com" },
      apiKey: null,
    }) instanceof AnthropicAdapter,
  );
});

