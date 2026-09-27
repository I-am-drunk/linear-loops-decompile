/**
 * Anthropic messages-API adapter (T-603).
 *
 * What it does: POSTs `{baseUrl}/v1/messages` with `stream: true`, parses
 * the SSE event stream, and yields the SAME normalized InferenceStreamEvents
 * as the OpenAI-compatible adapter — `thinking_delta` maps to `reasoning`,
 * `text_delta` to `text`, message usage frames to `usage` (R5 maps these onto
 * thought/response parts; SPECS/agent.md).
 *
 * Wire differences from the OpenAI shape, all contained in this file:
 * - auth is `x-api-key`, not a Bearer token; every call carries
 *   `anthropic-version`.
 * - `system` messages are hoisted out of `messages` into a top-level field
 *   (the messages API has no system role).
 * - `max_tokens` is REQUIRED — we default it, and raise it above the
 *   thinking budget when effort mapping is active.
 * - normalized effort maps to a thinking budget (low/medium/high); `none`
 *   sends no thinking parameter.
 * - SSE `data:` payloads self-describe via their `type` field, so the
 *   `event:` lines are ignored. v1 sends no tool use: `input_json_delta`
 *   blocks are skipped on purpose (YAGNI).
 *
 * Cancel = pass an AbortSignal; the fetch aborts and the generator ends
 * (cooperative cancel, Brain contract). No retries here — transport only.
 */

import { AdapterHttpError, InferenceError } from "../errors.ts";
import type { Effort, HarnessSettings } from "../settings.ts";
import type {
  InferenceStreamEvent,
  StreamChatRequest,
} from "./openai-compatible.ts";
import type { ChatAdapter, ModelInfo } from "./types.ts";

/** API version header pinned for every request. */
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Default completion cap when the caller does not set one — the messages API
 * rejects requests without max_tokens. Chosen small; loops should pass one.
 */
const DEFAULT_MAX_TOKENS = 8192;

/** Normalized effort → thinking budget in tokens (`none` = no thinking). */
const THINKING_BUDGETS: Readonly<Record<Exclude<Effort, "none">, number>> = {
  low: 1024,
  medium: 4096,
  high: 16384,
};

export class AnthropicAdapter implements ChatAdapter {
  readonly provider = "anthropic" as const;
  readonly #settings: HarnessSettings;
  readonly #apiKey: string | null;
  readonly #fetch: typeof fetch;

  constructor(opts: {
    settings: HarnessSettings;
    apiKey: string | null;
    /** Injectable for tests; defaults to global fetch. */
    fetchFn?: typeof fetch;
  }) {
    if (opts.settings.provider !== "anthropic") {
      throw new InferenceError(
        `AnthropicAdapter cannot serve provider "${opts.settings.provider}"`,
      );
    }
    this.#settings = opts.settings;
    this.#apiKey = opts.apiKey;
    this.#fetch = opts.fetchFn ?? fetch;
  }

  /** Stream a messages-API completion as normalized events. */
  async *streamChat(req: StreamChatRequest): AsyncGenerator<InferenceStreamEvent> {
    const res = await this.#fetch(`${this.#settings.baseUrl}/v1/messages`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify(this.#body(req)),
      ...(req.signal ? { signal: req.signal } : {}),
    });
    if (!res.ok || res.body === null) {
      throw await AdapterHttpError.fromResponse(res, "anthropic messages call failed");
    }
    yield* parseMessagesStream(res.body);
  }

  /** Probe GET /v1/models for the settings UI's model picker. */
  async listModels(): Promise<ModelInfo[]> {
    const res = await this.#fetch(`${this.#settings.baseUrl}/v1/models?limit=1000`, {
      headers: this.#headers(),
    });
    if (!res.ok) {
      throw await AdapterHttpError.fromResponse(res, "anthropic model probe failed");
    }
    const body = (await res.json()) as {
      data?: { id?: unknown; display_name?: unknown }[];
    };
    // Deeper pages exist beyond `has_more`; the first page (≤1000) is enough
    // for a picker — YAGNI.
    return (body.data ?? [])
      .filter((m) => typeof m.id === "string")
      .map((m) => ({
        id: m.id as string,
        label: typeof m.display_name === "string" ? m.display_name : null,
      }));
  }

  #headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.#settings.extraHeaders,
    };
    // Set after extraHeaders so a stray user header cannot shadow auth.
    headers["anthropic-version"] = ANTHROPIC_VERSION;
    if (this.#apiKey !== null) headers["x-api-key"] = this.#apiKey;
    return headers;
  }

  #body(req: StreamChatRequest): Record<string, unknown> {
    const effort = req.effort ?? this.#settings.effort;
    const system = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const messages = req.messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: req.model ?? this.#settings.model,
      messages,
      stream: true,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
    if (system.length > 0) body.system = system;
    if (effort !== "none") {
      const budget = THINKING_BUDGETS[effort];
      body.thinking = { type: "enabled", budget_tokens: budget };
      // The API requires max_tokens to exceed the thinking budget.
      if ((body.max_tokens as number) <= budget) body.max_tokens = budget + 1024;
    }
    return body;
  }
}

// ---------------------------------------------------------------------------
// SSE parsing (messages-API wire format)
// ---------------------------------------------------------------------------

/** Parse one SSE `data:` payload into stream events; empty = nothing to emit. */
function eventsFromPayload(payload: string, state: { doneSent: boolean }): InferenceStreamEvent[] {
  let msg: unknown;
  try {
    msg = JSON.parse(payload);
  } catch {
    return []; // keepalives / partial proxies: skip
  }
  const obj = msg as {
    type?: string;
    delta?: { type?: string; text?: string; thinking?: string; stop_reason?: string | null };
    message?: { usage?: { input_tokens?: number } };
    usage?: { output_tokens?: number };
    error?: { type?: string; message?: string };
  };
  switch (obj.type) {
    case "message_start":
      return [
        { type: "usage", inputTokens: obj.message?.usage?.input_tokens ?? null, outputTokens: null },
      ];
    case "content_block_delta": {
      const d = obj.delta ?? {};
      if (d.type === "thinking_delta" && typeof d.thinking === "string" && d.thinking) {
        return [{ type: "reasoning", text: d.thinking }];
      }
      if (d.type === "text_delta" && typeof d.text === "string" && d.text) {
        return [{ type: "text", text: d.text }];
      }
      return []; // input_json_delta (tool use) — out of v1 scope
    }
    case "message_delta": {
      const events: InferenceStreamEvent[] = [];
      if (obj.usage?.output_tokens !== undefined) {
        events.push({ type: "usage", inputTokens: null, outputTokens: obj.usage.output_tokens });
      }
      const reason = obj.delta?.stop_reason ?? null;
      if (reason !== null && !state.doneSent) {
        state.doneSent = true;
        events.push({ type: "done", finishReason: reason });
      }
      return events;
    }
    case "message_stop":
      if (!state.doneSent) {
        state.doneSent = true;
        return [{ type: "done", finishReason: null }];
      }
      return [];
    case "error":
      throw new InferenceError(
        `anthropic stream error: ${obj.error?.type ?? "unknown"} — ${obj.error?.message ?? "no detail"}`,
      );
    default:
      return []; // ping, content_block_start/stop, unknowns
  }
}

/**
 * Read an SSE byte stream and yield normalized events. Self-contained copy
 * of the line-splitting approach in openai-compatible.ts (mid-line chunk
 * splits are the case that matters); keep the two in step if one changes.
 */
export async function* parseMessagesStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<InferenceStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const state = { doneSent: false };
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
        for (const ev of eventsFromPayload(line.slice(5).trim(), state)) {
          yield ev;
          // message_stop is protocol-terminal — stop reading right after
          // it so a held-open stream can never keep the run alive.
          if (ev.type === "done") terminal = true;
        }
      }
      if (terminal) break;
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      for (const ev of eventsFromPayload(tail.slice(5).trim(), state)) yield ev;
    }
  } finally {
    // Tear the body down on every exit path (terminal event, error, early
    // consumer return) — never leak an open stream.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
