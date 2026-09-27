/** Dev fixtures — used by the registry until the R9 connect channel lands. */
import type {
  EnvironmentDescriptorView,
  HarnessView,
  LinearConnectionView,
  SessionTokenView,
} from "./types.ts";

export const demoLinearConnected: LinearConnectionView = {
  status: "connected",
  user: { name: "Jae", email: "jae@example.com" },
  organization: { name: "Acme", urlKey: "acme" },
  rateBudget: { used: 212, limit: 2500, resetsAt: "2026-09-27T00:00:00Z" },
};

export const demoLinearDisconnected: LinearConnectionView = { status: "disconnected" };

export const demoHarnesses: readonly HarnessView[] = [
  {
    id: "h1",
    name: "OpenRouter main",
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4",
    effort: "medium",
    extraHeaders: {},
    allowInsecureHttp: false,
    isDefault: true,
    hasApiKey: true,
    updatedAt: "2026-09-26T20:00:00Z",
  },
  {
    id: "h2",
    name: "Local vLLM",
    provider: "openai-compatible",
    baseUrl: "http://localhost:8000/v1",
    model: "qwen3-coder",
    effort: "low",
    extraHeaders: { "X-Team": "loops" },
    allowInsecureHttp: false,
    isDefault: false,
    hasApiKey: false,
    updatedAt: "2026-09-26T18:30:00Z",
  },
];

export const demoEnvironment: EnvironmentDescriptorView = {
  id: "env_9f2c7a",
  label: "home-server",
  platform: "linux",
  capabilities: ["loops", "runs", "settings"],
  protocol: 1,
  product: "loops-server",
  version: "0.1.0",
  publicUrl: "https://loops.example.ts.net",
};

export const demoSessions: readonly SessionTokenView[] = [
  {
    id: "tok_1",
    label: "laptop browser",
    scopes: ["env:read", "runs:write", "settings:write"],
    createdAt: "2026-09-26T19:00:00Z",
    lastUsedAt: "2026-09-26T23:00:00Z",
    current: true,
  },
];
