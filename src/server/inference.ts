/**
 * Inference harness probe: a cheap live call that proves the harness config
 * works, returning latency and a peek at the model list. Reads the stored key
 * server-side; the key is sent only to the configured provider.
 */

import type { InferenceHarness } from "../model/settings.ts";

export interface InferenceProbeResult {
  ok: boolean;
  latencyMs: number;
  modelCount?: number;
  modelPeek?: string[];
  error?: string;
}

type FetchImpl = typeof fetch;

function modelsRequest(h: InferenceHarness): { url: string; headers: Record<string, string> } {
  const base = h.baseUrl.replace(/\/$/, "");
  switch (h.provider) {
    case "anthropic":
      return {
        url: `${base}/v1/models`,
        headers: { "x-api-key": h.apiKey ?? "", "anthropic-version": "2023-06-01" },
      };
    case "openrouter":
    case "openai-compatible":
      return { url: `${base}/models`, headers: { authorization: `Bearer ${h.apiKey ?? ""}` } };
  }
}

export async function probeInference(h: InferenceHarness, fetchImpl: FetchImpl = fetch): Promise<InferenceProbeResult> {
  const started = Date.now();
  const { url, headers } = modelsRequest(h);
  let res: Response;
  try {
    res = await fetchImpl(url, { headers, redirect: "error", signal: AbortSignal.timeout(8000) });
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - started, error: `network: ${e instanceof Error ? e.message : String(e)}` };
  }
  const latencyMs = Date.now() - started;
  if (!res.ok) {
    return { ok: false, latencyMs, error: `http ${res.status}` };
  }
  try {
    const body = (await res.json()) as { data?: Array<{ id: string }> };
    const ids = (body.data ?? []).map((m) => m.id);
    return { ok: true, latencyMs, modelCount: ids.length, modelPeek: ids.slice(0, 10) };
  } catch {
    return { ok: true, latencyMs };
  }
}
