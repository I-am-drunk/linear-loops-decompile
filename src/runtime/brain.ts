/**
 * The Brain seam — the pluggable AI backend the runtime drives.
 *
 * The runtime knows NOTHING about providers. Three backends are planned
 * behind this one contract:
 *
 * 1. `UserHarnessBrain` (R6, src/inference) — the user's own inference:
 *    OpenRouter / OpenAI-compatible (LiteLLM, vLLM, Ollama) / Anthropic,
 *    SSE normalized to Parts.
 * 2. `LinearAgentApiBrain` (golden goose track B, issue #14) — Linear's
 *    public Agent Sessions API; activities map 1:1 onto our Part kinds.
 * 3. `LinearClientChatBrain` (golden goose track A, issue #14) — driving
 *    Linear's own agent chat as the brain; receives via the sync socket's
 *    streamData frames.
 *
 * Contract rules the RUNTIME relies on (implementors: read carefully):
 * - `stream` yields Parts in display order. Yielding an `elicitation` part
 *   ENDS the exchange: the runtime parks the run in `awaitingInput` and
 *   stops consuming the iterator (a well-behaved brain returns right after
 *   yielding one).
 * - Cancel is cooperative: the runtime aborts `signal`; the brain should
 *   stop promptly. Parts already yielded are KEPT (partial work survives
 *   cancel) — never throw just because the signal fired; returning early is
 *   the clean exit.
 * - `stream` may throw to fail the run (status → error). Prefer yielding an
 *   `error` part for failures the user can act on.
 *
 * Original code. SPECS/agent.md §runtime-contract is the behavior source.
 */

import type { Run, Part, Turn } from "./types.ts";

/** Everything a brain needs for one exchange (one turn's worth of work). */
export interface BrainInput {
  /** The run being executed (status is `active` for the duration). */
  readonly run: Run;
  /**
   * Full turn history of the run, oldest first, all completed. Brains use
   * this to reconstruct conversation context (R5's context assembler,
   * T-502, pre-flattens the loop prompt + entity context into `message`).
   */
  readonly history: readonly Turn[];
  /**
   * The message this exchange answers: the assembled loop prompt for the
   * first exchange; the steered text / elicitation answer / follow-up for
   * later ones.
   */
  readonly message: string;
}

export interface Brain {
  /**
   * Run one exchange: consume `input`, yield Parts until the response is
   * done or an elicitation is yielded. The returned iterator must tolerate
   * `return()` being called early (the runtime stopping consumption after
   * an elicitation or during teardown).
   */
  stream(input: BrainInput, signal: AbortSignal): AsyncIterable<Part>;

  /**
   * Best-effort hard stop for any in-flight stream of `runId`, in addition
   * to the AbortSignal. Implementations without extra state may no-op.
   */
  cancel?(runId: string): void;
}

/**
 * A brain for tests and plumbing demos: plays back scripted exchanges.
 * Each call to `stream` consumes the next scripted exchange; extra calls
 * yield nothing. `onStream` observes the inputs (tests assert on history).
 */
export class ScriptBrain implements Brain {
  readonly seen: BrainInput[] = [];
  #exchanges: (readonly Part[])[];
  constructor(exchanges: (readonly Part[])[]) {
    this.#exchanges = exchanges;
  }
  async *stream(input: BrainInput, _signal: AbortSignal): AsyncIterable<Part> {
    this.seen.push(input);
    const parts = this.#exchanges.shift() ?? [];
    for (const part of parts) {
      if (_signal.aborted) return;
      yield part;
    }
  }
}
