/**
 * HTTP surface: static UI, environment descriptor, health. The WS channel
 * (src/connect) mounts on the same server at /ws.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import type { EnvironmentDescriptor } from "./index.ts";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

const PLACEHOLDER = `<!doctype html><html><head><meta charset="utf-8"><title>loops-server</title>
<style>body{background:#08090a;color:#e8e3e3;font-family:"Inter Variable",-apple-system,sans-serif;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
main{max-width:34rem}code{background:#ffffff14;padding:2px 6px;border-radius:4px}</style></head>
<body><main><h1>loops-server is running</h1>
<p>The UI is not built yet (it lands in the R3.4 slice). Build it with
<code>npm run build</code> in <code>src/ui</code>, then restart.</p></main></body></html>`;

export interface HttpOptions {
  staticDir?: string;
  descriptor: () => EnvironmentDescriptor;
}

export function createHttpServer(opts: HttpOptions): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname === "/.well-known/t3/environment") {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(opts.descriptor()));
      return;
    }

    // static, with SPA fallback to index.html
    if (opts.staticDir) {
      const safe = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
      const candidates = [join(opts.staticDir, safe), join(opts.staticDir, safe, "index.html"), join(opts.staticDir, "index.html")];
      for (const file of candidates) {
        try {
          const body = await readFile(file);
          res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
          return;
        } catch { /* try next */ }
      }
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PLACEHOLDER);
  });
}
