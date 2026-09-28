/**
 * settings.* + dataplane.probe RPC handlers (SPECS/target-architecture.md
 * §Settings model). The discipline that makes this package safe:
 *
 * - Secrets are WRITE-ONLY over RPC: apiKey/token can be set, never returned.
 *   settings.get reports `configured: true` markers only.
 * - Credential-named extra headers are refused (CWE-200): key material belongs
 *   in the write-only apiKey field.
 * - Probes read secrets server-side and report metadata only.
 */

import type { InferenceHarness, SettingsView } from "../model/settings.ts";
import type { Registry } from "../connect/server.ts";
import type { Store } from "./store.ts";
import { probeLinear } from "./linear.ts";
import { probeInference } from "./inference.ts";

type FetchImpl = typeof fetch;

const K_LINEAR_TOKEN = "linear.token";
const K_LINEAR_VIEWER = "linear.viewer";
const K_HARNESSES = "inference.harnesses";

const FORBIDDEN_HEADERS = new Set(["authorization", "x-api-key", "api-key", "proxy-authorization"]);

export class RpcError extends Error {
  code: "invalid_params" | "internal" | "not_found";
  constructor(code: "invalid_params" | "internal" | "not_found", message: string) {
    super(message);
    this.code = code;
  }
}

function readHarnesses(store: Store): InferenceHarness[] {
  const raw = store.getSetting(K_HARNESSES);
  if (!raw) return [];
  try { return JSON.parse(raw) as InferenceHarness[]; } catch { return []; }
}

function writeHarnesses(store: Store, list: InferenceHarness[]): void {
  store.setSetting(K_HARNESSES, JSON.stringify(list));
}

function settingsView(store: Store): SettingsView {
  const token = store.getSetting(K_LINEAR_TOKEN);
  const viewerRaw = store.getSetting(K_LINEAR_VIEWER);
  const viewer = viewerRaw ? (JSON.parse(viewerRaw) as { name?: string; email?: string; organization?: string; connectedAt?: string }) : {};
  return {
    linear: {
      configured: Boolean(token),
      viewerName: viewer.name,
      viewerEmail: viewer.email,
      organization: viewer.organization,
      connectedAt: viewer.connectedAt,
    },
    inference: {
      harnesses: readHarnesses(store).map((h) => {
        const { apiKey, ...rest } = h;
        return { ...rest, configured: Boolean(apiKey) };
      }),
    },
  };
}

export function createSettingsHandlers(store: Store, fetchImpl: FetchImpl = fetch): Registry {
  return {
    "settings.get": () => settingsView(store),

    "settings.setLinear": async (params) => {
      const { token } = (params ?? {}) as { token?: string };
      if (!token || typeof token !== "string") throw new RpcError("invalid_params", "token required");
      const probe = await probeLinear(token, fetchImpl);
      if (!probe.ok) throw new RpcError("invalid_params", probe.error ?? "probe failed");
      store.setSetting(K_LINEAR_TOKEN, token);
      store.setSetting(K_LINEAR_VIEWER, JSON.stringify({
        name: probe.viewer?.name,
        email: probe.viewer?.email,
        organization: probe.organization?.name,
        connectedAt: new Date().toISOString(),
      }));
      store.audit("settings.linear.connected", { viewer: probe.viewer?.name, org: probe.organization?.name });
      return { ok: true, viewer: probe.viewer, organization: probe.organization };
    },

    "settings.clearLinear": () => {
      store.setSetting(K_LINEAR_TOKEN, "");
      store.setSetting(K_LINEAR_VIEWER, "{}");
      store.audit("settings.linear.cleared", {});
      return { ok: true };
    },

    "settings.setInference": (params) => {
      const p = (params ?? {}) as { name?: string; input?: Partial<InferenceHarness> };
      if (!p.name || !p.input) throw new RpcError("invalid_params", "name and input required");
      const input = p.input;
      for (const key of Object.keys(input.extraHeaders ?? {})) {
        if (FORBIDDEN_HEADERS.has(key.toLowerCase())) {
          throw new RpcError("invalid_params", `header ${key} carries credentials; use the apiKey field`);
        }
      }
      const list = readHarnesses(store);
      if (input.name && input.name !== p.name && list.some((h) => h.name === input.name)) {
        throw new RpcError("invalid_params", `harness name already exists: ${input.name}`);
      }
      const existing = list.find((h) => h.name === p.name);
      const next: InferenceHarness = {
        name: input.name ?? p.name,
        provider: input.provider ?? existing?.provider ?? "openrouter",
        baseUrl: input.baseUrl ?? existing?.baseUrl ?? "",
        model: input.model ?? existing?.model ?? "",
        effort: input.effort ?? existing?.effort,
        extraHeaders: input.extraHeaders ?? existing?.extraHeaders,
        isDefault: input.isDefault ?? existing?.isDefault ?? list.length === 0,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        apiKey: input.apiKey ?? existing?.apiKey,
      };
      // A write-only credential belongs to the destination that received it.
      if (existing && (next.baseUrl !== existing.baseUrl || next.provider !== existing.provider)) {
        next.apiKey = input.apiKey;
      }
      if (!next.baseUrl) throw new RpcError("invalid_params", "baseUrl required");
      const rest = list.filter((h) => h.name !== p.name);
      if (next.isDefault) for (const h of rest) h.isDefault = false;
      writeHarnesses(store, [...rest, next]);
      store.audit("settings.inference.upsert", { name: next.name, provider: next.provider });
      return { ok: true, name: next.name };
    },

    "settings.deleteInference": (params) => {
      const { name } = (params ?? {}) as { name?: string };
      if (!name) throw new RpcError("invalid_params", "name required");
      const list = readHarnesses(store);
      if (!list.some((h) => h.name === name)) throw new RpcError("not_found", `no harness: ${name}`);
      writeHarnesses(store, list.filter((h) => h.name !== name));
      store.audit("settings.inference.deleted", { name });
      return { ok: true };
    },

    "settings.testInference": async (params) => {
      const { name } = (params ?? {}) as { name?: string };
      const list = readHarnesses(store);
      const h = name ? list.find((x) => x.name === name) : list.find((x) => x.isDefault) ?? list[0];
      if (!h) throw new RpcError("not_found", "no harness configured");
      if (!h.apiKey) throw new RpcError("invalid_params", `harness ${h.name} has no apiKey`);
      const result = await probeInference(h, fetchImpl);
      store.audit("settings.inference.tested", { name: h.name, ok: result.ok, latencyMs: result.latencyMs });
      return result;
    },

    "dataplane.probe": async () => {
      const token = store.getSetting(K_LINEAR_TOKEN);
      if (!token) throw new RpcError("invalid_params", "Linear not connected");
      return probeLinear(token, fetchImpl);
    },
  };
}
