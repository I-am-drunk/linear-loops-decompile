/**
 * Local rate budget for Linear's public API.
 *
 * Ground truth (KNOWLEDGE.md §6): ≈2,500 requests/hour per user. Linear also
 * meters query complexity and tells the truth via response headers
 * (`X-RateLimit-*-Remaining` / `*-Reset`); when headers disagree with our
 * local bookkeeping, the server's view wins.
 *
 * The budgeter is deliberately conservative:
 * - A sliding window of timestamped request costs (not a naive fixed window,
 *   which allows 2x bursts at the boundary).
 * - Complexity is tracked when the caller supplies/observes it, but only
 *   *enforced* when a limit is configured — we do not invent a complexity
 *   ceiling the docs don't give us.
 * - A 429 (or a server hint) sets `blockedUntil`; everything queues behind it.
 *
 * The class is transport-agnostic and synchronous except `waitForBudget`,
 * which parks a caller (with AbortSignal support) until capacity frees up.
 */

import { AbortedError, BudgetExhaustedError } from "./errors.js";

export interface RateBudgetOptions {
  /** Max requests per rolling hour. Default 2500 (KNOWLEDGE.md §6). */
  maxRequestsPerHour?: number;
  /**
   * Max complexity points per rolling hour, if the operator wants a local
   * ceiling. Undefined = track but don't enforce (server headers still clamp).
   */
  maxComplexityPerHour?: number;
  /** Window length; overridable for tests. Default 1 hour. */
  windowMs?: number;
  /** Clock injection for tests. */
  now?: () => number;
}

export interface RateBudgetSnapshot {
  requestsUsed: number;
  requestsRemaining: number;
  complexityUsed: number;
  /** null when no complexity limit is configured. */
  complexityRemaining: number | null;
  /** Epoch ms when the oldest in-window request ages out (null if window empty). */
  nextFreeAt: number | null;
  /** Epoch ms until which the server told us to back off (null if not blocked). */
  blockedUntil: number | null;
}

interface Spend {
  at: number;
  complexity: number;
}

const DEFAULT_MAX_REQUESTS = 2500;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

export class RateBudget {
  private readonly maxRequests: number;
  private readonly maxComplexity: number | undefined;
  private readonly windowMs: number;
  private readonly now: () => number;
  private spends: Spend[] = [];
  private blockedUntil: number | null = null;
  /**
   * Server-reported remaining count, used to clamp our optimistic local math
   * when it is *lower* than ours. Cleared as the window drains.
   */
  private serverRemaining: number | null = null;

  constructor(options: RateBudgetOptions = {}) {
    this.maxRequests = options.maxRequestsPerHour ?? DEFAULT_MAX_REQUESTS;
    this.maxComplexity = options.maxComplexityPerHour;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.now = options.now ?? (() => Date.now());
  }

  private prune(): void {
    const cutoff = this.now() - this.windowMs;
    // Spends are appended in time order, so a prefix scan suffices.
    let first = 0;
    while (first < this.spends.length && this.spends[first]!.at <= cutoff) first++;
    if (first > 0) this.spends.splice(0, first);
    if (this.blockedUntil !== null && this.blockedUntil <= this.now()) {
      this.blockedUntil = null;
    }
  }

  private usedRequests(): number {
    return this.spends.length;
  }

  private usedComplexity(): number {
    let sum = 0;
    for (const s of this.spends) sum += s.complexity;
    return sum;
  }

  /** Effective request allowance left, honoring a server clamp when present. */
  remainingRequests(): number {
    this.prune();
    const local = this.maxRequests - this.usedRequests();
    if (this.serverRemaining === null) return Math.max(0, local);
    // Server clamp only ever lowers the estimate; it expires with the window.
    return Math.max(0, Math.min(local, this.serverRemaining));
  }

  remainingComplexity(): number | null {
    if (this.maxComplexity === undefined) return null;
    this.prune();
    return Math.max(0, this.maxComplexity - this.usedComplexity());
  }

  /**
   * Milliseconds until `complexity` more points and one more request fit the
   * budget. 0 = available now. Infinity = can never fit (cost over the cap).
   */
  waitTimeMs(complexity = 1): number {
    this.prune();
    if (this.maxComplexity !== undefined && complexity > this.maxComplexity) {
      return Infinity;
    }
    let wait = 0;
    if (this.blockedUntil !== null) {
      wait = Math.max(wait, this.blockedUntil - this.now());
    }
    // Simulate consuming oldest spends until both dimensions fit.
    const fits = (spends: Spend[]): boolean => {
      const reqOk = spends.length < this.maxRequests;
      const cxOk =
        this.maxComplexity === undefined ||
        spends.reduce((a, s) => a + s.complexity, 0) + complexity <= this.maxComplexity;
      return reqOk && cxOk;
    };
    const sim = this.spends.slice();
    while (!fits(sim)) {
      const oldest = sim.shift();
      if (!oldest) break; // fits() should be true for an empty window
      wait = Math.max(wait, oldest.at + this.windowMs - this.now());
    }
    // Server clamp: treat as a hard block until reset info ages out; without a
    // reset timestamp we approximate with the window edge of our oldest spend.
    if (this.serverRemaining !== null && this.serverRemaining <= 0) {
      const edge =
        this.spends.length > 0
          ? this.spends[0]!.at + this.windowMs - this.now()
          : this.windowMs;
      wait = Math.max(wait, edge);
    }
    return wait;
  }

  /**
   * Record one spent request. Call *after* the request is sent (or when
   * reserving capacity ahead of sending — the budgeter does not distinguish).
   */
  record(complexity = 1): void {
    this.prune();
    this.spends.push({ at: this.now(), complexity });
    if (this.serverRemaining !== null) {
      this.serverRemaining = Math.max(0, this.serverRemaining - 1);
    }
  }

  /** Fold server-reported rate state into the budget. All fields optional. */
  updateFromHeaders(headers: {
    requestsRemaining?: number;
    complexityRemaining?: number;
    retryAfterMs?: number;
  }): void {
    if (headers.requestsRemaining !== undefined) {
      // Never let a stale/older header raise our estimate above the local one.
      this.serverRemaining =
        this.serverRemaining === null
          ? headers.requestsRemaining
          : Math.min(this.serverRemaining, headers.requestsRemaining);
    }
    if (headers.retryAfterMs !== undefined) {
      const until = this.now() + headers.retryAfterMs;
      this.blockedUntil =
        this.blockedUntil === null ? until : Math.max(this.blockedUntil, until);
    }
    // complexityRemaining is tracked implicitly through record(); a server
    // clamp on complexity is only meaningful with a configured limit.
  }

  /** Mark a hard block (used when a 429 body lacks a Retry-After). */
  blockFor(ms: number): void {
    this.updateFromHeaders({ retryAfterMs: ms });
  }

  snapshot(): RateBudgetSnapshot {
    this.prune();
    const nextFree =
      this.spends.length > 0 ? this.spends[0]!.at + this.windowMs : null;
    return {
      requestsUsed: this.usedRequests(),
      requestsRemaining: this.remainingRequests(),
      complexityUsed: this.usedComplexity(),
      complexityRemaining: this.remainingComplexity(),
      nextFreeAt: nextFree,
      blockedUntil: this.blockedUntil,
    };
  }

  /**
   * Park until one request of `complexity` points fits, or throw.
   * - `AbortedError` when `signal` fires first.
   * - `BudgetExhaustedError` when the wait would exceed `maxWaitMs`
   *   (default: wait as long as it takes — the engine prefers slow to failed).
   */
  async waitForBudget(
    complexity = 1,
    opts: { signal?: AbortSignal | undefined; maxWaitMs?: number | undefined } = {},
  ): Promise<void> {
    for (;;) {
      const wait = this.waitTimeMs(complexity);
      if (wait === Infinity) {
        throw new BudgetExhaustedError(
          `Complexity cost ${complexity} exceeds the configured hourly budget.`,
        );
      }
      if (wait <= 0) return;
      if (opts.maxWaitMs !== undefined && wait > opts.maxWaitMs) {
        throw new BudgetExhaustedError(
          `Rate budget exhausted; next capacity in ~${Math.ceil(wait / 1000)}s exceeds the caller's limit.`,
          wait,
        );
      }
      await sleep(Math.min(wait, 30_000), opts.signal);
    }
  }
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortedError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortedError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

