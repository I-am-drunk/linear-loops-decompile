/**
 * The provider interface (IN1, docs/plan/inference.md).
 *
 * An automation needs a model. Which model, from where, is configurable, and
 * T3 Code Connect is a first-class option rather than a special case — so the
 * registry knows nothing about any particular provider.
 *
 * A provider supplies three things and nothing else: the models it offers, a
 * chat call, and a cost estimate. Everything provider-specific (pairing,
 * API keys, base URLs) is held by each adapter; callers see credential status.
 * This initial contract is text-only. Tool turns and streaming require
 * matching request, response and adapter support before they are advertised.
 */

/** How an adapter authenticates; external protocol compatibility is separate. */
export type AuthKind = `pairing` | `apiKey` | `apiKeyWithBaseUrl` | `baseUrl`;

export type ProviderId = string;

export type ModelId = string;

export type Model = {
  id: ModelId;
  /** Human label for the settings UI. */
  label: string;
  /** Maximum context in tokens, when the provider declares one. */
  contextTokens?: number;
};

export type Message = {
  role: `system` | `user` | `assistant`;
  content: string;
};

export type ChatRequest = {
  model: ModelId;
  messages: Message[];
  /** Upper bound on generated tokens; the provider may cap it lower. */
  maxTokens?: number;
  temperature?: number;
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
};

export type ChatResult = {
  content: string;
  usage: Usage;
  /** Why generation stopped. `length` means the cap was hit. */
  stop: `end` | `length` | `refusal`;
};

/** Cost in cents, kept integral — floats accumulate error across a run. */
export type CostEstimate = {
  cents: number;
  /** False when the provider publishes no price for this model. */
  known: boolean;
};

/**
 * Why a provider could not serve a request.
 *
 * `unavailable` is load-bearing: the plan requires that a provider which is
 * unreachable when an automation fires does NOT silently skip the run. The
 * run records it with the provider named, so this is a value, not an
 * exception — exceptions get swallowed, values get written down.
 */
export type ProviderFailure =
  | { kind: `unavailable`; provider: ProviderId; detail: string }
  | { kind: `unconfigured`; provider: ProviderId }
  | { kind: `unknownModel`; provider: ProviderId; model: ModelId }
  | { kind: `rateLimited`; provider: ProviderId; retryAfterMs?: number }
  | { kind: `rejected`; provider: ProviderId; detail: string };

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: ProviderFailure };

export const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
export const fail = <T>(error: ProviderFailure): Outcome<T> => ({ ok: false, error });

/** Credential presence as the API may report it: never the value itself. */
export type CredentialStatus = {
  configured: boolean;
  /** A masked tail such as `…4f2a`, for recognition only. */
  hint?: string;
};

export type Provider = {
  id: ProviderId;
  label: string;
  auth: AuthKind;

  /** Models this provider currently offers. May hit the network. */
  models(): Promise<Outcome<Model[]>>;

  chat(request: ChatRequest): Promise<Outcome<ChatResult>>;

  /** Pre-call estimate. Must not hit the network. */
  estimate(request: ChatRequest): CostEstimate;

  /** Post-call actual, from real usage. Must not hit the network. */
  cost(model: ModelId, usage: Usage): CostEstimate;

  /** Can it serve requests right now? */
  reachable(): Promise<Outcome<true>>;

  /** Presence of credentials, never their values. */
  credential(): CredentialStatus;
};
