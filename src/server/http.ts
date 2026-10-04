/**
 * HTTP surface: static UI, environment descriptor, health. The WS channel
 * (src/connect) mounts on the same server at /ws.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import type { EnvironmentDescriptor } from "./index.ts";
import { indexHtml } from "../ui/index-html.ts";
import { themePresets, type PresetName } from "../ui/theme-css.ts";

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

/**
 * The app document, rendered per request so a theme or preset change needs no
 * rebuild. It is the SPA fallback: any path with no matching `staticDir` asset
 * gets the shell, which then routes on the hash.
 *
 * The client bundle itself is a build artifact — `bash src/ui/build.sh` emits
 * it into `staticDir`. Until that has run the document loads and the shell
 * stays blank, which the smoke test asserts rather than papering over.
 */
function appDocument(url: URL): string {
  // ?theme=lightDefault etc. switches preset without a rebuild; unknown
  // values fall through to the dark default rather than erroring.
  //
  // Object.hasOwn, NOT `in`: `in` walks the prototype chain, so
  // `?theme=constructor` passed the check and then threw deep inside the
  // theme generator on a preset with no `base`. One unauthenticated GET
  // killed the process. Any attacker-controlled string used as a key needs
  // an own-property test.
  const want = url.searchParams.get("theme");
  const preset = want && Object.hasOwn(themePresets, want) ? (want as PresetName) : "darkDefault";
  return indexHtml(preset);
}

export interface HttpOptions {
  staticDir?: string;
  descriptor: () => EnvironmentDescriptor;
}

export function createHttpServer(opts: HttpOptions): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    // The request handler is async, so a rejection here is an unhandled
    // rejection — which terminates the process under Node's default policy.
    // One bad request must never take the server down, so every path is
    // wrapped and a failure becomes a 500.
    void handle(opts, req, res).catch((err: unknown) => {
      console.error("http: request failed", err);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("internal error");
    });
  });
}

async function handle(opts: HttpOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  {
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
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(appDocument(url));
  }
}
