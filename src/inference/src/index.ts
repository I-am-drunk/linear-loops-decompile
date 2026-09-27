/**
 * src/inference — inference harness settings, provider adapters, usage
 * counters (T-601 settings/secrets · T-602 OpenAI-compatible · T-603
 * Anthropic adapter + model probes + usage).
 *
 * Public surface. Note what is intentionally absent: any way to read back a
 * stored API key. Secrets go in write-only; only resolveForAdapter (marked
 * @internal, used by adapter code paths) can decrypt one for a provider call.
 */

export {
  PROVIDERS,
  InferenceProviderSchema,
  DEFAULT_BASE_URLS,
  EFFORT_LEVELS,
  EffortSchema,
  DEFAULT_EFFORT,
  BaseUrlSchema,
  HeaderNameSchema,
  ExtraHeadersSchema,
  HarnessNameSchema,
  ModelIdSchema,
  HarnessSettingsSchema,
  PublicHarnessSchema,
  CreateHarnessInputSchema,
  UpdateHarnessInputSchema,
  checkHttpPolicy,
  formatZodIssues,
  type InferenceProvider,
  type Effort,
  type HarnessSettings,
  type PublicHarness,
  type CreateHarnessInput,
  type UpdateHarnessInput,
} from "./settings.ts";

export {
  InferenceError,
  SettingsValidationError,
  HarnessNotFoundError,
  SecretNotFoundError,
  SecretUndecryptableError,
  AdapterHttpError,
} from "./errors.ts";

export {
  OpenAiCompatibleAdapter,
  createChatAdapter,
  parseChatCompletionStream,
  OPENAI_COMPATIBLE_PROVIDERS,
  type ChatMessage,
  type ChatRole,
  type StreamChatRequest,
  type InferenceStreamEvent,
  type OpenAiCompatibleProvider,
} from "./adapters/openai-compatible.ts";

export {
  AnthropicAdapter,
  parseMessagesStream,
} from "./adapters/anthropic.ts";

export type { ChatAdapter, ModelInfo } from "./adapters/types.ts";

export {
  UsageLedger,
  createUsageTotals,
  trackUsage,
  type UsageTotals,
  type UsageSummary,
} from "./usage.ts";

export { SqliteSecretStore, loadMasterKey, type SecretStore } from "./secrets.ts";

export { HarnessSettingsStore } from "./store.ts";

