/**
 * T-1103 — the loops server entry point.
 *
 *   node --experimental-strip-types src/server/start.ts
 *
 * Env: PORT (default 7373) · LOOPS_DB (default ./loops.db) · TICK_MS
 * (scheduler drive, default 30000; 0 disables — tick/handleEvent stay
 * callable internally).
 *
 * Boots the live composition root (compose.ts) and mints a full-scope
 * bootstrap session token for the operator. Self-hosted single-user: the
 * token is printed to the operator's own terminal (Jupyter-style) — never
 * commit it; mint scoped session tokens via pairing for real clients.
 */
import { createLiveLoopsServer } from "./compose.ts";
import type { Scope } from "../connect/tokens.ts";

const ALL_SCOPES: Scope[] = [
  "env:read",
  "loops:read",
  "loops:write",
  "runs:read",
  "runs:write",
  "settings:read",
  "settings:write",
];

const port = Number(process.env["PORT"] ?? 7373);
const tickMs = Number(process.env["TICK_MS"] ?? 30_000);
const live = createLiveLoopsServer({
  dbPath: process.env["LOOPS_DB"] ?? "./loops.db",
  // STATIC_DIR serves the built UI same-origin (the UI's connect url derives
  // from location.host) — e.g. STATIC_DIR=src/ui/dist after `npm run build`.
  ...(process.env["STATIC_DIR"] !== undefined ? { staticDir: process.env["STATIC_DIR"] } : {}),
});
const { token } = live.tokens.mint({ scopes: ALL_SCOPES });
const bound = await live.listen(port, "127.0.0.1");

console.log(`loops-server listening on http://127.0.0.1:${bound}`);
console.log(`boot loops: ${live.bootLoops.scheduled} scheduled · ${live.bootLoops.event} event · ${live.bootLoops.chat} chat`);
console.log(`connect token (operator bootstrap): ${token}`);
// The UI reads ?connectToken= (src/ui/src/live/client.ts) and persists it.
console.log(`UI deep link: http://127.0.0.1:${bound}/?connectToken=${token}`);

if (tickMs > 0) {
  const timer = setInterval(() => {
    live.orchestrator.tick().catch((error: unknown) => {
      console.error("tick failed:", error instanceof Error ? error.message : error);
    });
  }, tickMs);
  timer.unref();
}

process.on("SIGINT", () => {
  void live.close().then(() => process.exit(0));
});
