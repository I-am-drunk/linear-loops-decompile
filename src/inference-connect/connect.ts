/**
 * T3 Code Connect provider (IN4, docs/plan/inference.md).
 *
 * First-class, not a fallback. Pairing-based rather than key-based: the
 * server pairs with a Code Connect environment and holds a scoped session
 * token, so no long-lived API key sits in our database.
 *
 * The channel is wss: ONLY. The transport sends the token in its first
 * frame after the socket opens, so a ws: URL would put it on the wire in
 * cleartext. This adapter REFUSES a non-TLS URL rather than warning — same
 * posture as the MCP destination kernel.
 *
 * The channel is injected behind a four-method interface, so every path is
 * testable without a socket, and the real RpcClient satisfies it as-is.
 */

import {
  fail, ok,
  type ChatRequest, type ChatResult, type CostEstimate, type CredentialStatus,
  type Model, type ModelId, type Outcome, type Provider, type Usage,
} from "../inference/types.ts";

/** What we need from src/connect's RpcClient, structurally. */
export type Channel = {
  call<T = unknown>(method: string, params?: unknown): Promise<T>;
  close(): void;
};

/** Opens a channel. The real one is `RpcClient.connect(url, token)`. */
export type Dial = (url: string, token: string) => Promise<Channel>;

export type ConnectConfig = {
  id?: string;
  label?: string;
  /** Environment label shown in settings. */
  environment?: string;
  /** Must be wss:. Anything else is refused at construction. */
  url: string;
  /** The scoped session token from pairing; absent until paired. */
  token?: string;
  dial: Dial;
  pricing?: Record<ModelId, { inputPerMTok: number; outputPerMTok: number }>;
};

/** The TLS rule as a pure predicate, so a settings form can refuse early too. */
export function isSecureChannelUrl(url: string): boolean {
  try {
    return new URL(url).protocol === `wss:`;
  } catch {
    return false;
  }
}

export function makeConnectProvider(cfg: ConnectConfig): Provider {
  const id = cfg.id ?? `t3-connect`;

  // REFUSE, do not warn. The transport sends the token in its first frame
  // after the socket opens, so a ws: URL would put it on the wire in
  // cleartext. Construction is the earliest point we can stop that.
  if (!isSecureChannelUrl(cfg.url)) {
    throw new Error(`inference-connect: channel URL must be wss:, got ${cfg.url}`);
  }

  let channel: Channel | undefined;

  /** Dial once, reuse; a dropped channel is re-dialled on the next call. */
  async function acquire(): Promise<Outcome<Channel>> {
    if (channel) return ok(channel);
    if (!cfg.token) return fail({ kind: `unconfigured`, provider: id });
    try {
      channel = await cfg.dial(cfg.url, cfg.token);
      return ok(channel);
    } catch (e) {
      return fail({ kind: `unavailable`, provider: id, detail: String(e) });
    }
  }

  /**
   * The channel rejects with an Error carrying the server's RpcErrorCode.
   * Map onto the shared failure kinds with the same fallback semantics as
   * IN2/IN3: availability problems fall through, request problems do not.
   */
  function mapRpcError(e: unknown): Outcome<never> {
    const code = (e as { code?: string } | null)?.code;
    const detail = e instanceof Error ? e.message : String(e);
    switch (code) {
      case `unauthorized`: return fail({ kind: `unconfigured`, provider: id });
      case `rate_limited`: return fail({ kind: `rateLimited`, provider: id });
      case `internal`: return fail({ kind: `unavailable`, provider: id, detail });
      case `method_not_found`:
      case `invalid_params`:
      case `not_found`:
      case `loop_disabled`:
        return fail({ kind: `rejected`, provider: id, detail: `${code}: ${detail}` });
      default:
        // No code means the socket itself failed ("socket closed").
        channel = undefined;
        return fail({ kind: `unavailable`, provider: id, detail });
    }
  }

  /** Acquire, call, map. Every RPC goes through here. */
  async function rpc<T>(method: string, params?: unknown): Promise<Outcome<T>> {
    const ch = await acquire();
    if (!ch.ok) return ch;
    try {
      return ok(await ch.value.call<T>(method, params));
    } catch (e) {
      return mapRpcError(e);
    }
  }

  const asRecord = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === `object` && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

  const cents = (tokens: number, perMTok: number): number =>
    Math.round((tokens / 1_000_000) * perMTok * 100);

  return {
    id,
    label: cfg.label ?? `T3 Code Connect`,
    auth: `pairing`,

    async models(): Promise<Outcome<Model[]>> {
      const got = await rpc<unknown>(`inference.models`);
      if (!got.ok) return got;
      const list = Array.isArray(got.value) ? got.value : asRecord(got.value)?.[`models`];
      if (!Array.isArray(list)) {
        return fail({ kind: `rejected`, provider: id, detail: `inference.models returned no list` });
      }
      return ok(list.map(asRecord).filter((m): m is Record<string, unknown> => typeof m?.[`id`] === `string`)
        .map((m) => ({
          id: m[`id`] as string,
          label: typeof m[`label`] === `string` ? (m[`label`] as string) : (m[`id`] as string),
          ...(typeof m[`contextTokens`] === `number` ? { contextTokens: m[`contextTokens`] as number } : {}),
          // The channel may declare tool support explicitly; absent, not claimed.
          tools: m[`tools`] === true,
        })));
    },

    async chat(request: ChatRequest): Promise<Outcome<ChatResult>> {
      const got = await rpc<unknown>(`inference.chat`, {
        model: request.model,
        messages: request.messages,
        ...(request.maxTokens === undefined ? {} : { maxTokens: request.maxTokens }),
        ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      });
      if (!got.ok) return got;
      const r = asRecord(got.value);
      const content = r?.[`content`];
      if (typeof content !== `string`) {
        return fail({ kind: `rejected`, provider: id, detail: `inference.chat returned no content` });
      }
      const u = asRecord(r?.[`usage`]);
      const num = (v: unknown): number => (typeof v === `number` ? v : 0);
      const usage: Usage = { inputTokens: num(u?.[`inputTokens`]), outputTokens: num(u?.[`outputTokens`]) };
      // The channel speaks our enum directly; anything unrecognized is `end`.
      const s = r?.[`stop`];
      const stop: ChatResult[`stop`] =
        s === `length` || s === `tool` || s === `refusal` ? s : `end`;
      return ok({ content, usage, stop });
    },

    estimate(request: ChatRequest): CostEstimate {
      const p = cfg.pricing?.[request.model];
      if (!p) return { cents: 0, known: false };
      const chars = request.messages.reduce((n, m) => n + m.content.length, 0);
      return {
        cents: cents(Math.ceil(chars / 4), p.inputPerMTok) + cents(request.maxTokens ?? 0, p.outputPerMTok),
        known: true,
      };
    },

    cost(model: ModelId, usage: Usage): CostEstimate {
      const p = cfg.pricing?.[model];
      if (!p) return { cents: 0, known: false };
      return { cents: cents(usage.inputTokens, p.inputPerMTok) + cents(usage.outputTokens, p.outputPerMTok), known: true };
    },

    async reachable(): Promise<Outcome<true>> {
      const got = await rpc<unknown>(`inference.models`);
      return got.ok ? ok(true as const) : fail(got.error);
    },

    credential(): CredentialStatus {
      // Pairing stores no key. Presence is "paired"; the hint is the
      // environment label, which is recognisable and not a secret.
      if (!cfg.token) return { configured: false };
      return { configured: true, ...(cfg.environment ? { hint: cfg.environment } : {}) };
    },
  };
}
