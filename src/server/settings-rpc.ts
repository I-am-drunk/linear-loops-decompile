/**
 * settings.* inference RPC handlers (T-606 — the R6 settings seam).
 *
 * The channel's METHOD_SCOPES has named settings.get / settings.setInference
 * / settings.testInference since T-902 ("settings.* … are registered by the
 * composition root") — nothing implemented them until this file, and the
 * T-802 settings UI is fixture-driven until the live wiring (R8 follow-up)
 * consumes exactly these shapes.
 *
 * Contract (SPECS/target-architecture.md §settings + the T-802 page's
 * intents — onSave/onDelete/onSetDefault/onProbeModels/onTest):
 * - settings.get {} → { inference: { harnesses: PublicHarness[], defaultId },
 *   linear: <status seam> } — harness DTOs are PUBLIC (hasApiKey only; a
 *   stored key can never be echoed — secrets.ts house rule).
 * - settings.setInference { op: "upsert", id?, input } — create (id absent)
 *   or update; { op: "delete" | "setDefault", id }. Every mutation answers
 *   the fresh { harnesses, defaultId } — one round trip, no stale UI.
 *   The store's zod gate is the only validator (→ invalid_params); unknown
 *   ids → not_found.
 * - settings.testInference { id } → probe the SAVED harness's model list
 *   (resolveForAdapter is the only decrypt path; the plaintext goes
 *   straight into the adapter and is never stored/logged here);
 *   { draft } → probe an UNSAVED editor draft: the draft's plaintext key
 *   builds the adapter for this call only and never touches the DB.
 *   A failed probe is a RESULT ({ ok: false, error, latencyMs }), not an
 *   RPC error — the page's Test button reports it inline.
 * - settings.setLinear is the dataplane half (agent-08/R8's seam) and is
 *   deliberately NOT registered here; settings.get's linear section reads
 *   an injected status seam and defaults to { connected: false }.
 *
 * Layering: same house rule as rpcs.ts — the channel arrives structurally
 * (DomainChannel), the single connect import is the rpc.ts error leaf.
 * Original code.
 */

import { RPC_ERRORS, RpcError } from "../connect/rpc.ts";
import {
  CreateHarnessInputSchema,
  DEFAULT_BASE_URLS,
  createChatAdapter,
  formatZodIssues,
  HarnessNotFoundError,
  SettingsValidationError,
  type CreateHarnessInput,
  type HarnessSettings,
  type ModelInfo,
  type PublicHarness,
  type UpdateHarnessInput,
} from "../inference/src/index.ts";
import type { HarnessSettingsStore } from "../inference/src/index.ts";
import type { DomainChannel } from "./rpcs.ts";
import { StoreValidationError } from "./store.ts";

export interface SettingsRpcDeps {
  harnessStore: HarnessSettingsStore;
  /** Linear-side status for settings.get (agent-08 wires the real one). */
  linearStatus?: (() => unknown) | undefined;
  /** Probe fetch seam (tests); production leaves it the global fetch. */
  fetchFn?: typeof fetch | undefined;
  now?: (() => Date) | undefined;
}

interface InferenceView {
  harnesses: readonly PublicHarness[];
  defaultId: string | null;
}

function inferenceView(store: HarnessSettingsStore): InferenceView {
  return { harnesses: store.list(), defaultId: store.getDefault()?.id ?? null };
}

function asParams(params: unknown, method: string): Record<string, unknown> {
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    throw new RpcError(RPC_ERRORS.INVALID_PARAMS, `${method} needs a params object`);
  }
  return params as Record<string, unknown>;
}

function mapStoreError(error: unknown): never {
  if (error instanceof StoreValidationError || error instanceof SettingsValidationError) {
    throw new RpcError(RPC_ERRORS.INVALID_PARAMS, error.message);
  }
  if (error instanceof HarnessNotFoundError) {
    throw new RpcError(RPC_ERRORS.NOT_FOUND, error.message);
  }
  if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
    // The store's name UNIQUE gate surfaces as a raw sqlite error — the wire
    // deserves invalid_params, not a generic internal error.
    throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "a harness with that name already exists");
  }
  throw error;
}

/**
 * Header names that carry credentials. Credential material belongs in the
 * write-only apiKey field (encrypted at rest, never echoed) — an
 * `authorization`/`x-api-key` entry in extraHeaders WOULD be echoed back by
 * settings.get (CWE-200), so it is rejected at write time and at draft
 * probe time. Every supported provider's auth rides the apiKey field
 * already (Bearer / x-api-key set by the adapters themselves).
 */
const CREDENTIAL_HEADER_NAMES: ReadonlySet<string> = new Set([
  "authorization",
  "x-api-key",
  "api-key",
  "apikey",
  "proxy-authorization",
]);

function assertNoCredentialHeaders(input: unknown): void {
  const headers = (input as { extraHeaders?: unknown } | null)?.extraHeaders;
  if (typeof headers !== "object" || headers === null) return;
  for (const name of Object.keys(headers as Record<string, unknown>)) {
    if (CREDENTIAL_HEADER_NAMES.has(name.toLowerCase())) {
      throw new RpcError(
        RPC_ERRORS.INVALID_PARAMS,
        `extraHeaders."${name}" carries credentials — use the write-only apiKey field (credentials are never echoed)`,
      );
    }
  }
}

/** Scrub a secret out of an error string before it crosses the wire. */
function redact(text: string, secret: string | null): string {
  if (secret === null || secret === "") return text;
  return text.split(secret).join("***");
}

export interface ProbeResult {
  ok: boolean;
  models?: ModelInfo[];
  latencyMs: number;
  error?: string;
}

/** Registers settings.get / settings.setInference / settings.testInference. */
export function registerSettingsRpcs(channel: DomainChannel, deps: SettingsRpcDeps): string[] {
  const store = deps.harnessStore;
  const now = deps.now ?? (() => new Date());

  channel.register("settings.get", () => ({
    inference: inferenceView(store),
    linear: deps.linearStatus?.() ?? { connected: false },
  }));

  channel.register("settings.setInference", (params) => {
    const p = asParams(params, "settings.setInference");
    const op = p["op"];
    try {
      if (op === "upsert") {
        const input = p["input"];
        if (input === undefined || typeof input !== "object" || input === null) {
          throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "settings.setInference upsert needs { input }");
        }
        assertNoCredentialHeaders(input);
        const id = p["id"];
        if (id !== undefined && (typeof id !== "string" || id.length === 0)) {
          throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "settings.setInference id must be a non-empty string when present");
        }
        if (id === undefined) store.create(input as CreateHarnessInput);
        else store.update(id, input as UpdateHarnessInput);
      } else if (op === "delete") {
        const id = p["id"];
        if (typeof id !== "string" || id.length === 0) {
          throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "settings.setInference delete needs { id }");
        }
        if (!store.remove(id)) throw new HarnessNotFoundError(id);
      } else if (op === "setDefault") {
        const id = p["id"];
        if (typeof id !== "string" || id.length === 0) {
          throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "settings.setInference setDefault needs { id }");
        }
        store.setDefault(id);
      } else {
        throw new RpcError(
          RPC_ERRORS.INVALID_PARAMS,
          'settings.setInference needs { op: "upsert" | "delete" | "setDefault" }',
        );
      }
    } catch (error) {
      mapStoreError(error);
    }
    return inferenceView(store);
  });

  channel.register("settings.testInference", async (params): Promise<ProbeResult> => {
    const p = asParams(params, "settings.testInference");
    let settings: HarnessSettings;
    let apiKey: string | null;
    if (typeof p["id"] === "string" && p["id"].length > 0) {
      try {
        ({ settings, apiKey } = store.resolveForAdapter(p["id"]));
      } catch (error) {
        mapStoreError(error);
      }
    } else {
      // Draft probe: validate exactly like a create (honest editor errors),
      // build in-memory only — the draft key never touches the DB.
      assertNoCredentialHeaders(p["draft"]);
      const parsed = CreateHarnessInputSchema.safeParse(p["draft"]);
      if (!parsed.success) {
        throw new RpcError(RPC_ERRORS.INVALID_PARAMS, formatZodIssues(parsed.error).join("; "));
      }
      const draft = parsed.data;
      settings = {
        id: "draft",
        name: draft.name,
        provider: draft.provider,
        baseUrl: draft.baseUrl ?? DEFAULT_BASE_URLS[draft.provider] ?? "",
        apiKeyRef: null,
        model: draft.model,
        effort: draft.effort,
        extraHeaders: draft.extraHeaders,
        allowInsecureHttp: draft.allowInsecureHttp,
        isDefault: false,
        createdAt: now().toISOString(),
        updatedAt: now().toISOString(),
      };
      apiKey = draft.apiKey ?? null;
    }
    const adapter = createChatAdapter({
      settings,
      apiKey,
      ...(deps.fetchFn !== undefined ? { fetchFn: deps.fetchFn } : {}),
    });
    const started = Date.now();
    try {
      const models = await adapter.listModels();
      return { ok: true, models, latencyMs: Date.now() - started };
    } catch (error) {
      // A failed probe is a result, not an RPC fault — the page reports it.
      // The error text is scrubbed first: a provider that quotes the request
      // (or its own auth failure detail) must never hand the key back (CWE-200).
      const raw = error instanceof Error ? error.message : String(error);
      return { ok: false, latencyMs: Date.now() - started, error: redact(raw, apiKey) };
    }
  });

  return ["settings.get", "settings.setInference", "settings.testInference"];
}
