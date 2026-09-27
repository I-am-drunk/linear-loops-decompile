/**
 * HarnessBrain — the Brain implementation over the user's own inference
 * (T-1201): OpenRouter / OpenAI-compatible (LiteLLM, vLLM, Ollama) /
 * Anthropic, via R6's ChatAdapter (src/inference, verified on issue #34).
 *
 * This is backend #1 of the Brain seam (see brain.ts). It is deliberately
 * STRUCTURAL: the runtime depends on the adapter's shape, never on the
 * inference package (zero-dep rule) — the server (T-1101) binds a real
 * adapter at composition time.
 *
 * The mapping below was ratified cross-role on issue #34:
 *
 *   InferenceStreamEvent        →  runtime side
 *   reasoning { text }          →  one `thought` part per contiguous block
 *   text { text }               →  one `response` part per contiguous block
 *   usage { input, output }     →  onUsage hook (server folds it into
 *                                  runner.recordUsage) — never a part
 *   done { finishReason }       →  no part; consumption runs to the
 *                                  adapter's natural end (usage may follow
 *                                  done — the OpenAI wire order)
 *   (none in v1)                →  elicitation/action parts arrive with
 *                                  tool-calling, later
 *
 * Deltas vs parts: adapter events are token deltas; the Part model is
 * whole-parts. v1 buffers per contiguous block and yields one part per block
 * (UI live-ness comes from the run view's streaming pulse). If per-token live
 * text is wanted later, the runtime grows a `partDelta` event — not now.
 *
 * Contract rules honored (brain.ts): an elicitation never occurs here (the
 * stream just ends); cancel is cooperative — the AbortSignal passes straight
 * through to the adapter, buffered text is flushed as a final part (partial
 * work survives), and the generator returns early instead of throwing on
 * abort. Adapter failures (HTTP/auth/rate-limit) propagate and fail the run.
 *
 * Original code. SPECS/agent.md §runtime-contract is the behavior source.
 */

import type { Brain, BrainInput } from "./brain.ts";
import type { EntityId, Part, Turn } from "./types.ts";

// ---------------------------------------------------------------------------
// Structural adapter surface (mirror of src/inference adapters/types.ts —
// keep field-for-field compatible; the server binds the real one)
// ---------------------------------------------------------------------------

export type HarnessChatRole = "system" | "user" | "assistant";

export interface HarnessChatMessage {
  role: HarnessChatRole;
  content: string;
}

/** Normalized stream events (mirror of R6's InferenceStreamEvent). */
export type HarnessStreamEvent =
  | { type: "reasoning"; text: string }
  | { type: "text"; text: string }
  | { type: "usage"; inputTokens: number | null; outputTokens: number | null }
  | { type: "done"; finishReason: string | null };

export interface HarnessStreamRequest {
  messages: HarnessChatMessage[];
  /** Overrides the harness's default model for every exchange (loop pinning). */
  model?: string;
  /** Overrides the harness's default effort (mirror of R6's Effort). */
  effort?: "none" | "low" | "medium" | "high";
  /** Optional cap on completion tokens. */
  maxTokens?: number;
  /** Cooperative cancel — the runtime's AbortSignal, passed straight through. */
  signal?: AbortSignal;
}

/** The shape R6's ChatAdapter satisfies. Structural on purpose. */
export interface ChatAdapterLike {
  streamChat(
    req: HarnessStreamRequest,
  ): AsyncGenerator<HarnessStreamEvent> | AsyncIterable<HarnessStreamEvent>;
}

export interface HarnessBrainOptions {
  /**
   * Prepended as a leading system message on every exchange — the loop's
   * persona/preamble. Omit for no system message.
   */
  systemPrefix?: string;
  /** Overrides the harness's default model for every exchange (loop pinning). */
  model?: string;
  /** Overrides the harness's default effort for every exchange. */
  effort?: "none" | "low" | "medium" | "high";
  /** Optional cap on completion tokens for every exchange. */
  maxTokens?: number;
  /**
   * Usage sink. Receives DELTAS (never cumulative totals) so the server can
   * fold them straight into `runner.recordUsage(runId, delta)`, which adds.
   * Adapter usage events may be one final total or cumulative snapshots;
   * both are normalized here.
   */
  onUsage?: (
    runId: EntityId,
    delta: { inputTokens?: number; outputTokens?: number },
  ) => void;
}

// ---------------------------------------------------------------------------
// History → wire messages
// ---------------------------------------------------------------------------

/**
 * Render one history turn to wire text. Agent turns contribute `response`
 * text plus elicitation prompts (so the user's answer has context); thoughts
 * and actions are dropped from the wire (ratified on #34 — they are display
 * material, not conversation context). User turns contribute their steered
 * text. Returns null when the turn carries nothing sendable.
 */
function renderTurn(turn: Turn): string | null {
  const chunks: string[] = [];
  for (const part of turn.parts) {
    if (turn.role === "agent") {
      if (part.kind === "response") chunks.push(part.text);
      else if (part.kind === "elicitation") {
        const choices =
          part.choices && part.choices.length > 0
            ? ` (choices: ${part.choices.join(" / ")})`
            : "";
        chunks.push(`[Asked the user] ${part.prompt}${choices}`);
      }
    } else if (part.kind === "steered" || part.kind === "response") {
      chunks.push(part.text);
    }
  }
  const text = chunks.join("\n\n").trim();
  return text === "" ? null : text;
}

/** Build the chat messages for one exchange: optional system prefix, then
 * history (user→user, agent→assistant, system→system), then the message
 * this exchange answers as the final user message. */
export function toChatMessages(
  input: BrainInput,
  systemPrefix?: string,
): HarnessChatMessage[] {
  const messages: HarnessChatMessage[] = [];
  if (systemPrefix !== undefined && systemPrefix.trim() !== "") {
    messages.push({ role: "system", content: systemPrefix });
  }
  for (const turn of input.history) {
    const content = renderTurn(turn);
    if (content === null) continue;
    messages.push({
      role: turn.role === "agent" ? "assistant" : turn.role === "user" ? "user" : "system",
      content,
    });
  }
  messages.push({ role: "user", content: input.message });
  return messages;
}

// ---------------------------------------------------------------------------
// The brain
// ---------------------------------------------------------------------------

export class HarnessBrain implements Brain {
  readonly #adapter: ChatAdapterLike;
  readonly #options: HarnessBrainOptions;

  constructor(adapter: ChatAdapterLike, options?: HarnessBrainOptions) {
    this.#adapter = adapter;
    this.#options = options ?? {};
  }

  async *stream(input: BrainInput, signal: AbortSignal): AsyncIterable<Part> {
    const messages = toChatMessages(input, this.#options.systemPrefix);
    const onUsage = this.#options.onUsage;

    // Buffering state: one part per contiguous block of one event kind.
    let blockKind: "thought" | "response" | null = null;
    let buffer = "";
    const flush = (): Part | null => {
      const kind = blockKind;
      const text = buffer;
      blockKind = null;
      buffer = "";
      if (kind === null || text === "") return null;
      return kind === "thought" ? { kind: "thought", text } : { kind: "response", text };
    };

    // Usage normalization: events may be one final total (OpenAI-style) or
    // cumulative snapshots (Anthropic-style); forward only positive deltas,
    // because runner.recordUsage ADDS what it receives.
    let seenInput = 0;
    let seenOutput = 0;
    const reportUsage = (inputTokens: number | null, outputTokens: number | null): void => {
      if (onUsage === undefined) return;
      const dIn = inputTokens === null ? 0 : Math.max(0, inputTokens - seenInput);
      const dOut = outputTokens === null ? 0 : Math.max(0, outputTokens - seenOutput);
      if (inputTokens !== null) seenInput = inputTokens;
      if (outputTokens !== null) seenOutput = outputTokens;
      if (dIn === 0 && dOut === 0) return;
      const delta: { inputTokens?: number; outputTokens?: number } = {};
      if (dIn > 0) delta.inputTokens = dIn;
      if (dOut > 0) delta.outputTokens = dOut;
      onUsage(input.run.id, delta);
    };

    try {
      const req: HarnessStreamRequest = { messages, signal };
      if (this.#options.model !== undefined) req.model = this.#options.model;
      if (this.#options.effort !== undefined) req.effort = this.#options.effort;
      if (this.#options.maxTokens !== undefined) req.maxTokens = this.#options.maxTokens;
      for await (const event of this.#adapter.streamChat(req)) {
        if (event.type === "reasoning" || event.type === "text") {
          const kind = event.type === "reasoning" ? "thought" : "response";
          if (blockKind !== null && blockKind !== kind) {
            const part = flush();
            if (part !== null) yield part;
          }
          blockKind = kind;
          buffer += event.text;
        } else if (event.type === "usage") {
          reportUsage(event.inputTokens, event.outputTokens);
        } else {
          // "done" — no part (v1 ignores finishReason). Do NOT break here:
          // the OpenAI wire sends the usage chunk AFTER the finish_reason
          // chunk, so usage events legitimately follow `done`. Consume to
          // the adapter's natural end (both adapters terminate at [DONE] /
          // stream end); flush happens below, once. (Regression found by
          // the T-1105 end-to-end test: breaking on done dropped every
          // OpenAI-style usage report.)
        }
        // Cooperative cancel: stop pulling AFTER handling the event in hand —
        // a pulled delta is work already done; discarding it loses text.
        if (signal.aborted) break;
      }
    } catch (err) {
      // Cancel teardown must not throw (brain.ts: parts already yielded are
      // kept; returning early is the clean exit). Real failures propagate.
      if (signal.aborted) {
        const part = flush();
        if (part !== null) yield part;
        return;
      }
      // Hard failure: the unflushed block is discarded (parts already yielded
      // survive on the error-closed turn); the throw fails the run — honest
      // status over partial output.
      throw err;
    }
    const part = flush();
    if (part !== null) yield part;
  }

  // No `cancel(runId)`: the runtime aborts the per-exchange AbortSignal
  // itself and this brain holds no extra in-flight state to stop.
}
