/**
 * Anthropic provider (IN3, docs/plan/inference.md).
 *
 * Same shape as src/inference-openai on purpose — injected fetch, the same
 * status -> ProviderFailure table — so a reader of one knows the other. The
 * real differences are wire-format: `system` is a top-level field rather
 * than a message role, auth is an `x-api-key` header rather than a bearer,
 * and the API requires an `anthropic-version` header.
 *
 * Model listing uses GET /v1/models. No streaming yet; the contract allows
 * adding it without changing callers.
 */

import {
  fail,
  ok,
  type ChatRequest,
  type ChatResult,
  type CostEstimate,
  type CredentialStatus,
  type Message,
  type Model,
  type ModelId,
  type Outcome,
  type Provider,
  type Usage,
} from "../inference/types.ts";
import type { FetchLike } from "../inference-openai/openai.ts";

export const ANTHROPIC_VERSION = `2023-06-01`;

export type AnthropicConfig = {
  id?: string;
  label?: string;
  /** Defaults to the public API root. */
  baseUrl?: string;
  apiKey?: string;
  fetchImpl: FetchLike;
  /** Price per million tokens, when the operator knows it. */
  pricing?: Record<ModelId, { inputPerMTok: number; outputPerMTok: number }>;
};

const root = (baseUrl: string): string => baseUrl.replace(/\/+$/, ``);

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === `object` && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

function errorDetail(status: number, text: string): string {
  const err = asRecord(asRecord(parse(text))?.[`error`]);
  const msg = typeof err?.[`message`] === `string` ? err[`message`] : undefined;
  return `HTTP ${status}${msg ? `: ${msg}` : text ? `: ${text.slice(0, 200)}` : ``}`;
}

const cents = (tokens: number, perMTok: number): number =>
  Math.round((tokens / 1_000_000) * perMTok * 100);

export function makeAnthropicProvider(cfg: AnthropicConfig): Provider {
  const id = cfg.id ?? `anthropic`;
  const base = root(cfg.baseUrl ?? `https://api.anthropic.com`);

  const headers = (): Record<string, string> => ({
    "content-type": `application/json`,
    "anthropic-version": ANTHROPIC_VERSION,
    // x-api-key, not a bearer. Omitted entirely when absent rather than sent
    // empty, for the same reason as IN2: some servers 401 on an empty header.
    ...(cfg.apiKey ? { "x-api-key": cfg.apiKey } : {}),
  });

  /** One request; network faults and HTTP statuses become typed failures. */
  async function call(path: string, init?: { method: string; body: string }): Promise<Outcome<unknown>> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await cfg.fetchImpl(`${base}${path}`, { headers: headers(), ...(init ?? {}) });
    } catch (e) {
      return fail({ kind: `unavailable`, provider: id, detail: String(e) });
    }
    const text = await res.text();
    if (res.ok) return ok(parse(text));
    if (res.status === 429) return fail({ kind: `rateLimited`, provider: id });
    if (res.status === 401 || res.status === 403) return fail({ kind: `unconfigured`, provider: id });
    // Same split as IN2: 4xx is about the request (no fallback), 5xx about
    // the provider's health (fallback allowed). Anthropic also uses 529 for
    // overloaded, which is >= 500 and so correctly lands in unavailable.
    return res.status >= 500
      ? fail({ kind: `unavailable`, provider: id, detail: errorDetail(res.status, text) })
      : fail({ kind: `rejected`, provider: id, detail: errorDetail(res.status, text) });
  }

  const priceFor = (model: ModelId) => cfg.pricing?.[model];

  const costOf = (model: ModelId, usage: Usage): CostEstimate => {
    const p = priceFor(model);
    if (!p) return { cents: 0, known: false };
    return {
      cents: cents(usage.inputTokens, p.inputPerMTok) + cents(usage.outputTokens, p.outputPerMTok),
      known: true,
    };
  };

  /**
   * The one real wire difference: Anthropic takes `system` as a top-level
   * string, not a message role. A system message left in the list is a 400.
   * Multiple system messages are joined with blank lines, in order.
   */
  function splitSystem(messages: readonly Message[]): { system?: string; messages: Message[] } {
    const sys = messages.filter((m) => m.role === `system`).map((m) => m.content);
    const rest = messages.filter((m) => m.role !== `system`);
    return sys.length === 0 ? { messages: rest } : { system: sys.join(`\n\n`), messages: rest };
  }

  return {
    id,
    label: cfg.label ?? `Anthropic`,
    auth: `apiKey`,

    async models(): Promise<Outcome<Model[]>> {
      const got = await call(`/v1/models`);
      if (!got.ok) return got;
      const data = asRecord(got.value)?.[`data`];
      if (!Array.isArray(data)) {
        return fail({ kind: `rejected`, provider: id, detail: `/v1/models returned no data array` });
      }
      const models = data
        .map(asRecord)
        .filter((m): m is Record<string, unknown> => typeof m?.[`id`] === `string`)
        .map((m) => ({
          id: m[`id`] as string,
          label: typeof m[`display_name`] === `string` ? (m[`display_name`] as string) : (m[`id`] as string),
        }));
      return ok(models);
    },

    async chat(request: ChatRequest): Promise<Outcome<ChatResult>> {
      const { system, messages } = splitSystem(request.messages);
      const body = JSON.stringify({
        model: request.model,
        // max_tokens is REQUIRED by the Messages API, not optional as in
        // OpenAI's. A caller that omits it gets a sane cap, not a 400.
        max_tokens: request.maxTokens ?? 1024,
        messages,
        ...(system === undefined ? {} : { system }),
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      });
      const got = await call(`/v1/messages`, { method: `POST`, body });
      if (!got.ok) return got;

      const root_ = asRecord(got.value);
      const content = Array.isArray(root_?.[`content`]) ? root_[`content`] : [];
      const reason = root_?.[`stop_reason`];
      // https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
      // A mixed text/tool reply still requires a tool turn that IN1 cannot carry.
      if (reason === `tool_use` || content.some((value) => {
        const type = asRecord(value)?.[`type`];
        return type === `tool_use` || type === `server_tool_use`;
      })) {
        return fail({ kind: `rejected`, provider: id, detail: `tool calls are unsupported by the text-only provider contract` });
      }
      // Content is a list of blocks; concatenate the text ones. A reply with
      // no text block is a rejection, not a crash on undefined.
      const text = content
        .map(asRecord)
        .filter((b): b is Record<string, unknown> => b?.[`type`] === `text` && typeof b[`text`] === `string`)
        .map((b) => b[`text`] as string)
        .join(``);
      if (text === `` && content.length === 0) {
        return fail({ kind: `rejected`, provider: id, detail: `no content blocks in response` });
      }

      const u = asRecord(root_?.[`usage`]);
      const num = (v: unknown): number => (typeof v === `number` ? v : 0);
      const usage: Usage = { inputTokens: num(u?.[`input_tokens`]), outputTokens: num(u?.[`output_tokens`]) };

      // Anthropic's names differ from OpenAI's; map onto the shared enum so
      // callers never see a vendor string. `max_tokens` is the truncation.
      const stop: ChatResult[`stop`] =
        reason === `max_tokens` ? `length`
          : reason === `refusal` ? `refusal`
            : `end`;
      return ok({ content: text, usage, stop });
    },

    estimate(request: ChatRequest): CostEstimate {
      const p = priceFor(request.model);
      if (!p) return { cents: 0, known: false };
      const chars = request.messages.reduce((n, m) => n + m.content.length, 0);
      const inputTokens = Math.ceil(chars / 4);
      const outputTokens = request.maxTokens ?? 1024;
      return { cents: cents(inputTokens, p.inputPerMTok) + cents(outputTokens, p.outputPerMTok), known: true };
    },

    cost: costOf,

    async reachable(): Promise<Outcome<true>> {
      const got = await call(`/v1/models`);
      return got.ok ? ok(true as const) : fail(got.error);
    },

    credential(): CredentialStatus {
      if (!cfg.apiKey) return { configured: false };
      return { configured: true, hint: `…${cfg.apiKey.slice(-4)}` };
    },
  };
}
