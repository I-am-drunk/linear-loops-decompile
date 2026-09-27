/**
 * T-1104 — the UI's shared T3 connect client.
 *
 * Resolution order for the scoped channel token (T-901 pairing):
 *   1. `?connectToken=<token>` in the URL (dev/probe path) — persisted to
 *      localStorage and stripped from the address bar.
 *   2. localStorage `loops.connect.token` — where the settings Environment
 *      page's pairing flow (R8's container, T-802) writes the token.
 * Absent a token the app stays in fixture/demo mode (sources.ts selects).
 *
 * Import-safe under Node (tests, SSR): every browser touch is inside a
 * function and guarded — nothing reads window/localStorage at module scope.
 */
import { ChannelClient } from "../../../connect/client.ts";

export const TOKEN_STORAGE_KEY = "loops.connect.token";

export interface ConnectConfig {
  /** ws(s)://host/connect — same origin as the served UI. */
  readonly url: string;
  readonly token: string;
}

/** Resolve the connect config for this browser, or null when unconfigured. */
export function resolveConnectConfig(): ConnectConfig | null {
  if (typeof window === "undefined") return null;
  let token: string | null = null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("connectToken");
    if (fromUrl !== null && fromUrl.length > 0) {
      token = fromUrl;
      window.localStorage?.setItem(TOKEN_STORAGE_KEY, fromUrl);
      params.delete("connectToken");
      const query = params.toString();
      const clean = `${window.location.pathname}${query === "" ? "" : `?${query}`}${window.location.hash}`;
      window.history?.replaceState(null, "", clean);
    } else {
      token = window.localStorage?.getItem(TOKEN_STORAGE_KEY) ?? null;
    }
  } catch {
    return null; // storage blocked (private mode etc.) — fixture mode
  }
  if (token === null || token === "") return null;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return { url: `${proto}//${window.location.host}/connect`, token };
}

let shared: ChannelClient | null = null;
let sharedConnecting: Promise<ChannelClient> | null = null;

/**
 * The process-wide client, connected lazily. Returns null when the app is
 * unconfigured (fixture mode) or not in a browser.
 *
 * Lifecycle: one client per page lifetime. A socket drop AFTER a successful
 * open is the client's own business — it retries forever (client.ts) — so
 * the same promise stays valid and callers never swap clients mid-flight.
 * Only an INITIAL connect failure (bad token, unreachable server) clears
 * the singleton, so the next caller retries with a fresh client.
 */
export function getSharedClient(): Promise<ChannelClient> | null {
  const config = resolveConnectConfig();
  if (config === null) return null;
  if (shared !== null && sharedConnecting !== null) return sharedConnecting;
  const client = new ChannelClient({ url: config.url, token: config.token });
  const pending = client.connect().then(() => client);
  shared = client;
  sharedConnecting = pending;
  pending.catch(() => {
    if (sharedConnecting === pending) {
      shared = null;
      sharedConnecting = null;
    }
  });
  return pending;
}

/** Test hook: drop the singleton so each test resolves a fresh client. */
export function resetSharedClientForTests(): void {
  shared = null;
  sharedConnecting = null;
}
