/**
 * HTTP surface — node:http, framework-free. Deliberately thin:
 *
 * - `GET /api/health` — liveness + version.
 * - `GET /.well-known/t3/environment` — mounted from R9's connect package
 *   (the caller passes the handler; the server doesn't import connect, so
 *   the dependency direction stays connect → server, never circular).
 * - `POST /webhooks/linear-agent` — T-605's AgentSessionEvent surface
 *   (golden-goose inbound), mounted by the composition root via the same
 *   caller-passed pattern.
 * - static files from `staticDir` (the webui build output; index.html
 *   fallback for SPA routes).
 * - WebSocket upgrade is NOT handled here: `createLoopsServer` returns the
 *   bare `http.Server`; R9's channel attaches its own `upgrade` listener.
 *
 * No REST API for domain data on purpose: UI ↔ server transport is the T3
 * connect channel (SPECS/target-architecture.md). /api/* stays a 404 wall.
 *
 * Original code.
 */

import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

export interface HttpOptions {
  staticDir?: string | undefined;
  /** R9's environment descriptor handler (T-901). Mounted when present. */
  environmentHandler?: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;
  /** T-605's AgentSessionEvent handler (golden goose inbound). Mounted when present. */
  agentWebhookHandler?: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;
  version?: string;
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export function createHttpServer(options: HttpOptions): Server {
  const version = options.version ?? "0.1.0";
  return createServer((req, res) => {
    void (async () => {
      // Raw path — NOT new URL(), which normalizes "/../" away before our
      // traversal guard can see it.
      const path = (req.url ?? "/").split("?")[0] ?? "/";

      if (path === "/api/health") {
        sendJson(res, 200, { ok: true, service: "loops-server", version });
        return;
      }
      if (path === "/.well-known/t3/environment") {
        if (options.environmentHandler !== undefined) {
          options.environmentHandler(req, res);
        } else {
          sendJson(res, 404, { error: "connect package not mounted" });
        }
        return;
      }
      if (path === "/webhooks/linear-agent") {
        if (options.agentWebhookHandler !== undefined) {
          options.agentWebhookHandler(req, res);
        } else {
          sendJson(res, 404, { error: "agent webhooks not mounted" });
        }
        return;
      }
      if (path.startsWith("/api/")) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      if (req.method !== "GET" || options.staticDir === undefined) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      await serveStatic(options.staticDir, path, res);
    })().catch((err: unknown) => {
      if (!res.headersSent) sendJson(res, 500, { error: "internal" });
      console.error("http handler fault:", err);
    });
  });
}

async function serveStatic(staticDir: string, path: string, res: ServerResponse): Promise<void> {
  // Traversal guard: reject any ".." segment in the RAW decoded path —
  // path.normalize would silently collapse "/../x" to "/x" and hide the
  // attack, so the check must come first.
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    sendJson(res, 400, { error: "bad path" });
    return;
  }
  if (decoded.split(/[/\\]/).includes("..")) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  const rel = normalize(decoded).replace(/^([/\\])+/, "");
  let filePath = join(staticDir, rel);
  if (rel !== "" && !filePath.startsWith(staticDir)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  if (rel === "" || rel.endsWith("/")) filePath = join(staticDir, rel, "index.html");
  let body: Buffer;
  try {
    body = await readFile(filePath);
  } catch {
    // SPA fallback: unknown deep links get index.html if the app has one.
    try {
      body = await readFile(join(staticDir, "index.html"));
      filePath = join(staticDir, "index.html");
    } catch {
      sendJson(res, 404, { error: "not found" });
      return;
    }
  }
  res.writeHead(200, { "content-type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" });
  res.end(body);
}
