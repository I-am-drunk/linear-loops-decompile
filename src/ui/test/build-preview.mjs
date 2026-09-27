// Build a static preview.html of the loops list (fixtures) for eyeballing
// parity without running vite. Output is a build artifact, never shipped.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";

await build({
  entryPoints: ["test/preview-entry.tsx"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: ".test-out/preview.cjs",
  jsx: "automatic",
  logLevel: "warning",
});
execFileSync(process.execPath, [".test-out/preview.cjs"], { stdio: "inherit" });
