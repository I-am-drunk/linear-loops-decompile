// Runs only inside the OS sandbox; stdout carries bounded, tagged JSON data.
import { execute } from "./execute.ts";
import { serialize } from "./serialize.ts";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { closure, c } = JSON.parse(input);
console.log = (...args: unknown[]) => console.error(...args);
try {
  const output = serialize(await execute(closure, c));
  process.stdout.write(JSON.stringify({ output }));
} catch (e) {
  process.stdout.write(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
}
