/**
 * The Runner — executes runs against a Brain and streams RunEvents to
 * subscribers.
 *
 * Behavior (SPECS/agent.md §runtime-contract, SPECS/loops.md §run-view):
 * - `start` creates a run (pending) and immediately drives it: the initial
 *   exchange answers the assembled loop prompt (context assembler, T-502).
 * - Each exchange opens one agent turn; streamed parts append to it and are
 *   emitted as `partAppended` in arrival order.
 * - An `elicitation` part ends the exchange and parks the run
 *   (`awaitingInput`) until `respond`.
 * - `steer` on an active run QUEUES the user message; the queue drains
 *   between exchanges as a new user turn — the run never flickers through
 *   `complete` while a steer is pending (active→active self-transition).
 * - `cancel` is cooperative: the brain's AbortSignal fires, parts already
 *   streamed are kept, the run lands in `canceled`.
 * - `continueRun` re-activates a `complete` run with its full history
 *   (continuation — the same context plus the new message).
 *
 * Subscriptions: `subscribe(runId, listener, sinceSeq?)` replays missed
 * events from a per-run ring buffer, then delivers live events. `seq` is
 * per-run, gapless, 1-based — the T3 channel (R9) resumes on it.
 *
 * Persistence is deliberately NOT here (YAGNI): the server (T-1101)
 * subscribes and snapshots. Resume-from-store arrives with snapshots in
 * T-502.
 *
 * Original code.
 */

import { transitionRun, assertRunInvariants, IllegalRunTransitionError } from "./run-machine.ts";
import type { Brain } from "./brain.ts";
import { fromSnapshot } from "./snapshot.ts";
import type { RunSnapshot } from "./snapshot.ts";
import type {
  DistributiveOmit,
  EntityId,
  ISODateTime,
  Part,
  Run,
  RunEvent,
  RunTarget,
  Turn,
  TurnStatus,
} from "./types.ts";

/** A RunEvent before the Runner stamps it with seq/runId/at. */
type RunEventInput = DistributiveOmit<RunEvent, "seq" | "runId" | "at">;

export interface RunnerDeps {
  /** Clock — injectable for deterministic tests. Defaults to real time. */
  now?: () => Date;
  /** Id minting — injectable for deterministic tests. */
  idgen?: () => EntityId;
  /** Ring-buffer capacity per run (events kept for replay). Default 500. */
  eventBufferSize?: number;
}

export interface StartParams {
  loopId: EntityId;
  message: string;
  brain: Brain;
  target?: RunTarget | undefined;
  iteration?: number;
  conversationId?: EntityId | undefined;
  /** Preassigned run id (the server may mint it for idempotency). */
  runId?: EntityId | undefined;
}

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`unknown run: ${runId}`);
    this.name = "RunNotFoundError";
  }
}

export class RunBusyError extends Error {
  constructor(runId: string) {
    super(`run ${runId} is mid-exchange; wait for it to park or finish`);
    this.name = "RunBusyError";
  }
}

interface RunState {
  run: Run;
  turns: Turn[];
  brain: Brain | null;
  subs: Set<(event: RunEvent) => void>;
  log: RunEvent[];
  seq: number;
  steerQueue: string[];
  abort: AbortController | null;
  cancelRequested: boolean;
  driving: boolean;
  idle: Promise<Run> | null;
  idleResolve: ((run: Run) => void) | null;
}

const DEFAULT_EVENT_BUFFER = 500;

export class Runner {
  readonly #deps: Required<Omit<RunnerDeps, "eventBufferSize">> & { eventBufferSize: number };
  readonly #runs = new Map<EntityId, RunState>();

  constructor(deps?: RunnerDeps) {
    this.#deps = {
      now: deps?.now ?? (() => new Date()),
      idgen: deps?.idgen ?? (() => crypto.randomUUID()),
      eventBufferSize: deps?.eventBufferSize ?? DEFAULT_EVENT_BUFFER,
    };
  }

  /** Current snapshot of a run. Throws RunNotFoundError. */
  getRun(runId: EntityId): Run {
    return this.#state(runId).run;
  }

  /** All turns of a run, in order. Throws RunNotFoundError. */
  getTurns(runId: EntityId): readonly Turn[] {
    return this.#state(runId).turns;
  }

  /**
   * Create and start a run. Returns the run snapshot immediately (status
   * will already be `active` unless the brain parked it synchronously);
   * exchanges proceed asynchronously — watch events or await `whenIdle`.
   */
  start(params: StartParams): Run {
    const at = this.#iso();
    const run: Run = {
      id: params.runId ?? this.#deps.idgen(),
      loopId: params.loopId,
      status: "pending",
      iteration: params.iteration ?? 1,
      createdAt: at,
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    };
    if (params.target !== undefined) run.target = params.target;
    if (params.conversationId !== undefined) run.conversationId = params.conversationId;
    const state: RunState = {
      run,
      turns: [],
      brain: params.brain,
      subs: new Set(),
      log: [],
      seq: 0,
      steerQueue: [],
      abort: null,
      cancelRequested: false,
      driving: false,
      idle: null,
      idleResolve: null,
    };
    this.#runs.set(run.id, state);
    this.#emit(state, { type: "runStatus", status: run.status, run });
    this.#drive(state, params.message);
    return state.run;
  }

  /**
   * Queue a user message into an ACTIVE run. It drains between exchanges as
   * a new user turn and is passed to the brain as the next message.
   */
  steer(runId: EntityId, text: string): void {
    const state = this.#state(runId);
    if (state.run.status !== "active") {
      throw new IllegalRunTransitionError(state.run.status, "active");
    }
    state.steerQueue.push(text);
  }

  /** Answer the pending elicitation of an `awaitingInput` run. After a
   * `restore`, pass the brain — the restored run carries none. */
  respond(runId: EntityId, text: string, brain?: Brain): void {
    const state = this.#state(runId);
    if (state.run.status !== "awaitingInput") {
      throw new IllegalRunTransitionError(state.run.status, "active");
    }
    if (brain !== undefined) state.brain = brain;
    this.#appendUserTurn(state, text);
    this.#drive(state, text);
  }

  /**
   * Continue a COMPLETE run with a follow-up message: appends a user turn
   * and re-activates the run with its full history (SPECS/agent.md
   * §continuation). Requires the brain (stateless runtime, pluggable brain).
   */
  continueRun(runId: EntityId, message: string, brain: Brain): void {
    const state = this.#state(runId);
    if (state.run.status !== "complete") {
      throw new IllegalRunTransitionError(state.run.status, "active");
    }
    state.brain = brain;
    this.#appendUserTurn(state, message);
    this.#drive(state, message);
  }

  /**
   * Cooperative cancel. Active run: the brain's signal fires and the
   * exchange unwinds into `canceled` with partial parts kept. Parked or
   * queued runs transition immediately.
   */
  cancel(runId: EntityId): void {
    const state = this.#state(runId);
    const status = state.run.status;
    if (status === "complete" || status === "error" || status === "canceled") {
      throw new IllegalRunTransitionError(status, "canceled");
    }
    state.cancelRequested = true;
    if (status === "active" && state.abort !== null) {
      state.brain?.cancel?.(runId);
      state.abort.abort();
      return; // the drive loop lands the transition
    }
    this.#transition(state, "canceled");
    this.#settleIdle(state);
  }

  /**
   * Resume-from-store (T-502): re-register a run from a snapshot produced by
   * `toSnapshot` / validated by `fromSnapshot`. Mid-exchange runs come back
   * as `error: interrupted` (fromSnapshot's rule); parked runs come back
   * parked — drive them on with `respond(runId, text, brain)`.
   *
   * Event `seq` restarts at 1 for the restored run (the pre-restore stream
   * lived in the dead process's buffer); the restored run is re-emitted as a
   * `runStatus` event so persistence/subscribers see it.
   */
  restore(snapshot: RunSnapshot): Run {
    const { run, turns } = fromSnapshot(snapshot);
    if (this.#runs.has(run.id)) {
      throw new Error(`run ${run.id} is already live in this Runner`);
    }
    const state: RunState = {
      run,
      turns: [...turns],
      brain: null,
      subs: new Set(),
      log: [],
      seq: 0,
      steerQueue: [],
      abort: null,
      cancelRequested: false,
      driving: false,
      idle: null,
      idleResolve: null,
    };
    this.#runs.set(run.id, state);
    assertRunInvariants(run);
    this.#emit(state, { type: "runStatus", status: run.status, run });
    return run;
  }

  /** Fold a usage report (from the brain adapter, R6) into the run. */
  recordUsage(runId: EntityId, delta: Partial<Run["usage"]>): void {    const state = this.#state(runId);
    const u = state.run.usage;
    const usage = {
      inputTokens: u.inputTokens + (delta.inputTokens ?? 0),
      outputTokens: u.outputTokens + (delta.outputTokens ?? 0),
      costUsd: u.costUsd + (delta.costUsd ?? 0),
    };
    state.run = { ...state.run, usage };
    this.#emit(state, { type: "usage", usage });
  }

  /**
   * Resolves the next time the run leaves `active` (awaitingInput, complete,
   * error, or canceled) — the testable seam that avoids timer-based waits.
   */
  whenIdle(runId: EntityId): Promise<Run> {
    const state = this.#state(runId);
    if (state.run.status !== "active") return Promise.resolve(state.run);
    state.idle ??= new Promise<Run>((resolve) => {
      state.idleResolve = resolve;
    });
    return state.idle;
  }

  /**
   * Subscribe to a run's event stream. Replays buffered events with
   * `seq > sinceSeq` (in order), then delivers live events. Returns an
   * unsubscribe function.
   */
  subscribe(runId: EntityId, listener: (event: RunEvent) => void, sinceSeq = 0): () => void {
    const state = this.#state(runId);
    for (const event of state.log) {
      if (event.seq > sinceSeq) listener(event);
    }
    state.subs.add(listener);
    return () => {
      state.subs.delete(listener);
    };
  }

  // ---- internals -------------------------------------------------------

  #state(runId: EntityId): RunState {
    const state = this.#runs.get(runId);
    if (!state) throw new RunNotFoundError(runId);
    return state;
  }

  #iso(): ISODateTime {
    return this.#deps.now().toISOString();
  }

  #transition(state: RunState, to: Run["status"], patch?: Parameters<typeof transitionRun>[3]): void {
    state.run = transitionRun(state.run, to, this.#iso(), patch);
    assertRunInvariants(state.run);
    this.#emit(state, { type: "runStatus", status: state.run.status, run: state.run });
  }

  #emit(state: RunState, event: RunEventInput): void {
    state.seq += 1;
    const full = { ...event, seq: state.seq, runId: state.run.id, at: this.#iso() } as RunEvent;
    state.log.push(full);
    if (state.log.length > this.#deps.eventBufferSize) {
      state.log.splice(0, state.log.length - this.#deps.eventBufferSize);
    }
    for (const listener of [...state.subs]) {
      try {
        listener(full);
      } catch {
        // A throwing subscriber must never kill a run. The server-side
        // persistence subscriber (T-1101) reports its own failures.
      }
    }
  }

  #appendUserTurn(state: RunState, text: string): Turn {
    const turn = this.#openTurn(state, "user");
    const part: Part = { kind: "steered", text };
    turn.parts.push(part);
    this.#emit(state, { type: "partAppended", turnId: turn.id, part });
    this.#closeTurn(state, turn, "complete");
    return turn;
  }

  #openTurn(state: RunState, role: Turn["role"]): Turn {
    const turn: Turn = {
      id: this.#deps.idgen(),
      runId: state.run.id,
      position: state.turns.length,
      role,
      parts: [],
      status: "streaming",
      startedAt: this.#iso(),
    };
    state.turns.push(turn);
    this.#emit(state, { type: "turnStarted", turn });
    return turn;
  }

  #closeTurn(state: RunState, turn: Turn, status: TurnStatus): void {
    turn.status = status;
    turn.endedAt = this.#iso();
    this.#emit(state, { type: "turnCompleted", turnId: turn.id, status });
  }

  #settleIdle(state: RunState): void {
    if (state.run.status !== "active" && state.idleResolve !== null) {
      const resolve = state.idleResolve;
      state.idle = null;
      state.idleResolve = null;
      resolve(state.run);
    }
  }

  /**
   * One driving loop: runs exchanges until the run parks (elicitation),
   * finishes, fails, or is canceled. Reentrancy is impossible by
   * construction (respond/continueRun require non-active states) and is
   * guarded anyway.
   */
  #drive(state: RunState, message: string): void {
    if (state.driving) throw new RunBusyError(state.run.id);
    const brain = state.brain;
    if (brain === null) throw new Error(`run ${state.run.id} has no brain attached`);
    state.driving = true;
    void (async () => {
      try {
        let nextMessage = message;
        for (;;) {
          if (state.run.status !== "active") {
            this.#transition(
              state,
              "active",
              state.run.status === "awaitingInput" ? { pendingElicitation: undefined } : undefined,
            );
          }
          const history = [...state.turns];
          const turn = this.#openTurn(state, "agent");
          const abort = new AbortController();
          state.abort = abort;
          let elicited = false;
          try {
            const stream = brain.stream(
              { run: state.run, history, message: nextMessage },
              abort.signal,
            );
            for await (const part of stream) {
              // A part the brain already yielded is KEPT, even if a cancel
              // landed concurrently — cancel stops pulling, it does not
              // roll back (SPECS/agent.md: partial parts survive cancel).
              turn.parts.push(part);
              this.#emit(state, { type: "partAppended", turnId: turn.id, part });
              if (part.kind === "elicitation") {
                elicited = true;
                break; // elicitation ends the exchange; stop consuming
              }
              if (state.cancelRequested) break; // for-await calls stream.return()
            }
          } catch (err) {
            state.abort = null;
            this.#closeTurn(state, turn, "error");
            if (state.cancelRequested) {
              this.#transition(state, "canceled");
            } else {
              this.#transition(state, "error", {
                error: err instanceof Error ? err.message : String(err),
              });
            }
            return;
          }
          state.abort = null;
          this.#closeTurn(state, turn, "complete");
          if (state.cancelRequested) {
            this.#transition(state, "canceled");
            return;
          }
          if (elicited) {
            const elicitation = turn.parts[turn.parts.length - 1] as Extract<Part, { kind: "elicitation" }>;
            this.#transition(state, "awaitingInput", { pendingElicitation: elicitation });
            return;
          }
          const steered = state.steerQueue.shift();
          if (steered === undefined) {
            this.#transition(state, "complete");
            return;
          }
          // Steer-drain: the run stays active; the steer becomes the next
          // exchange's user turn — no complete→active flicker.
          this.#appendUserTurn(state, steered);
          nextMessage = steered;
        }
      } finally {
        state.driving = false;
        this.#settleIdle(state);
      }
    })().catch((err: unknown) => {
      // Defensive: the loop above handles brain errors; a throw here means a
      // runtime bug (e.g. an illegal transition). Surface it on the run
      // rather than crashing the host process.
      try {
        if (state.run.status === "active" || state.run.status === "awaitingInput") {
          this.#transition(state, "error", {
            error: `runtime fault: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } finally {
        state.driving = false;
        this.#settleIdle(state);
      }
    });
  }
}
