/**
 * OpenAI-compatible chat adapter — one client covering the `openrouter` and
 * `openai-compatible` providers (the latter reaches LiteLLM, vLLM, Ollama,
 * and any other server speaking the chat-completions wire format).
 *
 * What it does: POSTs `{baseUrl}/chat/completions` with `stream: true`,
 * parses the SSE event stream, and yields normalized InferenceStreamEvents.
 * `reasoning` events map onto the runtime's `Part.thought`, `text` events
 * onto `Part.response` (SPECS/agent.md) — the runtime wraps this stream in
 * its own Part types; this package stays transport-only (YAGNI: no retries
 * or budgets here — per-run usage counters live in ../usage.ts, T-603).
 *
 * Cancel = pass an AbortSignal in the request; the underlying fetch is
 * aborted and the generator terminates (cooperative cancel, matching the
 * Brain contract's `cancel(runId)` semantics).
 */

import { AdapterHttpError, InferenceError } from "../errors.ts";
import type { Effort, HarnessSettings, InferenceProvider } from "../settings.ts";
import { AnthropicAdapter } from "./anthropic.ts";
import type { ChatAdapter, ModelInfo } from "./types.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface StreamChatRequest {
  messages: ChatMessage[];
  /** Overrides the harness's default model for this call. */
  model?: string;
  /** Overrides the harness's default effort for this call. */
  effort?: Effort;
  /** Optional cap on completion tokens. */
  maxTokens?: number;
  /** Cooperative cancel (Brain.cancel → abort this signal). */
  signal?: AbortSignal;
}

/** Normalized stream events; R5 maps reasoning→thought, text→response. */
export type InferenceStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "text"; text: string }
  | { type: "usage"; inputTokens: number | null; outputTokens: number | null }
  | { type: "done"; finishReason: string | null };

/** Providers this adapter serves (Anthropic lives in ./anthropic.ts). */
export const OPENAI_COMPATIBLE_PROVIDERS = ["openrouter", "openai-compatible"] as const;
export type OpenAiCompatibleProvider = (typeof OPENAI_COMPATIBLE_PROVIDERS)[number];

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class OpenAiCompatibleAdapter implements ChatAdapter {
  readonly provider: InferenceProvider;
  readonly #settings: HarnessSettings;
  readonly #apiKey: string | null;
  readonly #fetch: typeof fetch;

  constructor(opts: {
    settings: HarnessSettings;
    apiKey: string | null;
    /** Injectable for tests; defaults to global fetch. */
    fetchFn?: typeof fetch;
  }) {
    if (!OPENAI_COMPATIBLE_PROVIDERS.includes(opts.settings.provider as OpenAiCompatibleProvider)) {
      throw new InferenceError(
        `OpenAiCompatibleAdapter cannot serve provider "${opts.settings.provider}"`,
      );
    }
    this.provider = opts.settings.provider;
    this.#settings = opts.settings;
    this.#apiKey = opts.apiKey;
    this.#fetch = opts.fetchFn ?? fetch;
  }

  /** Stream a chat completion as normalized events. */
  async *streamChat(req: StreamChatRequest): AsyncGenerator<InferenceStreamEvent> {
    const res = await this.#fetch(`${this.#settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify(this.#body(req)),
      ...(req.signal ? { signal: req.signal } : {}),
    });
    if (!res.ok || res.body === null) {
      throw await AdapterHttpError.fromResponse(
        res,
        `${this.provider} chat completion failed`,
      );
    }
    yield* parseChatCompletionStream(res.body);
  }

  /**
   * Probe GET /models for the settings UI's model picker (T-603). Works for
   * OpenRouter and any server speaking the OpenAI shape — LiteLLM, vLLM,
   * and Ollama's /v1 endpoint included.
   */
  async listModels(): Promise<ModelInfo[]> {
    const res = await this.#fetch(`${this.#settings.baseUrl}/models`, {
      headers: this.#headers(),
    });
    if (!res.ok) {
      throw await AdapterHttpError.fromResponse(res, `${this.provider} model probe failed`);
    }
    const body = (await res.json()) as { data?: { id?: unknown; name?: unknown }[] };
    return (body.data ?? [])
      .filter((m) => typeof m.id === "string")
      .map((m) => ({
        id: m.id as string,
        label: typeof m.name === "string" && m.name !== m.id ? m.name : null,
      }));
  }

  #headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.#settings.extraHeaders,
    };
    if (this.#apiKey !== null) headers.authorization = `Bearer ${this.#apiKey}`;
    return headers;
  }

  #body(req: StreamChatRequest): Record<string, unknown> {
    const effort = req.effort ?? this.#settings.effort;
    const body: Record<string, unknown> = {
      model: req.model ?? this.#settings.model,
      messages: req.messages,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    // Normalized effort → provider parameter (omitted entirely for "none").
    if (effort !== "none") {
      if (this.provider === "openrouter") body.reasoning = { effort };
      else body.reasoning_effort = effort;
    }
    return body;
  }
}

// ---------------------------------------------------------------------------
// SSE parsing (chat-completions wire format)
// ---------------------------------------------------------------------------

/** Parse one SSE `data:` payload into stream events; null = nothing to emit. */
function eventsFromPayload(payload: string): InferenceStreamEvent[] {
  if (payload === "[DONE]") return [{ type: "done", finishReason: null }];
  let chunk: unknown;
  try {
    chunk = JSON.parse(payload);
  } catch {
    return []; // keepalive/comment payloads and partial proxies: skip
  }
  const events: InferenceStreamEvent[] = [];
  const obj = chunk as {
    choices?: {
      delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null };
      finish_reason?: string | null;
    }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  };
  for (const choice of obj.choices ?? []) {
    const delta = choice.delta ?? {};
    const reasoning = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoning === "string" && reasoning.length > 0) {
      events.push({ type: "reasoning", text: reasoning });
    }
    if (typeof delta.content === "string" && delta.content.length > 0) {
      events.push({ type: "text", text: delta.content });
    }
    if (choice.finish_reason != null) {
      events.push({ type: "done", finishReason: choice.finish_reason });
    }
  }
  if (obj.usage) {
    events.push({
      type: "usage",
      inputTokens: obj.usage.prompt_tokens ?? null,
      outputTokens: obj.usage.completion_tokens ?? null,
    });
  }
  return events;
}

/** Read an SSE byte stream and yield normalized events line by line. */
export async function* parseChatCompletionStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<InferenceStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      let terminal = false;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        for (const ev of eventsFromPayload(line.slice(5).trim())) {
          yield ev;
          // [DONE] (the null-finishReason sentinel) is protocol-terminal:
          // stop reading right after it. A provider holding the stream open
          // past [DONE] must never keep the run alive.
          if (ev.type === "done" && ev.finishReason === null) terminal = true;
        }
      }
      if (terminal) break;
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      for (const ev of eventsFromPayload(tail.slice(5).trim())) yield ev;
    }
  } finally {
    // Tear the body down on every exit path — terminal sentinel, error, or
    // the consumer returning early (cooperative cancel): never leak an open
    // stream.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build the chat adapter for a resolved harness (settings + key from
 * HarnessSettingsStore.resolveForAdapter).
 */
export function createChatAdapter(opts: {
  settings: HarnessSettings;
  apiKey: string | null;
  fetchFn?: typeof fetch;
}): ChatAdapter {
  if (opts.settings.provider === "anthropic") {
    return new AnthropicAdapter(opts);
  }
  return new OpenAiCompatibleAdapter(opts);
}

