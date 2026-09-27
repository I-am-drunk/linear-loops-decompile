/**
 * T-603 verification: Anthropic messages-API adapter — headers (x-api-key,
 * anthropic-version), system-message hoisting, effort→thinking budget
 * mapping, SSE normalization (thinking_delta→reasoning, text_delta→text,
 * usage frames, stop reasons), error and cancel handling, model probe.
 * All fetches are mocked; no network. Run: npm test
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AdapterHttpError,
  AnthropicAdapter,
  InferenceError,
  type HarnessSettings,
  type InferenceStreamEvent,
  type StreamChatRequest,
} from "../src/index.ts";

// --- fixtures ---------------------------------------------------------------

const SETTINGS: HarnessSettings = {
  id: "har_ant",
  name: "claude",
  provider: "anthropic",
  baseUrl: "https://api.anthropic.com",
  apiKeyRef: "sec_y",
  model: "claude-sonnet-4-5",
  effort: "medium",
  extraHeaders: {},
  allowInsecureHttp: false,
  isDefault: true,
  createdAt: "2026-09-26T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
};

const REQ: StreamChatRequest = {
  messages: [
    { role: "system", content: "You summarize Linear issues." },
    { role: "user", content: "hi" },
  ],
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

function mockFetch(respond: (call: CapturedCall) => Response) {
  const calls: CapturedCall[] = [];
  const fetchFn = (async (input: unknown, init?: unknown) => {
    const call: CapturedCall = { url: String(input), init: init as CapturedCall["init"] };
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

const mk = (fetchFn: typeof fetch, over: Partial<HarnessSettings> = {}) =>
  new AnthropicAdapter({ settings: { ...SETTINGS, ...over }, apiKey: "sk-ant", fetchFn });

// --- streaming ---------------------------------------------------------------

test("stream: thinking, text, split usage frames, and stop reason normalize in order", async () => {
  const { fetchFn } = mockFetch(() =>
    sseResponse([
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":25,"output_tokens":1}}}\n\n',
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}\n\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"let me "}}\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"think"}}\n',
      'data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}\n',
      'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hello"}}\n',
      'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":" world"}}\n',
      'data: {"type":"ping"}\n',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":12}}\n',
      'data: {"type":"message_stop"}\n',
    ]),
  );
  const events = await drain(mk(fetchFn).streamChat(REQ));
  assert.deepEqual(events, [
    { type: "usage", inputTokens: 25, outputTokens: null },
    { type: "reasoning", text: "let me " },
    { type: "reasoning", text: "think" },
    { type: "text", text: "Hello" },
    { type: "text", text: " world" },
    { type: "usage", inputTokens: null, outputTokens: 12 },
    { type: "done", finishReason: "end_turn" },
  ]);
});

test("stream: parser survives chunks split mid-line; done emitted exactly once", async () => {
  const { fetchFn } = mockFetch(() =>
    sseResponse([
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_de',
      'lta","text":"split"}}\r\ndata: {"type":"message_stop"}\nda',
      'ta: {"type":"message_stop"}\n',
    ]),
  );
  const events = await drain(mk(fetchFn).streamChat(REQ));
  assert.deepEqual(events, [
    { type: "text", text: "split" },
    { type: "done", finishReason: null },
  ]);
});

test("stream: input_json_delta (tool use) is skipped in v1", async () => {
  const { fetchFn } = mockFetch(() =>
    sseResponse([
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"q\\":"}}\n',
      'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"after"}}\n',
      'data: {"type":"message_stop"}\n',
    ]),
  );
  const events = await drain(mk(fetchFn).streamChat(REQ));
  assert.deepEqual(events, [
    { type: "text", text: "after" },
    { type: "done", finishReason: null },
  ]);
});

test("stream: error event raises InferenceError with detail", async () => {
  const { fetchFn } = mockFetch(() =>
    sseResponse([
      'data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n',
    ]),
  );
  const err = await drain(mk(fetchFn).streamChat(REQ)).then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(err instanceof InferenceError);
  assert.match(err.message, /overloaded_error/);
});

// --- request shaping ----------------------------------------------------------

test("headers: x-api-key + anthropic-version, never a bearer token", async () => {
  const { calls, fetchFn } = mockFetch(() => sseResponse(['data: {"type":"message_stop"}\n']));
  await drain(mk(fetchFn).streamChat(REQ));
  const h = calls[0]!.init.headers;
  assert.equal(h["x-api-key"], "sk-ant");
  assert.equal(h["anthropic-version"], "2023-06-01");
  assert.ok(!("authorization" in h));
  assert.equal(calls[0]!.url, "https://api.anthropic.com/v1/messages");
});

test("body: system messages hoisted out of messages; max_tokens defaulted", async () => {
  const { calls, fetchFn } = mockFetch(() => sseResponse(['data: {"type":"message_stop"}\n']));
  await drain(mk(fetchFn).streamChat(REQ));
  const body = JSON.parse(calls[0]!.init.body);
  assert.equal(body.system, "You summarize Linear issues.");
  assert.deepEqual(body.messages, [{ role: "user", content: "hi" }]);
  assert.equal(body.stream, true);
  assert.equal(body.max_tokens, 8192 + 0); // default; medium effort budget 4096 < 8192
  assert.deepEqual(body.thinking, { type: "enabled", budget_tokens: 4096 });
});

test("effort: none omits thinking; high raises max_tokens above the budget", async () => {
  const { calls, fetchFn } = mockFetch(() => sseResponse(['data: {"type":"message_stop"}\n']));
  await drain(mk(fetchFn, { effort: "none" }).streamChat(REQ));
  assert.ok(!("thinking" in JSON.parse(calls[0]!.init.body)));

  await drain(
    mk(fetchFn, { effort: "high" }).streamChat({ ...REQ, maxTokens: 2000 }),
  );
  const body = JSON.parse(calls[1]!.init.body);
  assert.deepEqual(body.thinking, { type: "enabled", budget_tokens: 16384 });
  assert.equal(body.max_tokens, 16384 + 1024);
});

test("model: request overrides harness default", async () => {
  const { calls, fetchFn } = mockFetch(() => sseResponse(['data: {"type":"message_stop"}\n']));
  const adapter = mk(fetchFn);
  await drain(adapter.streamChat(REQ));
  assert.equal(JSON.parse(calls[0]!.init.body).model, "claude-sonnet-4-5");
  await drain(adapter.streamChat({ ...REQ, model: "claude-opus-4-1" }));
  assert.equal(JSON.parse(calls[1]!.init.body).model, "claude-opus-4-1");
});

// --- errors + cancel ------------------------------------------------------------

test("http errors: AdapterHttpError with status and hints", async () => {
  const fetchFn = (async () => new Response('{"error":{"type":"authentication_error"}}', { status: 401 })) as unknown as typeof fetch;
  const err = await drain(mk(fetchFn).streamChat(REQ)).then(
    () => null,
    (e: unknown) => e,
  );
  assert.ok(err instanceof AdapterHttpError);
  assert.equal(err.status, 401);
  assert.match(err.message, /check the harness API key/);
});

test("cancel: aborted signal reaches fetch and rejects the stream", async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchFn = (async (_input: unknown, init?: { signal?: AbortSignal }) => {
    if (init?.signal?.aborted) throw new DOMException("This operation was aborted", "AbortError");
    return sseResponse(['data: {"type":"message_stop"}\n']);
  }) as unknown as typeof fetch;
  const it = mk(fetchFn).streamChat({ ...REQ, signal: controller.signal });
  await assert.rejects(it.next(), /abort/i);
});

// --- model probe -----------------------------------------------------------------

test("listModels: parses Anthropic /v1/models (display_name as label)", async () => {
  const { calls, fetchFn } = mockFetch(
    () =>
      new Response(
        JSON.stringify({
          data: [
            { type: "model", id: "claude-sonnet-4-5", display_name: "Claude Sonnet 4.5" },
            { type: "model", id: "claude-haiku-4-5" },
          ],
          has_more: false,
        }),
        { status: 200 },
      ),
  );
  const models = await mk(fetchFn).listModels();
  assert.equal(calls[0]!.url, "https://api.anthropic.com/v1/models?limit=1000");
  assert.equal(calls[0]!.init.headers["x-api-key"], "sk-ant");
  assert.deepEqual(models, [
    { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5", label: null },
  ]);
});

test("constructor: refuses non-anthropic settings", () => {
  assert.throws(
    () => new AnthropicAdapter({ settings: { ...SETTINGS, provider: "openrouter" }, apiKey: null }),
    InferenceError,
  );
});
