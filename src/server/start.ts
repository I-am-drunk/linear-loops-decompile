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
import type { SettingsBindingDeps } from "./settings-rpc.ts";
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

/**
 * The dataplane is a compile-first package (.js-extension imports) — nobody
 * imports its sources at runtime. The deployment binds its compiled dist;
 * build it once with: `npx tsc -p src/dataplane/tsconfig.build.json`.
 * Without it the server still runs, but setLinear/dataplane.probe answer
 * `unavailable` and run context/write-back throw visibly.
 */
async function dataplaneDeps(): Promise<Partial<SettingsBindingDeps>> {
  const dist = (f: string): string => `../dataplane/dist/${f}`;
  try {
    const [{ LinearClient }, { getIssue }, { createComment }] = await Promise.all([
      import(dist("client.js")),
      import(dist("reads.js")),
      import(dist("writes.js")),
    ]);
    return {
      verifyLinear: async (token: string) => new LinearClient({ credential: { kind: "pat", token } }).verifyAuth(),
      linearClientFor: (token: string) => new LinearClient({ credential: { kind: "pat", token } }),
      readIssue: getIssue,
      writeComment: createComment,
    };
  } catch {
    console.error("dataplane dist not found — Linear features unavailable until you run:");
    console.error("  npx tsc -p src/dataplane/tsconfig.build.json");
    return {};
  }
}

const live = createLiveLoopsServer({
  dbPath: process.env["LOOPS_DB"] ?? "./loops.db",
  settingsDeps: await dataplaneDeps(),
  // The web UI, built once with `npm --prefix src/ui run build`.
  staticDir: process.env["LOOPS_STATIC"] ?? new URL("../ui/dist", import.meta.url).pathname,
});
const { token } = live.tokens.mint({ scopes: ALL_SCOPES });
const bound = await live.listen(port, "127.0.0.1");

console.log(`loops-server listening on http://127.0.0.1:${bound}`);
console.log(`boot loops: ${live.bootLoops.scheduled} scheduled · ${live.bootLoops.event} event · ${live.bootLoops.chat} chat`);
console.log(`connect token (operator bootstrap): ${token}`);
// The merged UI resolves same-origin: token via ?connectToken= (persisted,
// stripped from the address bar), channel at ws(s)://<ui-host>/connect.
console.log(`UI: http://127.0.0.1:${bound}/?connectToken=${token}`);
console.log(`(UI needs its build: npm --prefix src/ui run build — the server runs API-only without it)`);

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
