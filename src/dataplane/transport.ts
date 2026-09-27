/**
 * Transport: how one GraphQL operation gets to Linear and back.
 *
 * `Transport` is an interface so fixture mode (tests, offline dev) and any
 * future batching wrapper slot in without touching call sites.
 *
 * `HttpTransport` talks to the public API (KNOWLEDGE.md §6):
 *   POST https://api.linear.app/graphql
 * with the credential's Authorization header. Retries are bounded and only
 * for failures that can plausibly succeed on a repeat: 429, 5xx, and network
 * errors. Mutations are NOT retried by default (the caller must pass an
 * idempotency-aware opt-in) — blind-retried writes can double-apply.
 */

import {
  AbortedError,
  AuthenticationError,
  ForbiddenError,
  GraphQLRequestError,
  LinearApiError,
  NetworkError,
  RateLimitError,
  ServerError,
  type GraphQLErrorEntry,
} from "./errors.js";
import { CredentialStore, type LinearCredential } from "./auth.js";
import { RateBudget } from "./rateBudget.js";

export const DEFAULT_ENDPOINT = "https://api.linear.app/graphql";

export interface GraphQLRequest {
  /** The GraphQL document text. */
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface ExecuteOptions {
  /**
   * Estimated complexity cost for budget accounting. The server-reported
   * `X-Complexity` header, when present, replaces the estimate afterwards.
   */
  estimatedComplexity?: number;
  /** Caller cancellation. */
  signal?: AbortSignal;
  /**
   * Set true to allow retrying this operation after ambiguous failures.
   * Only safe when the operation is idempotent (reads always are; writes
   * only with idempotency keys / upsert semantics).
   * Default: true for queries, false for mutations (derived from the document).
   */
  idempotent?: boolean;
  /** Max total attempts (including the first). Default: read 4 / write 1. */
  maxAttempts?: number;
  /** Per-attempt wall-clock timeout (ms). Default: HttpTransportOptions.timeoutMs (30s). */
  timeoutMs?: number;
}

/** Diagnostics emitted per HTTP attempt; the server (R10/server) feeds these into the audit log. */
export interface TransportEvent {
  type: "attempt" | "response" | "retry" | "error";
  operationName?: string | undefined;
  httpStatus?: number | undefined;
  /** Request cost reported by the server, when known. */
  complexity?: number | undefined;
  retryAfterMs?: number | undefined;
  /** Milliseconds spent on the attempt. */
  durationMs?: number | undefined;
  /** Redacted message — safe to persist. */
  message?: string | undefined;
}

export interface Transport {
  execute<T>(req: GraphQLRequest, opts?: ExecuteOptions): Promise<T>;
}

export interface HttpTransportOptions {
  credential: LinearCredential;
  endpoint?: string;
  budget?: RateBudget;
  /** fetch injection for tests / non-Node runtimes. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Hook for audit/observability. Must be cheap and must not throw. */
  onEvent?: (e: TransportEvent) => void;
  /** User-Agent string; Linear asks API clients to identify themselves. */
  userAgent?: string;
  /** Per-attempt wall-clock timeout in ms. Default 30_000. */
  timeoutMs?: number;
}

/** Parse Linear's rate-limit response headers. Unknown/missing → undefined. */
export function parseRateHeaders(headers: Headers): {
  requestsRemaining?: number;
  complexityRemaining?: number;
  complexity?: number;
  retryAfterMs?: number;
  /** Epoch ms when the request window resets (Linear sends epoch milliseconds). */
  requestsResetAt?: number;
  /** Epoch ms when the complexity window resets. */
  complexityResetAt?: number;
} {
  const num = (name: string): number | undefined => {
    const raw = headers.get(name);
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const out: ReturnType<typeof parseRateHeaders> = {};
  const reqRem = num("x-ratelimit-requests-remaining");
  if (reqRem !== undefined) out.requestsRemaining = reqRem;
  const cxRem = num("x-ratelimit-complexity-remaining");
  if (cxRem !== undefined) out.complexityRemaining = cxRem;
  const cx = num("x-complexity");
  if (cx !== undefined) out.complexity = cx;
  const reqReset = num("x-ratelimit-requests-reset");
  if (reqReset !== undefined) out.requestsResetAt = reqReset;
  const cxReset = num("x-ratelimit-complexity-reset");
  if (cxReset !== undefined) out.complexityResetAt = cxReset;
  const retryAfter = headers.get("retry-after");
  if (retryAfter !== null) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) out.retryAfterMs = secs * 1000;
    else {
      const date = Date.parse(retryAfter);
      if (!Number.isNaN(date)) out.retryAfterMs = Math.max(0, date - Date.now());
    }
  }
  return out;
}

/** Backoff for retryable failures: exponential with full jitter, floor from server hints. */
export function retryDelayMs(attempt: number, serverHintMs?: number): number {
  const base = Math.min(1000 * 2 ** attempt, 30_000);
  const jittered = Math.floor(Math.random() * base);
  return serverHintMs !== undefined ? Math.max(serverHintMs, jittered) : jittered;
}

/** Server-directed wait for a rate-limited retry: Retry-After wins; else window reset (floor 1s). */
export function rateLimitWaitMs(rate: ReturnType<typeof parseRateHeaders>): number | undefined {
  if (rate.retryAfterMs !== undefined) return rate.retryAfterMs;
  if (rate.requestsResetAt !== undefined) return Math.max(1000, rate.requestsResetAt - Date.now());
  return undefined;
}

export class HttpTransport implements Transport {
  private readonly store: CredentialStore;
  private readonly endpoint: string;
  private readonly budget: RateBudget;
  private readonly fetchImpl: typeof fetch;
  private readonly onEvent: ((e: TransportEvent) => void) | undefined;
  private readonly userAgent: string;
  private readonly timeoutMs: number;

  constructor(options: HttpTransportOptions) {
    this.store = new CredentialStore(options.credential);
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.budget = options.budget ?? new RateBudget();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.onEvent = options.onEvent;
    this.userAgent = options.userAgent ?? "linear-loops-decompile/0.1 (+self-hosted)";
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  get rateBudget(): RateBudget {
    return this.budget;
  }

  private emit(e: TransportEvent): void {
    try {
      this.onEvent?.(e);
    } catch {
      // Observability must never break the dataplane.
    }
  }

  async execute<T>(req: GraphQLRequest, opts: ExecuteOptions = {}): Promise<T> {
    // Mutations are NOT retried by default — blind-retried writes can
    // double-apply after an ambiguous failure. Reads are idempotent by
    // definition. The explicit flag always wins over the document-derived default.
    const isMutation = /^\s*mutation\b/.test(req.query);
    const idempotent = opts.idempotent ?? !isMutation;
    const maxAttempts = opts.maxAttempts ?? (idempotent ? 4 : 1);
    let authRetried = false;
    let lastError: LinearApiError | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait for local budget before spending a network round-trip.
      await this.budget.waitForBudget(opts.estimatedComplexity ?? 1, {
        signal: opts.signal,
      });

      const started = Date.now();
      this.emit({ type: "attempt", operationName: req.operationName });
      let response: Response;
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: this.store.header(),
            "user-agent": this.userAgent,
          },
          body: JSON.stringify({
            query: req.query,
            variables: req.variables ?? {},
            ...(req.operationName ? { operationName: req.operationName } : {}),
          }),
          signal: combineSignals(opts.signal, opts.timeoutMs ?? this.timeoutMs),
        });
      } catch (err) {
        if (isAbort(err)) throw toAbortedError();
        lastError = new NetworkError(
          this.store.redact(`Network failure calling Linear: ${errMessage(err)}`),
        );
        this.emit({ type: "error", operationName: req.operationName, message: lastError.message });
        if (attempt + 1 < maxAttempts) {
          await this.sleepBeforeRetry(attempt, undefined, req.operationName, opts.signal);
          continue;
        }
        throw lastError;
      }

      const durationMs = Date.now() - started;
      const rate = parseRateHeaders(response.headers);
      this.budget.updateFromHeaders(rate);
      this.budget.record(rate.complexity ?? opts.estimatedComplexity ?? 1);
      this.emit({
        type: "response",
        operationName: req.operationName,
        httpStatus: response.status,
        complexity: rate.complexity,
        durationMs,
      });

      // One silent OAuth refresh on 401, then give up.
      if (response.status === 401 && !authRetried && (await this.store.refresh())) {
        authRetried = true;
        attempt--; // the refresh doesn't consume an attempt
        continue;
      }

      if (response.ok) {
        const body = (await response.json()) as {
          data?: unknown;
          errors?: { message?: string; extensions?: { code?: string }; path?: (string | number)[] }[];
        };
        if (body.errors && body.errors.length > 0) {
          const entries: GraphQLErrorEntry[] = body.errors.map((e) => ({
            message: this.store.redact(e.message ?? "unknown GraphQL error"),
            code: e.extensions?.code,
            path: e.path,
          }));
          // Some auth/rate failures arrive as 200+errors; normalize them.
          const codes = new Set(entries.map((e) => e.code));
          if (codes.has("AUTHENTICATION_ERROR")) throw new AuthenticationError();
          if (codes.has("RATELIMITED")) {
            const rl = new RateLimitError(
              "Linear rate limit (GraphQL error).",
              rateLimitWaitMs(rate),
            );
            if (attempt + 1 < maxAttempts) {
              await this.sleepBeforeRetry(attempt, rateLimitWaitMs(rate), req.operationName, opts.signal);
              continue;
            }
            throw rl;
          }
          if (codes.has("FORBIDDEN")) throw new ForbiddenError();
          throw new GraphQLRequestError(entries);
        }
        return body.data as T;
      }

      // Non-2xx. Linear documents rate-limit (and some auth) failures as
      // HTTP 400 with a GraphQL errors body — inspect codes before classifying.
      const err =
        (await this.graphqlErrorFromBody(response, rate)) ??
        this.httpError(response.status, rate.retryAfterMs ?? rateLimitWaitMs(rate));
      lastError = err;
      if (!err.retryable || attempt + 1 >= maxAttempts) throw err;
      await this.sleepBeforeRetry(attempt, err.retryAfterMs, req.operationName, opts.signal);
    }

    throw lastError ?? new NetworkError("Request failed without a specific cause.");
  }

  /** Map a non-2xx GraphQL errors body to a typed error, when one is present. */
  private async graphqlErrorFromBody(
    response: Response,
    rate: ReturnType<typeof parseRateHeaders>,
  ): Promise<LinearApiError | null> {
    let body: { errors?: { message?: string; extensions?: { code?: string } }[] };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      return null;
    }
    if (!body.errors || body.errors.length === 0) return null;
    const codes = new Set(body.errors.map((e) => e.extensions?.code));
    const message = this.store.redact(
      body.errors.map((e) => e.message ?? "unknown error").join("; "),
    );
    if (codes.has("RATELIMITED")) {
      return new RateLimitError(`Linear rate limit (HTTP ${response.status}): ${message}`, rateLimitWaitMs(rate));
    }
    if (codes.has("AUTHENTICATION_ERROR")) return new AuthenticationError();
    if (codes.has("FORBIDDEN")) return new ForbiddenError();
    return null;
  }

  private httpError(status: number, retryAfterMs?: number): LinearApiError {
    if (status === 401) return new AuthenticationError();
    if (status === 403) return new ForbiddenError();
    if (status === 429) {
      return new RateLimitError("Linear rate limit (HTTP 429).", retryAfterMs);
    }
    if (status >= 500) return new ServerError(status);
    return new LinearApiError(`Unexpected HTTP ${status} from Linear.`, {
      kind: "server",
      httpStatus: status,
      retryable: false,
    });
  }

  private async sleepBeforeRetry(
    attempt: number,
    serverHintMs: number | undefined,
    operationName: string | undefined,
    signal?: AbortSignal,
  ): Promise<void> {
    const delay = retryDelayMs(attempt, serverHintMs);
    this.emit({ type: "retry", operationName, retryAfterMs: delay });
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) return reject(new AbortedError());
      const t = setTimeout(resolve, delay);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          reject(new AbortedError());
        },
        { once: true },
      );
    });
  }
}

/** Caller cancellation merged with a per-attempt wall-clock timeout. */
function combineSignals(caller: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return caller ? AbortSignal.any([caller, timeout]) : timeout;
}

function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function toAbortedError(): LinearApiError {
  return new AbortedError();
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}



