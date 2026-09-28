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
 * - Exhaustion: the DOCUMENTED shape is HTTP 400 with
 *   errors[].extensions.code === "RATELIMITED" in the body (the official
 *   rate-limiting page, "Handling rate limit errors" — see
 *   extracts/linear-official/docs-site/rate-limiting.md). Defensively we also
 *   map HTTP 429 (Retry-After, seconds) and a RATELIMITED code on any other
 *   status, 200 included.
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

/** Latest future reset among exhausted windows; ambiguous limit responses may
 * fall back to the request reset. Preflight checks require explicit exhaustion. */
function retryDelay(b: RateLimitSnapshot, now: number, ambiguousLimit = false): number | undefined {
  const windows = [
    [b.requestsRemaining, b.requestsReset],
    [b.complexityRemaining, b.complexityReset],
    [b.endpointRequestsRemaining, b.endpointRequestsReset],
  ].filter(([remaining]) => remaining === 0);
  const resets = windows.length ? windows.map(([, reset]) => reset)
    : ambiguousLimit ? [b.requestsReset] : [];
  const futureResets = resets.filter((reset): reset is number => reset !== undefined && reset > now);
  return futureResets.length ? Math.max(...futureResets) - now : undefined;
}

export class LinearClient {
  private opts: Required<Pick<LinearClientOptions, "fetchImpl" | "now" | "maxConcurrency" | "timeoutMs">> & LinearClientOptions;
  private lastBudget: RateLimitSnapshot = {};
  /** Credential the budget snapshot belongs to (budgets are per-USER quotas;
   *  a token swap invalidates the snapshot — CodeRabbit #155). */
  private budgetToken?: string;
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
    if (this.opts.getToken() !== this.budgetToken) return {};
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

  /**
   * Record response headers as the budget — only when the credential that
   * earned them is still the current one (a response fired before a token
   * swap must not repopulate the new user's budget).
   */
  private recordBudget(headers: Headers, firedWithToken: string): void {
    if (firedWithToken !== this.opts.getToken()) return;
    this.lastBudget = parseRateLimit(headers);
    this.budgetToken = firedWithToken;
  }

  /**
   * After a limit signal (429 or RATELIMITED), zero the window the headers
   * show exhausted. If no window shows exhaustion, conservatively zero the
   * request window — never overwrite a still-positive budget the headers
   * just reported (CodeRabbit #155).
   */
  private markExhausted(firedWithToken: string, retryAfterMs?: number): void {
    if (firedWithToken !== this.opts.getToken()) return;
    const b = this.lastBudget;
    const now = this.opts.now();
    // As with endpoint exhaustion, Retry-After supplies a usable gate reset
    // when a complexity-limited 429 omits it or reports an expired window.
    if (b.complexityRemaining === 0 &&
        (b.complexityReset === undefined || b.complexityReset <= now) &&
        retryAfterMs !== undefined) {
      b.complexityReset = now + retryAfterMs;
    }
    if (b.endpointRequestsRemaining === 0 &&
        (b.endpointRequestsReset === undefined || b.endpointRequestsReset <= now) &&
        retryAfterMs !== undefined) {
      b.endpointRequestsReset = now + retryAfterMs;
    }
    // Only ambiguous limit responses force the request window to zero.
    // A request window already exhausted alongside endpoint/complexity limits
    // still needs its own Retry-After backfill below.
    if (b.complexityRemaining !== 0 && b.endpointRequestsRemaining !== 0) {
      b.requestsRemaining = 0;
    }
    // The gate only fires on remaining===0 AND reset>now. A limit response
    // without informative budget headers (429 + Retry-After only) would zero
    // remaining but leave reset unset — an open gate. Backfill the reset from
    // Retry-After when the headers gave none (CodeRabbit #155, final thread).
    if (b.requestsRemaining === 0 &&
        (b.requestsReset === undefined || b.requestsReset <= now) && retryAfterMs !== undefined) {
      b.requestsReset = now + retryAfterMs;
    }
  }

  /** Refuse to fire into a window Linear has already told us is exhausted. */
  private gate(): void {
    // A budget recorded under a different credential says nothing about the
    // current user's window (CodeRabbit #155).
    const token = this.opts.getToken();
    if (token !== this.budgetToken) this.lastBudget = {};
    const now = this.opts.now();
    const b = this.lastBudget;
    const retryAfterMs = retryDelay(b, now);
    const exhausted = (remaining?: number, reset?: number): reset is number =>
      remaining === 0 && reset !== undefined && reset > now;
    if (exhausted(b.requestsRemaining, b.requestsReset)) {
      throw new LinearClientError("rate_limited", "Linear request budget exhausted; window resets later", {
        retryAfterMs,
        rateLimit: this.budget(),
      });
    }
    if (exhausted(b.complexityRemaining, b.complexityReset)) {
      throw new LinearClientError("rate_limited", "Linear complexity budget exhausted; window resets later", {
        retryAfterMs,
        rateLimit: this.budget(),
      });
    }
    // Endpoint-specific limits (X-RateLimit-Endpoint-*) gate too — firing
    // into one earns the 429 this client exists to avoid.
    if (exhausted(b.endpointRequestsRemaining, b.endpointRequestsReset)) {
      throw new LinearClientError("rate_limited", `Linear endpoint budget exhausted (${b.endpointName ?? "endpoint"}); window resets later`, {
        retryAfterMs,
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
    if (!this.opts.getToken()) throw new LinearClientError("not_connected", "Linear not connected");

    await this.acquire();
    try {
      // Credentials may be replaced or cleared while this call waits in the queue.
      const token = this.opts.getToken();
      if (!token) throw new LinearClientError("not_connected", "Linear not connected");
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

      this.recordBudget(res.headers, token);

      if (res.status === 429) {
        const retryAfterSec = Number(res.headers.get("retry-after"));
        const retryAfterHeaderMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000 : undefined;
        const retryAfterMs = retryAfterHeaderMs ??
          retryDelay(parseRateLimit(res.headers), this.opts.now(), true);
        // We earned a 429 despite the gate: zero the window the headers show
        // exhausted (endpoint/complexity 429s must not nuke a healthy global
        // budget — only the ambiguous case falls back to the request window).
        this.markExhausted(token, retryAfterHeaderMs);
        throw new LinearClientError("rate_limited", "http 429: Linear rate limit", {
          status: 429,
          retryAfterMs,
          rateLimit: this.budget(),
        });
      }
      // Parse the body BEFORE the generic !res.ok throw: the DOCUMENTED
      // rate-limit exhaustion shape is HTTP 400 with errors[].extensions.code
      // === "RATELIMITED" (docs-site/rate-limiting.md, "Handling rate limit
      // errors"). A generic http throw on 400 would misclassify it, skip
      // markExhausted(), and leave the gate open (#155 blocking review).
      let body: GraphqlBody<T> | undefined;
      try {
        body = (await res.json()) as GraphqlBody<T>;
      } catch {
        body = undefined;
      }

      // RATELIMITED is checked on ANY status — 400 is documented, 200 with
      // partial data is defended against (treating a limited call as success
      // would let settings.setLinear store a token mid-limit — CodeRabbit
      // #155), anything else is belt-and-braces.
      const errors = body?.errors ?? [];
      if (errors.some((e) => e.extensions?.code === "RATELIMITED")) {
        this.markExhausted(token);
        // Use this response's headers: another query may update lastBudget
        // while its JSON body is being read. Only exhausted windows delay a
        // retry; when several are exhausted, wait for the latest known reset.
        const retryAfterMs = retryDelay(parseRateLimit(res.headers), this.opts.now(), true);
        throw new LinearClientError("rate_limited", "Linear: RATELIMITED", {
          status: res.ok ? undefined : res.status,
          retryAfterMs,
          rateLimit: this.budget(),
        });
      }
      if (!res.ok) {
        throw new LinearClientError("http", `http ${res.status}`, { status: res.status, rateLimit: this.budget() });
      }
      if (body === undefined) {
        throw new LinearClientError("http", "invalid JSON from Linear", { status: res.status, rateLimit: this.budget() });
      }
      if (body.data === undefined || body.data === null) {
        const message = errors.map((e) => e.message ?? "?").join("; ") || "GraphQL error (no message)";
        throw new LinearClientError("graphql", message, { rateLimit: this.budget() });
      }
      return body.data;
    } finally {
      this.release();
    }
  }
}
