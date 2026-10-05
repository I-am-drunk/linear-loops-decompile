/**
 * OpenAI-compatible provider (IN2, docs/plan/inference.md).
 *
 * One adapter covers OpenRouter, LiteLLM, vLLM, together and local servers,
 * because they all speak the same two endpoints. That is why this is the
 * slice that makes the lane real: one key and the registry has something to
 * resolve to.
 *
 * `fetch` is injected, so every path here — including the failure paths that
 * matter most — is testable without a network.
 */

import {
  fail,
  ok,
  type ChatRequest,
  type ChatResult,
  type CostEstimate,
  type CredentialStatus,
  type Model,
  type ModelId,
  type Outcome,
  type Provider,
  type Usage,
} from "../inference/types.ts";

export type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type OpenAiConfig = {
  id?: string;
  label?: string;
  /** Endpoint root, with or without a trailing slash. */
  baseUrl: string;
  /** Omitted for a local server that needs none. */
  apiKey?: string;
  fetchImpl: FetchLike;
  /** Price per million tokens, when the operator knows it. */
  pricing?: Record<ModelId, { inputPerMTok: number; outputPerMTok: number }>;
};

/** Trailing slashes here produce `//models`, which some gateways 404. */
const root = (baseUrl: string): string => baseUrl.replace(/\/+$/, ``);

/**
 * Parse JSON without throwing into the caller.
 *
 * A gateway behind a proxy returns HTML on error more often than it returns
 * JSON, and a thrown SyntaxError here would surface as an unhandled rejection
 * rather than a `ProviderFailure` the run record can name.
 */
function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === `object` && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

/** Error text a provider sent, trimmed to something a log can hold. */
function errorDetail(status: number, text: string): string {
  const body = asRecord(parse(text));
  const err = asRecord(body?.[`error`]);
  const msg = typeof err?.[`message`] === `string` ? err[`message`] : undefined;
  return `HTTP ${status}${msg ? `: ${msg}` : text ? `: ${text.slice(0, 200)}` : ``}`;
}

/** Per-million-token price to integral cents, per the CostEstimate contract. */
function cents(tokens: number, perMTok: number): number {
  return Math.round((tokens / 1_000_000) * perMTok * 100);
}

export function makeOpenAiProvider(cfg: OpenAiConfig): Provider {
  const id = cfg.id ?? `openai-compatible`;
  const base = root(cfg.baseUrl);

  const headers = (): Record<string, string> => ({
    "content-type": `application/json`,
    // A local server may legitimately need no key, so an empty bearer is
    // omitted rather than sent — some servers 401 on `Bearer `.
    ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
  });

  const priceFor = (model: ModelId): { inputPerMTok: number; outputPerMTok: number } | undefined =>
    cfg.pricing?.[model];

  const costOf = (model: ModelId, usage: Usage): CostEstimate => {
    const p = priceFor(model);
    if (!p) return { cents: 0, known: false };
    return {
      cents: cents(usage.inputTokens, p.inputPerMTok) + cents(usage.outputTokens, p.outputPerMTok),
      known: true,
    };
  };

  /** One request, with network faults turned into typed failures. */
  async function call(path: string, init?: { method: string; body: string }): Promise<Outcome<unknown>> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await cfg.fetchImpl(`${base}${path}`, { headers: headers(), ...(init ?? {}) });
    } catch (e) {
      // DNS failure, refused connection, TLS error: the provider is not
      // reachable, which the plan requires we record rather than throw.
      return fail({ kind: `unavailable`, provider: id, detail: String(e) });
    }

    const text = await res.text();
    if (res.ok) return ok(parse(text));

    if (res.status === 429) {
      return fail({ kind: `rateLimited`, provider: id });
    }
    if (res.status === 401 || res.status === 403) {
      return fail({ kind: `unconfigured`, provider: id });
    }
    // 4xx is about the request; 5xx is about the provider's health. Only the
    // latter should let the registry try a fallback.
    return res.status >= 500
      ? fail({ kind: `unavailable`, provider: id, detail: errorDetail(res.status, text) })
      : fail({ kind: `rejected`, provider: id, detail: errorDetail(res.status, text) });
  }

  return {
    id,
    label: cfg.label ?? `OpenAI-compatible`,
    auth: `apiKeyWithBaseUrl`,

    async models(): Promise<Outcome<Model[]>> {
      const got = await call(`/models`);
      if (!got.ok) return got;
      const data = asRecord(got.value)?.[`data`];
      if (!Array.isArray(data)) {
        return fail({ kind: `rejected`, provider: id, detail: `/models returned no data array` });
      }
      const models = data
        .map(asRecord)
        .filter((m): m is Record<string, unknown> => typeof m?.[`id`] === `string`)
        .map((m) => {
          const mid = m[`id`] as string;
          const ctx = m[`context_length`];
          return {
            id: mid,
            label: mid,
            ...(typeof ctx === `number` ? { contextTokens: ctx } : {}),
            // The wire format does not declare tool support, so claiming it
            // either way would be inventing a fact. Assume none.
            tools: false,
          };
        });
      return ok(models);
    },

    async chat(request: ChatRequest): Promise<Outcome<ChatResult>> {
      const body = JSON.stringify({
        model: request.model,
        messages: request.messages,
        ...(request.maxTokens === undefined ? {} : { max_tokens: request.maxTokens }),
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      });
      const got = await call(`/chat/completions`, { method: `POST`, body });
      if (!got.ok) return got;

      const root_ = asRecord(got.value);
      const choice = asRecord(Array.isArray(root_?.[`choices`]) ? root_[`choices`][0] : undefined);
      const message = asRecord(choice?.[`message`]);
      const content = message?.[`content`];
      if (typeof content !== `string`) {
        return fail({ kind: `rejected`, provider: id, detail: `no message content in response` });
      }

      const u = asRecord(root_?.[`usage`]);
      const num = (v: unknown): number => (typeof v === `number` ? v : 0);
      const usage: Usage = {
        inputTokens: num(u?.[`prompt_tokens`]),
        outputTokens: num(u?.[`completion_tokens`]),
      };

      // `length` means the cap truncated the answer; a caller that treats it
      // as a complete response ships a half sentence to the user.
      const finish = choice?.[`finish_reason`];
      const stop: ChatResult[`stop`] =
        finish === `length` ? `length`
          : finish === `tool_calls` ? `tool`
            : finish === `content_filter` ? `refusal`
              : `end`;

      return ok({ content, usage, stop });
    },

    estimate(request: ChatRequest): CostEstimate {
      const p = priceFor(request.model);
      if (!p) return { cents: 0, known: false };
      // ~4 chars per token is the usual rough figure. Deliberately an
      // estimate: the contract forbids a network call here, so an exact
      // count is not available.
      const chars = request.messages.reduce((n, m) => n + m.content.length, 0);
      const inputTokens = Math.ceil(chars / 4);
      const outputTokens = request.maxTokens ?? 0;
      return {
        cents: cents(inputTokens, p.inputPerMTok) + cents(outputTokens, p.outputPerMTok),
        known: true,
      };
    },

    cost: costOf,

    async reachable(): Promise<Outcome<true>> {
      const got = await call(`/models`);
      return got.ok ? ok(true as const) : fail(got.error);
    },

    credential(): CredentialStatus {
      if (!cfg.apiKey) return { configured: false };
      // Last four only, so a log or screenshot leaks nothing usable.
      return { configured: true, hint: `…${cfg.apiKey.slice(-4)}` };
    },
  };
}
