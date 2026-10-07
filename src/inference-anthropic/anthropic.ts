/**
 * Anthropic provider (IN3, docs/plan/inference.md).
 *
 * Same shape as src/inference-openai on purpose — injected fetch, the same
 * status -> ProviderFailure table — so a reader of one knows the other. The
 * real differences are wire-format: `system` is a top-level field rather
 * than a message role, auth is an `x-api-key` header rather than a bearer,
 * and the API requires an `anthropic-version` header.
 *
 * Model listing uses GET /v1/models. This implements IN1's text-only,
 * non-streaming contract; protocol sources and limits are in README.md.
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
  /** Total operation deadline, including response bodies and model pages. */
  timeoutMs?: number;
  /** Price per million tokens, when the operator knows it. */
  pricing?: Record<ModelId, { inputPerMTok: number; outputPerMTok: number }>;
};

const root = (baseUrl: string): string => baseUrl.replace(/\/+$/, ``);
const isTokenCount = (value: unknown): value is number =>
  typeof value === `number` && Number.isSafeInteger(value) && value >= 0;

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
  return `HTTP ${status}${msg ? `: ${msg}` : text ? `: ${text}` : ``}`;
}

const cents = (tokens: number, perMTok: number): number =>
  Math.round((tokens / 1_000_000) * perMTok * 100);

export function makeAnthropicProvider(cfg: AnthropicConfig): Provider {
  const id = cfg.id ?? `anthropic`;
  const base = root(cfg.baseUrl ?? `https://api.anthropic.com`);
  const timeoutMs = cfg.timeoutMs === undefined ? 120_000 : cfg.timeoutMs;
  let endpoint: URL | undefined;
  try { endpoint = new URL(base); } catch { /* Report invalid config through call(). */ }
  const safeDetail = (text: string): string =>
    (cfg.apiKey ? text.replaceAll(cfg.apiKey, `[redacted]`) : text).slice(0, 200);

  const headers = (): Record<string, string> => ({
    "content-type": `application/json`,
    "anthropic-version": ANTHROPIC_VERSION,
    // x-api-key, not a bearer. Omitted entirely when absent rather than sent
    // empty, for the same reason as IN2: some servers 401 on an empty header.
    ...(cfg.apiKey ? { "x-api-key": cfg.apiKey } : {}),
  });

  /** One request; all model pages share the same monotonic deadline. */
  async function call(
    path: string,
    init?: { method: string; body: string },
    expiresAt = performance.now() + timeoutMs,
  ): Promise<Outcome<unknown>> {
    if (!endpoint || ![`http:`, `https:`].includes(endpoint.protocol)
      || endpoint.username || endpoint.password
      || endpoint.search || endpoint.hash
      || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647
      || (cfg.apiKey && endpoint.protocol !== `https:`)) {
      return fail({ kind: `unconfigured`, provider: id });
    }
    const deadlineError = () => new Error(`request deadline exceeded after ${timeoutMs}ms`);
    const remainingMs = expiresAt - performance.now();
    if (remainingMs <= 0) {
      return fail({ kind: `unavailable`, provider: id, detail: deadlineError().message });
    }
    const controller = new AbortController();
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      deadlineTimer = setTimeout(() => {
        const error = deadlineError();
        controller.abort(error);
        reject(error);
      }, remainingMs);
    });
    try {
      let res: Awaited<ReturnType<FetchLike>>;
      try {
        res = await Promise.race([
          cfg.fetchImpl(`${base}${path}`, { headers: headers(), redirect: `error`, signal: controller.signal, ...(init ?? {}) }),
          deadline,
        ]);
      } catch (e) {
        return fail({ kind: `unavailable`, provider: id, detail: safeDetail(String(e)) });
      }
      let text = ``;
      try {
        text = await Promise.race([res.text(), deadline]);
      } catch (e) {
        if (res.ok) return fail({ kind: `unavailable`, provider: id, detail: safeDetail(String(e)) });
        // Keep a known rejection when only its error body is interrupted.
      }
      if (res.ok) {
        const value = parse(text);
        return value === undefined
          ? fail({ kind: `unavailable`, provider: id, detail: `invalid JSON response` })
          : ok(value);
      }
      if (res.status === 429) return fail({ kind: `rateLimited`, provider: id });
      if (res.status === 401 || res.status === 403) return fail({ kind: `unconfigured`, provider: id });
      // Same split as IN2: 4xx is about the request (no fallback), 5xx about
      // the provider's health (fallback allowed). This includes 529 overloaded.
      return res.status >= 500
        ? fail({ kind: `unavailable`, provider: id, detail: safeDetail(errorDetail(res.status, text)) })
        : fail({ kind: `rejected`, provider: id, detail: safeDetail(errorDetail(res.status, text)) });
    } finally {
      clearTimeout(deadlineTimer);
    }
  }

  const priceFor = (model: ModelId) => cfg.pricing?.[model];

  const costOf = (model: ModelId, usage: Usage): CostEstimate => {
    if (usage.known === false || !isTokenCount(usage.inputTokens) || !isTokenCount(usage.outputTokens)) {
      return { cents: 0, known: false };
    }
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

  async function models(): Promise<Outcome<Model[]>> {
    const listed: Model[] = [];
    const cursors = new Set<string>();
    const expiresAt = performance.now() + timeoutMs;
    let path = `/v1/models`;
    while (true) {
      const got = await call(path, undefined, expiresAt);
      if (!got.ok) return got;
      const page = asRecord(got.value);
      const data = page?.[`data`];
      if (!Array.isArray(data)) {
        return fail({ kind: `unavailable`, provider: id, detail: `/v1/models returned no data array` });
      }
      if (data.some((item) => typeof asRecord(item)?.[`id`] !== `string`)) {
        return fail({ kind: `unavailable`, provider: id, detail: `/v1/models returned an invalid model` });
      }
      listed.push(...data
        .map(asRecord)
        .filter((m): m is Record<string, unknown> => typeof m?.[`id`] === `string`)
        .map((m) => ({
          id: m[`id`] as string,
          label: typeof m[`display_name`] === `string` ? (m[`display_name`] as string) : (m[`id`] as string),
        })));
      // https://platform.claude.com/docs/en/api/models/list
      const hasMore = page?.[`has_more`];
      if (hasMore !== undefined && typeof hasMore !== `boolean`) {
        return fail({ kind: `unavailable`, provider: id, detail: `/v1/models returned invalid pagination` });
      }
      if (!hasMore) return ok(listed);
      const cursor = page?.[`last_id`];
      if (typeof cursor !== `string` || !cursor || cursors.has(cursor) || data.length === 0) {
        return fail({ kind: `unavailable`, provider: id, detail: `/v1/models returned invalid pagination` });
      }
      cursors.add(cursor);
      try {
        path = `/v1/models?after_id=${encodeURIComponent(cursor)}`;
      } catch {
        return fail({ kind: `unavailable`, provider: id, detail: `/v1/models returned an invalid cursor` });
      }
    }
  }

  return {
    id,
    label: cfg.label ?? `Anthropic`,
    auth: `apiKey`,
    models,

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
      // Stop reasons: https://platform.claude.com/docs/en/api/messages/create
      // A paused turn needs continuation that this text-only adapter cannot do.
      const stop: ChatResult[`stop`] | undefined =
        reason === `end_turn` || reason === `stop_sequence` ? `end`
          : reason === `max_tokens` || reason === `model_context_window_exceeded` ? `length`
            : reason === `refusal` ? `refusal`
              : undefined;
      if (stop === undefined) {
        return fail({ kind: `rejected`, provider: id, detail: `unsupported or missing stop reason` });
      }

      const blocks = content.map(asRecord);
      if (blocks.some((b) => !b || (b[`type`] === `text`
        ? typeof b[`text`] !== `string`
        : b[`type`] !== `thinking` && b[`type`] !== `redacted_thinking`))) {
        return fail({ kind: `rejected`, provider: id, detail: `unsupported or invalid content block` });
      }
      const textBlocks = blocks
        .filter((b): b is Record<string, unknown> => b?.[`type`] === `text` && typeof b[`text`] === `string`);
      if (textBlocks.length === 0) {
        return fail({ kind: `rejected`, provider: id, detail: `no text content in response` });
      }
      const text = textBlocks.map((b) => b[`text`] as string).join(``);

      const u = asRecord(root_?.[`usage`]);
      const input = u?.[`input_tokens`];
      const output = u?.[`output_tokens`];
      // Cache categories have separate rates; the two-rate contract cannot
      // report a known cost when they are used (README's prompt-caching source).
      const cacheUsage = [u?.[`cache_creation_input_tokens`], u?.[`cache_read_input_tokens`]]
        .some((value) => value != null && value !== 0);
      const usage: Usage = {
        inputTokens: isTokenCount(input) ? input : 0,
        outputTokens: isTokenCount(output) ? output : 0,
        ...(!isTokenCount(input) || !isTokenCount(output) || cacheUsage ? { known: false } : {}),
      };
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
      const got = await models();
      return got.ok ? ok(true as const) : fail(got.error);
    },

    credential(): CredentialStatus {
      if (!cfg.apiKey) return { configured: false };
      if (cfg.apiKey.length <= 4) return { configured: true };
      return { configured: true, hint: `…${cfg.apiKey.slice(-4)}` };
    },
  };
}
