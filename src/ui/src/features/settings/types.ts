/**
 * View models for the Settings feature (T-802). These mirror the server-side
 * contracts — src/inference's PublicHarness (R6) and src/connect's environment
 * descriptor (R9) — re-declared here so the UI package typechecks standalone.
 * When those packages land, this file's types become imports (identical shapes).
 */

export type InferenceProvider = "openrouter" | "openai-compatible" | "anthropic";
export type Effort = "none" | "low" | "medium" | "high";

export const PROVIDERS: readonly InferenceProvider[] = ["openrouter", "openai-compatible", "anthropic"];
export const EFFORTS: readonly Effort[] = ["none", "low", "medium", "high"];

/** Matches DEFAULT_BASE_URLS in src/inference (R6). null = user must supply one. */
export const PROVIDER_DEFAULT_BASE_URL: Readonly<Record<InferenceProvider, string | null>> = {
  openrouter: "https://openrouter.ai/api/v1",
  "openai-compatible": null,
  anthropic: "https://api.anthropic.com",
};

export const PROVIDER_LABEL: Readonly<Record<InferenceProvider, string>> = {
  openrouter: "OpenRouter",
  "openai-compatible": "OpenAI-compatible (LiteLLM / vLLM / Ollama)",
  anthropic: "Anthropic",
};

// --- Plain-http base URL rule (client mirror of the server policy) ----------
// https is always fine; http is fine for loopback hosts, and for a LAN
// (RFC1918/.local) host only when the harness opts in via allowInsecureHttp;
// public http stays blocked either way. The server re-validates on save —
// this mirror exists so the editor can explain the rule before submit.

const LOOPBACK_HOSTNAMES: readonly string[] = ["localhost", "127.0.0.1", "::1", "[::1]"];

/** RFC1918 v4 ranges and mDNS (.local) names reachable on a home network. */
function isLanHost(hostname: string): boolean {
  if (hostname.endsWith(".local")) return true;
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const first = Number(parts[0]!);
  const second = Number(parts[1]!);
  return first === 10 || first === 127 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

/**
 * The message to show when a base URL breaks the plain-http rule, else null.
 * Unparseable URLs pass here — format errors are a separate check, and the
 * server stays the authority either way.
 */
export function httpPolicyMessage(baseUrl: string, allowInsecureHttp: boolean): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol === "https:") return null;
  if (url.protocol !== "http:") return "Base URL must use http or https.";
  if (LOOPBACK_HOSTNAMES.includes(url.hostname)) return null;
  if (isLanHost(url.hostname)) {
    return allowInsecureHttp ? null : "Plain http to a LAN address needs “Allow plain http” ticked below.";
  }
  return "Plain http is only allowed for loopback or LAN addresses — use https for a public host.";
}

/** Public harness DTO — mirrors R6's PublicHarness (never carries key material). */
export interface HarnessView {
  id: string;
  name: string;
  provider: InferenceProvider;
  baseUrl: string;
  model: string;
  effort: Effort;
  extraHeaders: Record<string, string>;
  /** Opt-in: plain http to a LAN (RFC1918/.local) inference server. */
  allowInsecureHttp: boolean;
  isDefault: boolean;
  /** true when the server holds a write-only key for this harness. */
  hasApiKey: boolean;
  updatedAt: string;
}

/** Create/edit payload leaving this page. apiKey is write-only, never echoed back. */
export interface HarnessInput {
  name: string;
  provider: InferenceProvider;
  /** empty string = use provider default (error for openai-compatible) */
  baseUrl: string;
  /** empty string = leave unchanged / none */
  apiKey: string;
  model: string;
  effort: Effort;
  extraHeaders: Record<string, string>;
  /** Opt-in for http against a LAN inference server (see httpPolicyMessage). */
  allowInsecureHttp: boolean;
  makeDefault: boolean;
}

/** Result of probing a harness: model list + latency, or an error message. */
export type ProbeState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; models: string[]; latencyMs: number }
  | { kind: "error"; message: string };

/** Linear connection state — from the server's dataplane probe / viewer query. */
export interface LinearConnectionView {
  status: "disconnected" | "verifying" | "connected" | "error";
  /** Present when connected: the Linear user the token acts as. */
  user?: { name: string; email: string };
  organization?: { name: string; urlKey: string };
  /** Public-API rate budget (Linear allows ~2,500 req/h per user). */
  rateBudget?: { used: number; limit: number; resetsAt: string };
  error?: string | undefined;
}

/** T3 environment descriptor (R9, /.well-known/t3/environment). */
export interface EnvironmentDescriptorView {
  id: string;
  label: string;
  platform: string;
  capabilities: string[];
  protocol: number;
  product: string;
  version: string;
  publicUrl?: string | undefined;
}

/** One active paired session (scoped token), for the revoke list. */
export interface SessionTokenView {
  id: string;
  label: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string | undefined;
  current?: boolean;
}
