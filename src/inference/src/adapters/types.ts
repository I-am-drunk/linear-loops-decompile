/**
 * Shared adapter surface for the inference package (T-603).
 *
 * Every provider adapter exposes the same three things: which provider it
 * serves, a streaming chat call yielding normalized InferenceStreamEvents,
 * and a model-list probe for the settings UI ("probe /models where
 * available" — SPECS/target-architecture.md §settings). The runtime (R5)
 * codes against this interface only; provider specifics stay inside the
 * adapters.
 */

import type { InferenceProvider } from "../settings.ts";
import type { InferenceStreamEvent, StreamChatRequest } from "./openai-compatible.ts";

/** One entry of a provider's model list. */
export interface ModelInfo {
  id: string;
  /** Human label when the provider offers one (Anthropic display_name). */
  label: string | null;
}

/** The contract R5's Brain implementation consumes. */
export interface ChatAdapter {
  readonly provider: InferenceProvider;
  streamChat(req: StreamChatRequest): AsyncGenerator<InferenceStreamEvent>;
  /** Probe the provider's model list. Throws AdapterHttpError on failure. */
  listModels(): Promise<ModelInfo[]>;
}
