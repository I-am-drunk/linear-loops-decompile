/**
 * Entry point: `node --experimental-strip-types src/server/start.ts`
 * Env: PORT (default 8787), LOOPS_DB (default ./data/loops.db), STATIC_DIR
 * (default ../ui/dist). Prints the session token and the deep link.
 */

import { createLoopsServer } from "./index.ts";

const port = Number(process.env.PORT ?? 8787);
const server = createLoopsServer({
  dbPath: process.env.LOOPS_DB ?? "./data/loops.db",
  staticDir: process.env.STATIC_DIR ?? new URL("../ui/dist", import.meta.url).pathname,
  label: process.env.LOOPS_LABEL ?? "loops-server",
});

server.http.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`loops-server listening on ${url}`);
  console.log(`session token: ${server.token}`);
  console.log(`open: ${url}/?connectToken=${server.token}`);
});
