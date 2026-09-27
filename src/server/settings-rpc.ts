/**
 * T-1106 — the settings RPC handlers (the last unimplemented METHOD_SCOPES
 * rows) + the live dataplane binding. This is the operator gap between the
 * merged M5 code and the first REAL run: configure a Linear connection and
 * an inference harness over the wire, and the composition root's lazy
 * reader/write-back start hitting the real dataplane — no restart.
 *
 * Handlers (contract: the T-802 settings pages' view models, mirrored in
 * src/ui/src/features/settings/types.ts):
 * - settings.get {} → { linear, harnesses, environment } — STATE ONLY:
 *   the connection view carries the public viewer identity, harnesses are
 *   R6's PublicHarness, and NO payload ever contains a token, key, or
 *   secret ref (the write-only discipline, asserted in tests).
 * - settings.setLinear { token } → verify the PAT against the real
 *   dataplane (viewer round-trip — a bad token throws, that IS the
 *   verification), persist it write-only (SecretStore), and record the
 *   connection (opaque ref + public viewer data) in the settings table.
 *   Returns the connection view. Never stores an unverified token.
 * - settings.setInference { id?, input } → create (id absent) or update a
 *   harness through R6's store (zod gate → invalid_params; apiKey is
 *   accepted write-only and handed straight to the secret store).
 * - settings.testInference { id } → resolve the harness (the ONLY decrypt
 *   path) and probe the provider's model list; reports ok/models/latency
 *   or ok:false with a redacted message — probe failures are DATA for the
 *   page, not RPC errors.
 * - dataplane.probe {} → live viewer fetch through the stored credential
 *   (+ rate-budget snapshot when the transport tracks one); a stored
 *   credential that now fails reports status "error" (revocation is
 *   visible, never hidden).
 *
 * The live binding (createSettingsBinding) holds the current LinearClient:
 * built at boot from the stored connection, rebuilt on every successful
 * setLinear. The composition root's reader/write-back consult it PER CALL
 * (lazy), so configuring Linear mid-run takes effect immediately; with no
 * connection they throw "Linear not connected", which the orchestrator's
 * failure rails surface in the audit log (never a hidden no-op).
 *
 * Original code.
 */

import { RPC_ERRORS, RpcError } from "../connect/rpc.ts";
import type { ChannelServer } from "../connect/channel.ts";
import type { EnvironmentDescriptor } from "../connect/descriptor.ts";
import type { LinearClient, Viewer } from "../dataplane/client.ts";
import type { getIssue } from "../dataplane/reads.ts";
import type { createComment } from "../dataplane/writes.ts";
import type { ChatAdapter } from "../inference/src/adapters/types.ts";
import type { HarnessSettingsStore } from "../inference/src/store.ts";
import type { SecretStore } from "../inference/src/secrets.ts";
import type { HarnessSettings } from "../inference/src/settings.ts";
import { CreateHarnessInputSchema, DEFAULT_BASE_URLS, UpdateHarnessInputSchema } from "../inference/src/settings.ts";
import { SettingsValidationError } from "../inference/src/errors.ts";
import type { EntityReader } from "../runtime/context.ts";
import type { RunTarget } from "../runtime/types.ts";
import type { CommentWriter } from "./orchestrator.ts";
import { commentWriteBack } from "./orchestrator.ts";
import type { Store } from "./store.ts";

/** What the settings table holds for the Linear connection (NO secret). */
interface StoredLinearConnection {
  /** Opaque SecretStore reference for the PAT. Server-side use only. */
  ref: string;
  viewer: Viewer;
  connectedAt: string;
}

export interface LinearConnectionView {
  readonly status: "disconnected" | "connected" | "error";
  readonly user?: { name: string; email: string } | undefined;
  readonly connectedAt?: string | undefined;
  readonly error?: string | undefined;
}

/**
 * The dataplane seams. HOUSE RULE (structural, like the orchestrator's
 * WriteBackSink): this package never imports the dataplane's transport
 * graph — the dataplane is a compile-first (.js-extension) package, bound
 * by the DEPLOYMENT (start.ts binds its compiled dist; tests bind fakes).
 * When verifyLinear/linearClientFor are absent the Linear handlers answer
 * `unavailable`, and the lazy reader/write-back throw "dataplane not
 * wired" — a deployment without the binding fails visibly, never silently.
 */
export interface SettingsBindingDeps {
  readonly store: Store;
  readonly harnessStore: HarnessSettingsStore;
  readonly secretStore: SecretStore;
  readonly descriptor: EnvironmentDescriptor;
  readonly verifyLinear?: ((token: string) => Promise<Viewer>) | undefined;
  readonly linearClientFor?: ((token: string) => LinearClient) | undefined;
  readonly chatAdapterFor: (settings: HarnessSettings, apiKey: string | null) => ChatAdapter;
  /** Pass-through for the reader/write-back helpers (not used internally). */
  readonly readIssue?: typeof getIssue | undefined;
  readonly writeComment?: typeof createComment | undefined;
  readonly now?: (() => Date) | undefined;
}

export interface SettingsBinding {
  /** Registers the five handlers on the channel. */
  register(channel: ChannelServer): void;
  /** The live client, or null when Linear is not configured. */
  clientOrNull(): LinearClient | null;
  /** The current connection view (state only — never secrets). */
  connectionView(): LinearConnectionView;
}

const SETTING_KEY = "linear.connection";

function params(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

function redact(message: string, secrets: (string | null)[]): string {
  let out = message;
  for (const secret of secrets) {
    if (secret !== null && secret.length > 0) out = out.split(secret).join("[redacted]");
  }
  return out;
}

/**
 * Header names that carry credentials. Credential material belongs in the
 * write-only apiKey field (encrypted at rest, never echoed) — an
 * `authorization`/`x-api-key` entry in extraHeaders WOULD be echoed back by
 * settings.get (CWE-200), so it is refused at write time and at draft
 * probe time. Every supported provider's auth rides the apiKey field
 * already (Bearer / x-api-key set by the adapters themselves).
 * (agent-06's #128 hardening, ported.)
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

export function createSettingsBinding(deps: SettingsBindingDeps): SettingsBinding {
  const now = deps.now ?? (() => new Date());
  let currentClient: LinearClient | null = null;

  function storedConnection(): StoredLinearConnection | null {
    return deps.store.getSetting<StoredLinearConnection>(SETTING_KEY);
  }

  // Boot: a stored connection gets its live client back (decrypt server-side
  // only — the plaintext never leaves this module).
  const stored = storedConnection();
  if (stored !== null && deps.linearClientFor !== undefined && deps.secretStore.has(stored.ref)) {
    currentClient = deps.linearClientFor(deps.secretStore.get(stored.ref));
  }

  function connectionView(): LinearConnectionView {
    const conn = storedConnection();
    if (conn === null) return { status: "disconnected" };
    return {
      status: "connected",
      user: { name: conn.viewer.name, email: conn.viewer.email },
      connectedAt: conn.connectedAt,
    };
  }

  return {
    clientOrNull: () => currentClient,
    connectionView,

    register(channel: ChannelServer): void {
      channel.register("settings.get", () => ({
        linear: connectionView(),
        harnesses: deps.harnessStore.list(),
        environment: deps.descriptor,
      }));

      channel.register("settings.setLinear", async (p) => {
        const token = params(p)["token"];
        if (typeof token !== "string" || token.trim().length === 0) {
          throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "settings.setLinear needs { token }");
        }
        if (deps.verifyLinear === undefined || deps.linearClientFor === undefined) {
          throw new RpcError(RPC_ERRORS.UNAVAILABLE, "dataplane not wired (the deployment binds it — see start.ts)");
        }
        let viewer: Viewer;
        try {
          viewer = await deps.verifyLinear(token);
        } catch (error) {
          throw new RpcError(
            RPC_ERRORS.INVALID_PARAMS,
            `Linear token verification failed: ${redact(error instanceof Error ? error.message : String(error), [token])}`,
          );
        }
        // Verified — persist write-only, then record the public state.
        const ref = deps.secretStore.put(token);
        deps.store.setSetting(SETTING_KEY, { ref, viewer, connectedAt: now().toISOString() } satisfies StoredLinearConnection);
        currentClient = deps.linearClientFor(token);
        return { linear: connectionView() };
      });

      channel.register("settings.setInference", (p) => {
        const prm = params(p);
        // Ops (additive over the {id?, input} upsert shape — T-802's
        // onDelete/onSetDefault intents; agent-06's #128 delta): absent op
        // means upsert, exactly as before.
        const op = prm["op"] ?? "upsert";
        const id = prm["id"];
        if (id !== undefined && (typeof id !== "string" || id.length === 0)) {
          throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "settings.setInference id must be a non-empty string when present");
        }
        if (op === "delete" || op === "setDefault") {
          if (id === undefined) {
            throw new RpcError(RPC_ERRORS.INVALID_PARAMS, `settings.setInference ${String(op)} needs { id }`);
          }
          try {
            if (op === "delete") {
              if (!deps.harnessStore.remove(id)) {
                throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown harness: ${id}`);
              }
              return { ok: true, harnesses: deps.harnessStore.list() };
            }
            return { harness: deps.harnessStore.setDefault(id) };
          } catch (error) {
            if (error instanceof RpcError) throw error;
            if (error instanceof Error && error.message.includes("not found")) {
              throw new RpcError(RPC_ERRORS.NOT_FOUND, error.message);
            }
            throw error;
          }
        }
        if (op !== "upsert") {
          throw new RpcError(RPC_ERRORS.INVALID_PARAMS, 'settings.setInference needs { op: "upsert" | "delete" | "setDefault" }');
        }
        try {
          assertNoCredentialHeaders(prm["input"] ?? prm);
          if (id !== undefined) {
            const input = UpdateHarnessInputSchema.parse(prm["input"] ?? prm);
            return { harness: deps.harnessStore.update(id, input) };
          }
          const input = CreateHarnessInputSchema.parse(prm["input"] ?? prm);
          return { harness: deps.harnessStore.create(input) };
        } catch (error) {
          if (error instanceof RpcError) throw error;
          if (error instanceof SettingsValidationError || (error instanceof Error && error.name === "ZodError")) {
            throw new RpcError(RPC_ERRORS.INVALID_PARAMS, error.message);
          }
          if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
            // The store's name UNIQUE gate surfaces as a raw sqlite error —
            // the wire deserves invalid_params (agent-06's #128 hardening).
            throw new RpcError(RPC_ERRORS.INVALID_PARAMS, "a harness with that name already exists");
          }
          throw error;
        }
      });

      channel.register("settings.testInference", async (p) => {
        const prm = params(p);
        let settings: HarnessSettings;
        let apiKey: string | null;
        if (typeof prm["id"] === "string" && prm["id"].length > 0) {
          const id = prm["id"];
          const harness = deps.harnessStore.get(id);
          if (harness === null) throw new RpcError(RPC_ERRORS.NOT_FOUND, `unknown harness: ${id}`);
          // resolveForAdapter is the ONLY decrypt path (secrets.ts house rule).
          ({ settings, apiKey } = deps.harnessStore.resolveForAdapter(id));
        } else {
          // Draft probe (T-802's onProbeModels on an UNSAVED draft — agent-06's
          // #128 delta): validate like a create, build in-memory only — the
          // draft key never touches the DB.
          assertNoCredentialHeaders(prm["draft"]);
          const parsed = CreateHarnessInputSchema.safeParse(prm["draft"]);
          if (!parsed.success) {
            throw new RpcError(RPC_ERRORS.INVALID_PARAMS, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
          }
          const draft = parsed.data;
          const baseUrl = draft.baseUrl ?? DEFAULT_BASE_URLS[draft.provider];
          if (baseUrl === null) {
            throw new RpcError(RPC_ERRORS.INVALID_PARAMS, `baseUrl is required for provider "${draft.provider}"`);
          }
          settings = {
            id: "draft",
            name: draft.name,
            provider: draft.provider,
            baseUrl,
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
        const started = now().getTime();
        try {
          const adapter = deps.chatAdapterFor(settings, apiKey);
          const models = await adapter.listModels();
          return {
            ok: true,
            models: models.map((m) => m.id).slice(0, 50),
            latencyMs: now().getTime() - started,
          };
        } catch (error) {
          return {
            ok: false,
            error: redact(error instanceof Error ? error.message : String(error), [apiKey]),
          };
        }
      });

      channel.register("dataplane.probe", async () => {
        const conn = storedConnection();
        if (conn === null || currentClient === null) return { linear: { status: "disconnected" } };
        try {
          const viewer = await currentClient.verifyAuth();
          return {
            linear: {
              status: "connected",
              user: { name: viewer.name, email: viewer.email },
              rateBudget: currentClient.rateBudget() ?? undefined,
            },
          };
        } catch (error) {
          // A stored credential that now fails (revoked/expired) surfaces.
          // Dataplane errors never contain the credential (their own
          // discipline — the transport redacts it), so the message is safe.
          return {
            linear: {
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            },
          };
        }
      });
    },
  };
}

/**
 * The composition root's lazy dataplane reader: resolves the client PER
 * CALL so a mid-run setLinear takes effect with no restart. Throws visibly
 * when Linear is not configured or the deployment bound no read function
 * (the runtime's EntityReader contract: dataplane errors PROPAGATE and
 * fail the run loudly).
 */
export function dataplaneEntityReader(binding: SettingsBinding, readIssue?: typeof getIssue): EntityReader {
  return {
    readEntity: async (target: RunTarget) => {
      const client = binding.clientOrNull();
      if (client === null) throw new Error("Linear is not connected (Settings → Connect Linear)");
      if (readIssue === undefined) throw new Error("dataplane reads not wired (the deployment binds them)");
      const issue = await readIssue(client, target.id);
      if (issue === null) throw new Error(`issue not found: ${target.id}`);
      return {
        title: `${issue.identifier}: ${issue.title}`,
        description: issue.description ?? undefined,
        url: issue.url,
      };
    },
  };
}

/** The composition root's lazy write-back sink (same per-call binding). */
export function dataplaneWriteBack(binding: SettingsBinding, writeComment?: typeof createComment) {
  const writer: CommentWriter = {
    createComment: async (input) => {
      const client = binding.clientOrNull();
      if (client === null) throw new Error("Linear is not connected (Settings → Connect Linear)");
      if (writeComment === undefined) throw new Error("dataplane writes not wired (the deployment binds them)");
      const result = await writeComment(client, input);
      return { id: result.value.id, url: result.value.url ?? null, deduplicated: result.deduplicated };
    },
  };
  return commentWriteBack(writer);
}
