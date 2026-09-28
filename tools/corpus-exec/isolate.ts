/** Linux capability boundary for captured code. There is no in-process fallback. */
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseFile } from "./run.ts";
import { readCaseFile, type Closure } from "./sandbox.ts";
import { deserialize } from "./serialize.ts";

export async function executeIsolated(closure: Closure, caseDir: string, c: CaseFile): Promise<unknown> {
  if (process.platform !== "linux" || Number(process.versions.node.split(".")[0]) < 24) {
    throw new Error("corpus execution requires Linux, Node >=24 and bubblewrap with user namespaces");
  }
  const driverDir = mkdtempSync(join(tmpdir(), "corpus-driver-"));
  try {
    const requestCase = { ...c };
    if (c.drive) {
      writeFileSync(join(driverDir, "driver.mjs"), readCaseFile(caseDir, c.drive.file));
      requestCase.drive = { ...c.drive, file: "driver.mjs" };
    }
    const args = ["--unshare-all", "--die-with-parent", "--new-session", "--cap-drop", "ALL", "--clearenv"];
    // Mount only runtime libraries, never the host root, home, repo or credentials.
    for (const dir of ["/lib", "/lib64", "/usr/lib", "/usr/lib64"]) {
      if (existsSync(dir)) args.push("--ro-bind", realpathSync(dir), dir);
    }
    args.push("--ro-bind", realpathSync(process.execPath), "/bin/node",
      "--ro-bind", closure.dir, "/chunks", "--ro-bind", driverDir, "/case");
    for (const name of ["worker.ts", "execute.ts", "serialize.ts"]) {
      args.push("--ro-bind", fileURLToPath(new URL(name, import.meta.url)), `/runner/${name}`);
    }
    args.push("--dev", "/dev", "--tmpfs", "/tmp", "--chdir", "/chunks",
      "/bin/node", "--max-old-space-size=256", "--permission",
      "--allow-fs-read=/runner", "--allow-fs-read=/chunks", "--allow-fs-read=/case", "/runner/worker.ts");
    const response = await new Promise<string>((resolve, reject) => {
      const child = execFile("bwrap", args, {
        env: { PATH: "/usr/bin:/bin" }, encoding: "utf8", timeout: 30_000,
        killSignal: "SIGKILL", maxBuffer: 16 * 1024 * 1024,
      }, (error, stdout, stderr) => {
        if (error) reject(new Error(`isolated corpus execution failed (Linux/bubblewrap required): ${stderr || error.message}`));
        else resolve(stdout);
      });
      child.stdin!.on("error", () => { /* execFile reports early worker exit */ });
      child.stdin!.end(JSON.stringify({ closure: { ...closure, dir: "/chunks" }, c: requestCase }));
    });
    const result = JSON.parse(response);
    if (result.error) throw new Error(result.error);
    return deserialize(result.output);
  } finally {
    rmSync(driverDir, { recursive: true, force: true });
  }
}
