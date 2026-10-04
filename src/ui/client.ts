/** Browser entry: start the router against the real window. */
import { start } from "./shell.ts";

start(window as unknown as Parameters<typeof start>[0]);
