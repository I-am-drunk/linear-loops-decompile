/**
 * Harness settings schema — the persisted shape of one inference connection
 * ("Connect inference" in the target architecture).
 *
 * A harness is a named bundle of: which provider to talk to, where its API
 * lives, which model to run, how hard it should think, and any extra HTTP
 * headers the provider wants. The API key is NEVER part of this record: the
 * row carries only an opaque `apiKeyRef` pointing into the secret store
 * (see secrets.ts), and the public DTO carries only `hasApiKey: boolean`.
 *
 * Multiple named harnesses may exist; a loop names one or falls back to the
 * single default (`isDefault`).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Inference providers supported in v1. */
export const PROVIDERS = ["openrouter", "openai-compatible", "anthropic"] as const;

export const InferenceProviderSchema = z.enum(PROVIDERS);
export type InferenceProvider = z.infer<typeof InferenceProviderSchema>;

/**
 * Base URL used when a harness of this provider is created without an
 * explicit one. `openai-compatible` intentionally has none: it covers
 * user-run LiteLLM / vLLM / Ollama endpoints whose address we cannot guess.
 */
export const DEFAULT_BASE_URLS: Readonly<Record<InferenceProvider, string | null>> = {
  openrouter: "https://openrouter.ai/api/v1",
  "openai-compatible": null,
  anthropic: "https://api.anthropic.com",
};

// ---------------------------------------------------------------------------
// Effort
// ---------------------------------------------------------------------------

/**
 * Normalized "how hard should the model think" knob, mirroring the
 * `{ model, effort }` preference pair used across the product. Adapters map
 * this onto provider-specific parameters (e.g. a reasoning-effort field or a
 * thinking-token budget); `none` means "do not send any effort parameter".
 */
export const EFFORT_LEVELS = ["none", "low", "medium", "high"] as const;

export const EffortSchema = z.enum(EFFORT_LEVELS);
export type Effort = z.infer<typeof EffortSchema>;

export const DEFAULT_EFFORT: Effort = "medium";

// ---------------------------------------------------------------------------
// Field schemas
// ---------------------------------------------------------------------------

/** Hostnames for which plain http:// is acceptable (local inference servers). */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** RFC1918 ranges / mDNS names reachable on a home LAN (Ollama next door). */
function isPrivateHost(hostname: string): boolean {
  if (LOOPBACK_HOSTS.has(hostname) || hostname.endsWith(".local")) return true;
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * Plain-http policy (agent-09 review): https is always fine; http is fine
 * for loopback always, and for RFC1918/.local LAN hosts only when the
 * harness explicitly opts in via `allowInsecureHttp` — the classic
 * Ollama/vLLM-on-another-machine setup. Public http stays blocked either way.
 * Returns the validation message on rejection, null when allowed.
 */
export function checkHttpPolicy(baseUrl: string, allowInsecureHttp: boolean): string | null {
  const url = new URL(baseUrl);
  if (url.protocol === "https:") return null;
  if (url.protocol !== "http:") return "baseUrl must use http or https";
  if (LOOPBACK_HOSTS.has(url.hostname)) return null;
  if (allowInsecureHttp && isPrivateHost(url.hostname)) return null;
  return allowInsecureHttp
    ? "insecure http baseUrl must point at a loopback, RFC1918, or .local host"
    : "baseUrl must use https, or http only for loopback hosts — set allowInsecureHttp: true for a LAN (RFC1918/.local) inference server";
}

/**
 * Base URL of the provider API. Syntactic checks only (valid http(s) URL,
 * trailing slashes stripped so adapters can concatenate paths); the
 * plain-http policy lives in checkHttpPolicy, applied by the object schemas
 * where `allowInsecureHttp` is visible.
 */
export const BaseUrlSchema = z
  .string()
  .trim()
  .max(300)
  .url("baseUrl must be a valid URL")
  .transform((u) => u.replace(/\/+$/, ""))
  .refine(
    (u) => {
      const url = new URL(u);
      return url.protocol === "https:" || url.protocol === "http:";
    },
    { message: "baseUrl must use http or https" },
  );

/** RFC 7230 token — a legal HTTP header name. */
export const HeaderNameSchema = z
  .string()
  .regex(
    /^[!#$%&'*+\-.^_`|~0-9A-Za-z]{1,128}$/,
    "invalid HTTP header name",
  );

/**
 * Headers an adapter sets itself (agent-09 review): a user-supplied copy
 * would silently fight the adapter's own auth/transport, so reject them.
 */
const FORBIDDEN_EXTRA_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "host",
  "content-length",
]);

export const ExtraHeadersSchema = z
  .record(HeaderNameSchema, z.string().max(1024))
  .refine(
    (h) => !Object.keys(h).some((k) => FORBIDDEN_EXTRA_HEADERS.has(k.toLowerCase())),
    {
      message:
        "extraHeaders may not override adapter-managed headers (authorization, x-api-key, host, content-length)",
    },
  )
  .refine((h) => Object.keys(h).length <= 32, {
    message: "at most 32 extra headers",
  });

/** Harness display name, unique per installation (case-insensitive). */
export const HarnessNameSchema = z.string().trim().min(1).max(80);

/** Default model identifier, e.g. "anthropic/claude-sonnet-4" (OpenRouter) or "gpt-5.5". */
export const ModelIdSchema = z.string().trim().min(1).max(200);

/**
 * Opaque reference into the secret store. It is not the key, cannot be
 * reversed into the key, and is safe to keep in the settings table — but it
 * is still never exposed outside the server (the public DTO omits it).
 */
export const ApiKeyRefSchema = z.string().min(1).max(128);

// ---------------------------------------------------------------------------
// Stored record
// ---------------------------------------------------------------------------

/**
 * Raw object shape of a row in `harness_settings` — kept separate so the
 * public DTO can `.omit` from it (zod cannot omit from a superRefined
 * schema). Validate stored records with HarnessSettingsSchema, which adds
 * the cross-field http policy.
 */
const HarnessSettingsObject = z.object({
    id: z.string().min(1),
    name: HarnessNameSchema,
    provider: InferenceProviderSchema,
    baseUrl: BaseUrlSchema,
    apiKeyRef: ApiKeyRefSchema.nullable(),
    model: ModelIdSchema,
    effort: EffortSchema,
    extraHeaders: ExtraHeadersSchema,
    /** Opt-in: allow plain http to a LAN (RFC1918/.local) inference server. */
    allowInsecureHttp: z.boolean(),
    isDefault: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  });

/** Shape of a row in `harness_settings` (after defaults are applied). */
export const HarnessSettingsSchema = HarnessSettingsObject.superRefine((s, ctx) => {
  const issue = checkHttpPolicy(s.baseUrl, s.allowInsecureHttp);
  if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["baseUrl"], message: issue });
});
export type HarnessSettings = z.infer<typeof HarnessSettingsSchema>;

// ---------------------------------------------------------------------------
// Public DTO — the only shape that may leave the server
// ---------------------------------------------------------------------------

/**
 * What the UI / connect RPCs are allowed to see: everything except the key
 * material. `hasApiKey` lets the settings page show "key stored ✓" without
 * ever echoing the key or even its ref. Write-only, never echoed.
 */
export const PublicHarnessSchema = HarnessSettingsObject.omit({
  apiKeyRef: true,
}).extend({
  hasApiKey: z.boolean(),
});
export type PublicHarness = z.infer<typeof PublicHarnessSchema>;

// ---------------------------------------------------------------------------
// Write inputs
// ---------------------------------------------------------------------------

/** Input for creating a harness. `baseUrl` falls back to the provider default. */
export const CreateHarnessInputSchema = z
  .object({
    name: HarnessNameSchema,
    provider: InferenceProviderSchema,
    baseUrl: BaseUrlSchema.optional(),
    /**
     * Plaintext API key, accepted on write only. It is handed straight to the
     * secret store and never persisted in (or returned from) this module.
     * Optional because loopback-only local servers may not need a key.
     */
    apiKey: z.string().min(1).max(1024).optional(),
    model: ModelIdSchema,
    effort: EffortSchema.default(DEFAULT_EFFORT),
    extraHeaders: ExtraHeadersSchema.default({}),
    /** Opt-in for http against a LAN inference server (see checkHttpPolicy). */
    allowInsecureHttp: z.boolean().default(false),
    /** If true, this harness becomes the installation default. */
    makeDefault: z.boolean().default(false),
  })
  .superRefine((input, ctx) => {
    if (input.baseUrl === undefined && DEFAULT_BASE_URLS[input.provider] === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseUrl"],
        message: `baseUrl is required for provider "${input.provider}" (no known default)`,
      });
    }
    if (input.baseUrl !== undefined) {
      const issue = checkHttpPolicy(input.baseUrl, input.allowInsecureHttp);
      if (issue) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["baseUrl"], message: issue });
      }
    }
  });
export type CreateHarnessInput = z.input<typeof CreateHarnessInputSchema>;

/**
 * Input for patching a harness. `apiKey` present rotates the key;
 * `clearApiKey: true` removes the stored key; neither leaves it untouched.
 */
export const UpdateHarnessInputSchema = z
  .object({
    name: HarnessNameSchema.optional(),
    provider: InferenceProviderSchema.optional(),
    baseUrl: BaseUrlSchema.optional(),
    apiKey: z.string().min(1).max(1024).optional(),
    clearApiKey: z.boolean().default(false),
    model: ModelIdSchema.optional(),
    effort: EffortSchema.optional(),
    extraHeaders: ExtraHeadersSchema.optional(),
    allowInsecureHttp: z.boolean().optional(),
    makeDefault: z.boolean().optional(),
  })
  .refine((input) => !(input.apiKey !== undefined && input.clearApiKey), {
    message: "cannot set apiKey and clearApiKey in the same update",
    path: ["apiKey"],
  });
export type UpdateHarnessInput = z.input<typeof UpdateHarnessInputSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten a zod error into human-readable one-liners for SettingsValidationError. */
export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${where}: ${issue.message}`;
  });
}

