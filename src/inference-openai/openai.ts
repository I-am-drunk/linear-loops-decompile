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
  redirect?: `error`;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export type OpenAiConfig = {
  id?: string;
  label?: string;
  /** Endpoint root, with or without a trailing slash. */
  baseUrl: string;
  /** Omitted for a local server that needs none. */
  apiKey?: string;
  fetchImpl: FetchLike;
  /** Override the token-cap field for a compatible gateway; see README.md. */
  tokenLimitField?: `max_tokens` | `max_completion_tokens`;
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

/** Error text a provider sent; the caller redacts it before truncating. */
function errorDetail(status: number, text: string): string {
  const body = asRecord(parse(text));
  const err = asRecord(body?.[`error`]);
  const msg = typeof err?.[`message`] === `string` ? err[`message`] : undefined;
  return `HTTP ${status}${msg ? `: ${msg}` : text ? `: ${text}` : ``}`;
}

/** Per-million-token price to integral cents, per the CostEstimate contract. */
function cents(tokens: number, perMTok: number): number {
  return Math.round((tokens / 1_000_000) * perMTok * 100);
}

export function makeOpenAiProvider(cfg: OpenAiConfig): Provider {
  const id = cfg.id ?? `openai-compatible`;
  const base = root(cfg.baseUrl);
  let endpoint: URL | undefined;
  try { endpoint = new URL(base); } catch { /* Report invalid config through call(). */ }
  // OpenAI documents max_tokens as incompatible with o-series models.
  // https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
  const tokenLimitField = cfg.tokenLimitField ?? (endpoint?.origin === `https://api.openai.com`
    && endpoint.pathname === `/v1` ? `max_completion_tokens` : `max_tokens`);
  const safeDetail = (text: string): string =>
    (cfg.apiKey ? text.replaceAll(cfg.apiKey, `[redacted]`) : text).slice(0, 200);

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
    if (!endpoint || ![`http:`, `https:`].includes(endpoint.protocol)
      || endpoint.username || endpoint.password
      || (cfg.apiKey && endpoint.protocol !== `https:`)) {
      return fail({ kind: `unconfigured`, provider: id });
    }
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await cfg.fetchImpl(`${base}${path}`, { headers: headers(), redirect: `error`, ...(init ?? {}) });
    } catch (e) {
      // DNS failure, refused connection, TLS error: the provider is not
      // reachable, which the plan requires we record rather than throw.
      return fail({ kind: `unavailable`, provider: id, detail: safeDetail(String(e)) });
    }

    let text = ``;
    try {
      text = await res.text();
    } catch (e) {
      if (res.ok) return fail({ kind: `unavailable`, provider: id, detail: safeDetail(String(e)) });
      // Preserve a known rejection even if its error body is interrupted.
    }
    if (res.ok) {
      const value = parse(text);
      return value === undefined
        ? fail({ kind: `unavailable`, provider: id, detail: `invalid JSON response` })
        : ok(value);
    }

    if (res.status === 429) {
      return fail({ kind: `rateLimited`, provider: id });
    }
    if (res.status === 401 || res.status === 403) {
      return fail({ kind: `unconfigured`, provider: id });
    }
    // 4xx is about the request; 5xx is about the provider's health. Only the
    // latter should let the registry try a fallback.
    return res.status >= 500
      ? fail({ kind: `unavailable`, provider: id, detail: safeDetail(errorDetail(res.status, text)) })
      : fail({ kind: `rejected`, provider: id, detail: safeDetail(errorDetail(res.status, text)) });
  }

  async function models(): Promise<Outcome<Model[]>> {
    const got = await call(`/models`);
    if (!got.ok) return got;
    const data = asRecord(got.value)?.[`data`];
    if (!Array.isArray(data)) {
      return fail({ kind: `unavailable`, provider: id, detail: `/models returned no data array` });
    }
    if (data.some((item) => typeof asRecord(item)?.[`id`] !== `string`)) {
      return fail({ kind: `unavailable`, provider: id, detail: `/models returned an invalid model` });
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
        };
      });
    return ok(models);
  }

  return {
    id,
    label: cfg.label ?? `OpenAI-compatible`,
    auth: `apiKeyWithBaseUrl`,
    models,

    async chat(request: ChatRequest): Promise<Outcome<ChatResult>> {
      const body = JSON.stringify({
        model: request.model,
        messages: request.messages,
        ...(request.maxTokens === undefined ? {} : { [tokenLimitField]: request.maxTokens }),
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      });
      const got = await call(`/chat/completions`, { method: `POST`, body });
      if (!got.ok) return got;

      const root_ = asRecord(got.value);
      const choice = asRecord(Array.isArray(root_?.[`choices`]) ? root_[`choices`][0] : undefined);
      const message = asRecord(choice?.[`message`]);
      const finish = choice?.[`finish_reason`];
      const toolCalls = message?.[`tool_calls`];
      // Tool fields: https://developers.openai.com/api/reference/resources/chat/subresources/completions
      // Reject before reading text: a mixed reply cannot be completed by IN1.
      if (finish === `tool_calls` || finish === `function_call`
        || (Array.isArray(toolCalls) && toolCalls.length > 0)
        || message?.[`function_call`] != null) {
        return fail({ kind: `rejected`, provider: id, detail: `tool calls are unsupported by the text-only provider contract` });
      }
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
      const stop: ChatResult[`stop`] =
        finish === `length` ? `length`
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
      const got = await models();
      return got.ok ? ok(true as const) : fail(got.error);
    },

    credential(): CredentialStatus {
      if (!cfg.apiKey) return { configured: false };
      if (cfg.apiKey.length <= 4) return { configured: true };
      // Last four only, so a log or screenshot leaks nothing usable.
      return { configured: true, hint: `…${cfg.apiKey.slice(-4)}` };
    },
  };
}
