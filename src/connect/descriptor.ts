/**
 * Environment descriptor (T-901) — `GET /.well-known/t3/environment`.
 *
 * Discovery contract (SPECS/t3-connect.md §1): a client fetches the descriptor
 * to learn what this environment is and what it can do before pairing.
 * `publicUrl` is present when the server is reachable through a tunnel, so
 * connection strings and webhooks can embed the public base.
 *
 * The handler is framework-free (node:http) and matches the seam src/server
 * (T-1101) mounts verbatim: `environmentHandler(req, res)`. The descriptor is
 * computed once — it is immutable server identity, not per-request state.
 *
 * `id` must be STABLE across restarts: the caller (server settings store)
 * persists it on first boot via generateEnvironmentId(). It identifies the
 * environment to paired clients; rotating it invalidates pairings.
 *
 * Original code.
 */

import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface EnvironmentDescriptor {
  id: string;
  label: string;
  platform: string;
  capabilities: ["loops", "runs", "settings"];
  protocol: 1;
  product: "loops-server";
  version: string;
  publicUrl?: string;
}

/** First-boot id. The caller persists it; rotating it re-pairs every client. */
export function generateEnvironmentId(): string {
  return randomBytes(12).toString("base64url");
}

export function createEnvironmentHandler(config: {
  id: string;
  label?: string;
  version: string;
  publicUrl?: string;
}): (req: IncomingMessage, res: ServerResponse) => void {
  const descriptor: EnvironmentDescriptor = {
    id: config.id,
    label: config.label ?? "loops-server",
    platform: process.platform,
    capabilities: ["loops", "runs", "settings"],
    protocol: 1,
    product: "loops-server",
    version: config.version,
    ...(config.publicUrl !== undefined ? { publicUrl: config.publicUrl } : {}),
  };
  const body = JSON.stringify(descriptor);

  return (req, res) => {
    if (req.method !== "GET") {
      res.writeHead(405, { "content-type": "application/json; charset=utf-8", allow: "GET" });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(body);
  };
}

