/**
 * Linear connectivity probe, riding the shared dataplane client
 * (linear-client.ts — one code path for probe and real calls, R5.1).
 * Verifies a PAT via the public API `viewer` query and reports
 * connectivity + rate budget. Secrets are read server-side only.
 */

import { LinearClient, LinearClientError, type RateLimitSnapshot } from "./linear-client.ts";

export interface LinearViewer {
  id: string;
  name: string;
  email: string;
}

export interface LinearProbeResult {
  ok: boolean;
  viewer?: LinearViewer;
  organization?: { id: string; name: string; urlKey: string };
  rateLimit?: RateLimitSnapshot;
  error?: string;
}

type FetchImpl = typeof fetch;

const VIEWER_QUERY = `query LoopsProbe {
  viewer { id name email }
  organization { id name urlKey }
}`;

interface ViewerData {
  viewer?: LinearViewer;
  organization?: { id: string; name: string; urlKey: string };
}

function toProbeResult(e: unknown): LinearProbeResult {
  if (e instanceof LinearClientError) {
    if (e.kind === "http" && (e.status === 401 || e.status === 403)) {
      return { ok: false, error: "unauthorized: Linear rejected the token", rateLimit: e.rateLimit };
    }
    if (e.kind === "not_connected") return { ok: false, error: "not connected" };
    return { ok: false, error: e.message, rateLimit: e.rateLimit };
  }
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

/** Probe through an existing client (shared rate budget): dataplane.probe. */
export async function probeLinearWithClient(client: LinearClient): Promise<LinearProbeResult> {
  try {
    const data = await client.query<ViewerData>(VIEWER_QUERY, undefined, { timeoutMs: 8000 });
    if (!data.viewer) return { ok: false, error: "no viewer in response", rateLimit: client.budget() };
    return { ok: true, viewer: data.viewer, organization: data.organization, rateLimit: client.budget() };
  } catch (e) {
    return toProbeResult(e);
  }
}

/**
 * Probe a candidate token on an ephemeral client: the settings.setLinear
 * path, where the token is not stored yet (and never stored on failure).
 */
export async function probeLinear(token: string, fetchImpl: FetchImpl = fetch): Promise<LinearProbeResult> {
  const client = new LinearClient({ getToken: () => token, fetchImpl });
  return probeLinearWithClient(client);
}
