/**
 * T-1104 — where the UI gets its server connection, and the LiveSource seam
 * the containers consume.
 *
 * Connection discovery v1 (deliberately small; the settings Environment page
 * owns the real pairing UX later — R8):
 *   1. URL query `?t3url=ws://host:port/connect&t3token=t3_…` (persisted to
 *      localStorage so the link is shareable/bookmarkable), then
 *   2. localStorage `loops.t3.url` + `loops.t3.token`, else
 *   3. no server → the containers render their fixture demo data unchanged.
 *
 * The token is a T3 session token (pairing flow, src/connect/pairing.ts) —
 * never a Linear PAT, never an inference key. It never leaves this client
 * except as the WS subprotocol to the server that issued it.
 *
 * Everything DOM-touching is guarded so this module loads safely under
 * renderToString (tests) — resolution happens in effects, not at import.
 */
import { LiveChannelClient } from "./client.ts";
import type { SubscribeResult } from "./client.ts";
import {
  WIRE_METHODS,
  type LoopsListResult,
  type LoopsSetEnabledResult,
  type RunsGetResult,
  type RunsListParams,
  type RunsListResult,
} from "./wire.ts";

export interface ConnectionConfig {
  /** ws(s)://host[:port]/connect */
  readonly url: string;
  readonly token: string;
}

const LS_URL = "loops.t3.url";
const LS_TOKEN = "loops.t3.token";

interface WindowLike {
  location?: { search?: string } | undefined;
  localStorage?: Pick<Storage, "getItem" | "setItem"> | undefined;
}

/** Resolve the connection, or null for demo mode. Injectable for tests. */
export function resolveConnection(win: WindowLike | undefined): ConnectionConfig | null {
  if (win === undefined) return null;
  const store = win.localStorage;
  const search = win.location?.search ?? "";
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const urlParam = params.get("t3url");
  const tokenParam = params.get("t3token");
  if (urlParam !== null && tokenParam !== null) {
    try {
      store?.setItem(LS_URL, urlParam);
      store?.setItem(LS_TOKEN, tokenParam);
    } catch {
      /* private mode: the params still work for this load */
    }
    return { url: urlParam, token: tokenParam };
  }
  try {
    const url = store?.getItem(LS_URL);
    const token = store?.getItem(LS_TOKEN);
    if (typeof url === "string" && url.length > 0 && typeof token === "string" && token.length > 0) {
      return { url, token };
    }
  } catch {
    /* storage unavailable → demo */
  }
  return null;
}

/** The data seam the containers consume. One method per wire method. */
export interface LiveSource {
  listLoops(): Promise<LoopsListResult>;
  listRuns(params: RunsListParams): Promise<RunsListResult>;
  getRun(id: string): Promise<RunsGetResult>;
  setLoopEnabled(id: string, enabled: boolean): Promise<LoopsSetEnabledResult>;
  steer(id: string, text: string): Promise<unknown>;
  cancel(id: string): Promise<unknown>;
  continue(id: string, text: string): Promise<unknown>;
  subscribe(
    runId: string,
    onEvent: (event: Record<string, unknown> & { type: string }, seq: number) => void,
  ): Promise<SubscribeResult>;
  unsubscribe(runId: string): void;
}

/** Adapt a channel client to the LiveSource seam (method names live in wire.ts). */
export function sourceFromClient(client: LiveChannelClient): LiveSource {
  return {
    listLoops: () => client.request<LoopsListResult>(WIRE_METHODS.loopsList),
    listRuns: (params) => client.request<RunsListResult>(WIRE_METHODS.runsList, params),
    getRun: (id) => client.request<RunsGetResult>(WIRE_METHODS.runsGet, { id }),
    setLoopEnabled: (id, enabled) =>
      client.request<LoopsSetEnabledResult>(WIRE_METHODS.loopsSetEnabled, { id, enabled }),
    steer: (id, text) => client.request(WIRE_METHODS.runsSteer, { id, text }),
    cancel: (id) => client.request(WIRE_METHODS.runsCancel, { id }),
    continue: (id, text) => client.request(WIRE_METHODS.runsContinue, { id, text }),
    subscribe: (runId, onEvent) => client.subscribeRuns(runId, onEvent),
    unsubscribe: (runId) => client.unsubscribe(runId),
  };
}

let sharedClient: LiveChannelClient | null | undefined;

/**
 * The app's shared connection, resolved once. Null = demo mode. Connection
 * failures are the containers' concern (they render demo data); the client
 * itself reconnects forever in the background.
 */
export function getSharedSource(): LiveSource | null {
  if (sharedClient === undefined) {
    const config = resolveConnection(
      typeof window !== "undefined" ? (window as unknown as WindowLike) : undefined,
    );
    if (config === null) {
      sharedClient = null;
    } else {
      const client = new LiveChannelClient({ url: config.url, token: config.token });
      sharedClient = client;
      void client.connect().catch(() => {
        /* the client retries; requests reject until the socket opens */
      });
    }
  }
  return sharedClient === null ? null : sourceFromClient(sharedClient);
}

/** Test hook: drop the singleton so a fresh resolution happens. */
export function resetSharedSource(): void {
  if (sharedClient !== undefined && sharedClient !== null) void sharedClient.close();
  sharedClient = undefined;
}
