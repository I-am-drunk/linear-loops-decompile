// Bundle the TSX tests with esbuild (already a devDep via Vite), then run them.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";

await build({
  entryPoints: ["test/smoke.tsx", "test/settings.test.tsx", "test/loops-smoke.tsx"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outdir: ".test-out",
  outExtension: { ".js": ".cjs" },
  jsx: "automatic",
  logLevel: "warning",
});
execFileSync(process.execPath, [".test-out/smoke.cjs"], { stdio: "inherit" });
execFileSync(process.execPath, [".test-out/settings.test.cjs"], { stdio: "inherit" });
execFileSync(process.execPath, [".test-out/loops-smoke.cjs"], { stdio: "inherit" });
