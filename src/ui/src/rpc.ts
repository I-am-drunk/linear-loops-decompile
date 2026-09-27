/**
 * The one RPC connection. Token comes from the ?connectToken= deep link the
 * server prints at boot (persisted to localStorage); without it the app shows
 * the pair screen.
 */

import { RpcClient } from "../../connect/client.ts";

let clientPromise: Promise<RpcClient> | null = null;

export function getToken(): string | null {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get("connectToken");
  if (fromUrl) {
    localStorage.setItem("loops.connectToken", fromUrl);
    url.searchParams.delete("connectToken");
    window.history.replaceState(null, "", url.toString());
    return fromUrl;
  }
  return localStorage.getItem("loops.connectToken");
}

export function clearToken(): void {
  localStorage.removeItem("loops.connectToken");
  clientPromise = null;
}

export function rpc(): Promise<RpcClient> {
  const token = getToken();
  if (!token) return Promise.reject(new Error("no connect token"));
  if (!clientPromise) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    clientPromise = RpcClient.connect(`${proto}//${window.location.host}/ws`, token);
    clientPromise.catch(() => { clientPromise = null; });
  }
  return clientPromise;
}

export async function call<T = unknown>(method: string, params?: unknown): Promise<T> {
  return (await rpc()).call<T>(method, params);
}
