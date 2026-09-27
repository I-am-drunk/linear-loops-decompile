/**
 * Minimal Linear dataplane for the settings vertical: verify a PAT via the
 * public API `viewer` query and report connectivity + rate budget. The full
 * dataplane is the R5 slice series; everything here is fetch over
 * https://api.linear.app/graphql with the operator's own token.
 */

export interface LinearViewer {
  id: string;
  name: string;
  email: string;
}

export interface LinearProbeResult {
  ok: boolean;
  viewer?: LinearViewer;
  organization?: { id: string; name: string; urlKey: string };
  rateLimit?: { requestsRemaining?: number; requestsReset?: string };
  error?: string;
}

type FetchImpl = typeof fetch;

const VIEWER_QUERY = `query LoopsProbe {
  viewer { id name email }
  organization { id name urlKey }
}`;

export async function probeLinear(token: string, fetchImpl: FetchImpl = fetch): Promise<LinearProbeResult> {
  let res: Response;
  try {
    res = await fetchImpl("https://api.linear.app/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: token },
      body: JSON.stringify({ query: VIEWER_QUERY }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    return { ok: false, error: `network: ${e instanceof Error ? e.message : String(e)}` };
  }

  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  const reset = res.headers.get("x-ratelimit-requests-reset");
  const rateLimit = {
    requestsRemaining: remaining ? Number(remaining) : undefined,
    requestsReset: reset ?? undefined,
  };

  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "unauthorized: Linear rejected the token", rateLimit };
  }
  if (!res.ok) {
    return { ok: false, error: `http ${res.status}`, rateLimit };
  }

  let body: { data?: { viewer?: LinearViewer; organization?: { id: string; name: string; urlKey: string } }; errors?: unknown };
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: "invalid JSON from Linear", rateLimit };
  }
  if (!body.data?.viewer) {
    return { ok: false, error: "no viewer in response", rateLimit };
  }
  return { ok: true, viewer: body.data.viewer, organization: body.data.organization, rateLimit };
}
