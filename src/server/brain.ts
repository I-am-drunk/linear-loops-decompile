/**
 * Brain binding (T-1105, R6) — the composition-root half of the M5 brain
 * path: persisted harness settings → real ChatAdapter → HarnessBrain,
 * injected into the orchestrator as `brainFor(loop)`.
 *
 * Why this exists: the runtime's HarnessBrain (T-1201) is deliberately
 * STRUCTURAL — it knows the adapter's shape, never the inference package —
 * and the T-1102 orchestrator takes `brainFor` as an injected dependency
 * ("the composition root binds R6's harness here"). This module is that
 * binding, constructed once at server boot: HarnessSettingsStore (PR #47,
 * write-only secrets) resolves the default harness and decrypts its key
 * internally, createChatAdapter builds the provider adapter, and
 * HarnessBrain wraps it with the usage rail folded straight into
 * runner.recordUsage — the T-1101 persistence bridge mirrors those usage
 * events into run snapshots, which is the live rail M5's UI reads.
 *
 * Failure semantics (brain.ts contract): configuration problems the user
 * can act on (no harness configured yet, an undecryptable key) yield ONE
 * error part and end the exchange cleanly — they never throw out of
 * brainFor and crash the orchestrator's run-start path. Provider call
 * failures (HTTP/auth/rate-limit) throw from the stream and fail the run —
 * honest status over partial output.
 *
 * Scope line: the durable per-day UsageLedger rail is M6 budget work
 * (PLAN.md); `onUsage` below is the seam it attaches to. Per-loop harness
 * pinning arrives when LoopConfig grows a harness field; v1 always resolves
 * the installation default harness (the loop argument is intentionally
 * unused).
 *
 * Original code.
 */

import { randomBytes } from "node:crypto";

import type { Brain, BrainInput } from "../runtime/brain.ts";
import { HarnessBrain } from "../runtime/harness-brain.ts";
import type { Part } from "../runtime/types.ts";
import type { Runner } from "../runtime/runner.ts";
import type { WorkflowDefinition } from "../model/loop.ts";
import {
  createChatAdapter,
  HarnessSettingsStore,
  SqliteSecretStore,
  loadMasterKey,
  type ChatAdapter,
  type SecretStore,
} from "../inference/src/index.ts";
import type { Database } from "./db.ts";

// ---------------------------------------------------------------------------
// Store construction (server boot)
// ---------------------------------------------------------------------------

export interface InferenceStores {
  harnessStore: HarnessSettingsStore;
  secretStore: SecretStore;
}

/**
 * Open the inference stores over the server's database. The master key
 * follows secrets.ts's installation pattern (LOOPS_SECRET_KEY env, else a
 * 0600 file beside the database) — except for ":memory:" databases, where
 * an ephemeral key is generated instead: in-memory secrets live and die
 * with the process, and tests must never write key material to disk.
 */
export function createInferenceStores(db: Database, dbPath: string): InferenceStores {
  const masterKey = dbPath === ":memory:" ? randomBytes(32) : loadMasterKey(dbPath);
  const secretStore = new SqliteSecretStore(db, masterKey);
  return { harnessStore: new HarnessSettingsStore(db, secretStore), secretStore };
}

// ---------------------------------------------------------------------------
// Config-error brain (actionable failures surface IN the run, not as throws)
// ---------------------------------------------------------------------------

/**
 * A brain that reports one actionable configuration error and ends. Used
 * when no usable harness exists: the run is created, carries the message in
 * its visible history, and ends — the user sees exactly what to fix in the
 * run view instead of a bare failed-to-start audit line.
 */
class ConfigErrorBrain implements Brain {
  readonly #message: string;

  constructor(message: string) {
    this.#message = message;
  }

  async *stream(_input: BrainInput, _signal: AbortSignal): AsyncIterable<Part> {
    yield { kind: "error", message: this.#message };
  }
}

// ---------------------------------------------------------------------------
// brainFor factory
// ---------------------------------------------------------------------------

export interface BrainBindingOptions {
  harnessStore: HarnessSettingsStore;
  runner: Runner;
  /**
   * Test seam: the fetch the provider adapters call. Production wiring
   * leaves this unset (global fetch). Never use it to bypass fixtures in
   * tests — real provider calls from tests are forbidden (PLAN.md).
   */
  fetchFn?: typeof fetch;
}

/**
 * Build the orchestrator's `brainFor(loop)`. The adapter is built fresh on
 * every call: construction is trivial (an object plus a header closure),
 * and resolving per call means a settings update — key rotation, model
 * change — takes effect on the very next run with no cache-invalidation
 * edge cases (an updatedAt-stamped cache can serve a stale adapter when two
 * updates land inside one millisecond — CodeRabbit on #92).
 */
export function createBrainFor(
  options: BrainBindingOptions,
): (loop: WorkflowDefinition) => Brain {
  const wrap = (adapter: ChatAdapter): Brain =>
    new HarnessBrain(adapter, {
      onUsage: (runId, delta) => options.runner.recordUsage(runId, delta),
    });

  return (loop) => {
    void loop; // v1: always the installation default harness (see header).
    const harness = options.harnessStore.getDefault();
    if (harness === null) {
      return new ConfigErrorBrain(
        "No inference harness is configured — add one under Settings → Inference to run loops.",
      );
    }
    try {
      // resolveForAdapter is the ONLY code path that may decrypt a key
      // (secrets.ts house rule); the plaintext goes straight into the
      // adapter and is never stored or logged here.
      const { settings, apiKey } = options.harnessStore.resolveForAdapter(harness.id);
      return wrap(
        createChatAdapter({
          settings,
          apiKey,
          ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
        }),
      );
    } catch (error) {
      return new ConfigErrorBrain(
        `Harness "${harness.name}" cannot be used: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };
}
