/**
 * Entry point: `node --experimental-strip-types src/server/start.ts`
 * Env: PORT (default 8787), LOOPS_DB (default ./loops.db), STATIC_DIR
 * (default ../ui/dist). Prints the session token and the deep link.
 */

import { createLoopsServer } from "./index.ts";

const port = Number(process.env.PORT ?? 8787);
const server = createLoopsServer({
  dbPath: process.env.LOOPS_DB ?? "./loops.db",
  staticDir: process.env.STATIC_DIR ?? new URL("../ui/dist", import.meta.url).pathname,
  label: process.env.LOOPS_LABEL ?? "loops-server",
});

server.http.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`loops-server listening on ${url}`);
  console.log(`session token: ${server.token}`);
  console.log(`open: ${url}/?connectToken=${server.token}`);
});
