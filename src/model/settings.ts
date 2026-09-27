/**
 * Settings model (SPECS/target-architecture.md §Settings model).
 * Secrets are write-only over RPC: they can be set, never read back.
 */

export type InferenceProvider = "openrouter" | "openai-compatible" | "anthropic";

export interface InferenceHarness {
  name: string;
  provider: InferenceProvider;
  baseUrl: string;
  model: string;
  effort?: "low" | "medium" | "high";
  extraHeaders?: Record<string, string>;
  isDefault: boolean;
  createdAt: string;
  /** Never populated over RPC. Presence reported as `configured: true`. */
  apiKey?: string;
}

export interface SettingsView {
  linear: {
    configured: boolean;
    viewerName?: string;
    viewerEmail?: string;
    organization?: string;
    connectedAt?: string;
  };
  inference: {
    harnesses: Array<Omit<InferenceHarness, "apiKey"> & { configured: boolean }>;
  };
}
