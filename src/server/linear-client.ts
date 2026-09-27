/**
 * Linear dataplane client: one code path for every call to
 * https://api.linear.app/graphql (SPECS/target-architecture.md, PLAN R5.1).
 *
 * Rate budget (verified against Linear's official docs, linear.app/developers
 * /rate-limiting, 2026-09-27 — KNOWLEDGE §6):
 * - Every response carries X-RateLimit-Requests-{Limit,Remaining,Reset} and
 *   X-RateLimit-Complexity-{Limit,Remaining,Reset} + X-Complexity; resets are
 *   UTC epoch MILLISECONDS. Documented budgets (API key, per user): 2,500
 *   req/h and 3,000,000 complexity pts/h; a single query may never exceed
 *   10,000 points. The documented numbers have drifted before — the HEADERS
 *   are the source of truth, so this client never hardcodes a budget.
 * - Some endpoints have lower per-endpoint limits, signalled with
 *   X-RateLimit-Endpoint-Requests-* + X-RateLimit-Endpoint-Name.
 * - Exhaustion surfaces two ways: HTTP 429 (Retry-After, seconds) or a 200
 *   with errors[].extensions.code === "RATELIMITED".
 *
 * Policy: gate before firing (when a window is known-exhausted, refuse with
 * retryAfterMs instead of earning a 429), cap concurrency with a FIFO queue,
 * record the headers after every response. No automatic retries in this
 * slice — callers (R5.2+) decide; nothing here hides a failure.
 *
 * Secrets: the token is read server-side via getToken() on each call and
 * never logged, returned, or stored by this client.
 */

export const LINEAR_API_URL = "https://api.linear.app/graphql";
/** Store key holding the Linear PAT (write-only over RPC). */
export const LINEAR_TOKEN_KEY = "linear.token";

export interface RateLimitSnapshot {
  requestsLimit?: number;
  requestsRemaining?: number;
  /** UTC epoch milliseconds. */
  requestsReset?: number;
  complexityLimit?: number;
  complexityRemaining?: number;
  /** UTC epoch milliseconds. */
  complexityReset?: number;
  /** Complexity cost of the last executed query (X-Complexity). */
  lastComplexity?: number;
  /** Per-endpoint limit, present only when Linear applies one. */
  endpointName?: string;
  endpointRequestsRemaining?: number;
  /** UTC epoch milliseconds. */
  endpointRequestsReset?: number;
}

export type LinearErrorKind = "not_connected" | "network" | "http" | "graphql" | "rate_limited";

export class LinearClientError extends Error {
  kind: LinearErrorKind;
  status?: number;
  /** How long to wait before retrying, when Linear told us. */
  retryAfterMs?: number;
  rateLimit?: RateLimitSnapshot;
  constructor(kind: LinearErrorKind, message: string, extra?: { status?: number; retryAfterMs?: number; rateLimit?: RateLimitSnapshot }) {
    super(message);
    this.kind = kind;
    this.status = extra?.status;
    this.retryAfterMs = extra?.retryAfterMs;
    this.rateLimit = extra?.rateLimit;
  }
}

export interface LinearClientOptions {
  /** Read-through token source (store-backed); undefined = not connected. */
  getToken: () => string | undefined;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Max requests in flight; the rest queue FIFO. Default 4. */
  maxConcurrency?: number;
  /** Per-request timeout. Default 15_000. */
  timeoutMs?: number;
}

interface GraphqlBody<T> {
  data?: T | null;
  errors?: Array<{ message?: string; extensions?: { code?: string } }>;
}

function parseRateLimit(headers: Headers): RateLimitSnapshot {
  const num = (name: string): number | undefined => {
    const v = headers.get(name);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const snap: RateLimitSnapshot = {
    requestsLimit: num("x-ratelimit-requests-limit"),
    requestsRemaining: num("x-ratelimit-requests-remaining"),
    requestsReset: num("x-ratelimit-requests-reset"),
    complexityLimit: num("x-ratelimit-complexity-limit"),
    complexityRemaining: num("x-ratelimit-complexity-remaining"),
    complexityReset: num("x-ratelimit-complexity-reset"),
    lastComplexity: num("x-complexity"),
    endpointRequestsRemaining: num("x-ratelimit-endpoint-requests-remaining"),
    endpointRequestsReset: num("x-ratelimit-endpoint-requests-reset"),
  };
  const endpointName = headers.get("x-ratelimit-endpoint-name");
  if (endpointName) snap.endpointName = endpointName;
  return snap;
}

export class LinearClient {
  private opts: Required<Pick<LinearClientOptions, "fetchImpl" | "now" | "maxConcurrency" | "timeoutMs">> & LinearClientOptions;
  private lastBudget: RateLimitSnapshot = {};
  private inflight = 0;
  private queue: Array<() => void> = [];

  constructor(opts: LinearClientOptions) {
    this.opts = {
      ...opts,
      fetchImpl: opts.fetchImpl ?? fetch,
      now: opts.now ?? (() => Date.now()),
      maxConcurrency: opts.maxConcurrency ?? 4,
      timeoutMs: opts.timeoutMs ?? 15_000,
    };
  }

  /** Last known budget (from response headers). Never a network call. */
  budget(): RateLimitSnapshot {
    return { ...this.lastBudget };
  }

  private acquire(): Promise<void> {
    if (this.inflight < this.opts.maxConcurrency) {
      this.inflight += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.inflight += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.inflight -= 1;
    const next = this.queue.shift();
    if (next) next();
  }

  /** Refuse to fire into a window Linear has already told us is exhausted. */
  private gate(): void {
    const now = this.opts.now();
    const b = this.lastBudget;
    if (b.requestsRemaining === 0 && b.requestsReset !== undefined && b.requestsReset > now) {
      throw new LinearClientError("rate_limited", "Linear request budget exhausted; window resets later", {
        retryAfterMs: b.requestsReset - now,
        rateLimit: this.budget(),
      });
    }
    if (b.complexityRemaining === 0 && b.complexityReset !== undefined && b.complexityReset > now) {
      throw new LinearClientError("rate_limited", "Linear complexity budget exhausted; window resets later", {
        retryAfterMs: b.complexityReset - now,
        rateLimit: this.budget(),
      });
    }
  }

  /**
   * Run one GraphQL operation. Resolves with `data` when present (Linear can
   * return partial data alongside errors; the errors are on the wire either
   * way — this slice resolves with data and lets R5.2+ decide how much it
   * cares). Throws LinearClientError otherwise.
   */
  async query<T>(query: string, variables?: Record<string, unknown>, opts?: { timeoutMs?: number }): Promise<T> {
    const token = this.opts.getToken();
    if (!token) throw new LinearClientError("not_connected", "Linear not connected");

    await this.acquire();
    try {
      this.gate();
      let res: Response;
      try {
        res = await this.opts.fetchImpl(LINEAR_API_URL, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: token },
          body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
          signal: AbortSignal.timeout(opts?.timeoutMs ?? this.opts.timeoutMs),
        });
      } catch (e) {
        throw new LinearClientError("network", `network: ${e instanceof Error ? e.message : String(e)}`);
      }

      this.lastBudget = parseRateLimit(res.headers);

      if (res.status === 429) {
        const retryAfterSec = Number(res.headers.get("retry-after"));
        const retryAfterMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : this.lastBudget.requestsReset !== undefined && this.lastBudget.requestsReset > this.opts.now()
            ? this.lastBudget.requestsReset - this.opts.now()
            : undefined;
        // We earned a 429 despite the gate: mark the request window exhausted.
        this.lastBudget.requestsRemaining = 0;
        throw new LinearClientError("rate_limited", "http 429: Linear rate limit", {
          status: 429,
          retryAfterMs,
          rateLimit: this.budget(),
        });
      }
      if (!res.ok) {
        throw new LinearClientError("http", `http ${res.status}`, { status: res.status, rateLimit: this.budget() });
      }

      let body: GraphqlBody<T>;
      try {
        body = (await res.json()) as GraphqlBody<T>;
      } catch {
        throw new LinearClientError("http", "invalid JSON from Linear", { status: res.status, rateLimit: this.budget() });
      }

      if (body.data === undefined || body.data === null) {
        const errors = body.errors ?? [];
        const limited = errors.some((e) => e.extensions?.code === "RATELIMITED");
        if (limited) {
          const reset = this.lastBudget.requestsReset;
          const now = this.opts.now();
          throw new LinearClientError("rate_limited", "Linear: RATELIMITED", {
            retryAfterMs: reset !== undefined && reset > now ? reset - now : undefined,
            rateLimit: this.budget(),
          });
        }
        const message = errors.map((e) => e.message ?? "?").join("; ") || "GraphQL error (no message)";
        throw new LinearClientError("graphql", message, { rateLimit: this.budget() });
      }
      return body.data;
    } finally {
      this.release();
    }
  }
}
