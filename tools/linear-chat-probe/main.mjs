#!/usr/bin/env node
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ProbeError, plan, validateConfig } from './config.mjs';
import { runProbe } from './probe.mjs';
import { exampleConfig, exampleIds } from './sample.mjs';

export function safeReport(result, token, showContent = false) {
  const { content, ...report } = result;
  if (typeof content === 'string') {
    report.contentBytes = Buffer.byteLength(content);
    report.contentSha256 = createHash('sha256').update(content).digest('hex');
    if (showContent) report.content = content;
  }
  return JSON.stringify(report, (_key, value) =>
    token && typeof value === 'string' ? value.split(token).join('[REDACTED]') : value);
}
export async function main(args) {
  if (args.length === 1 && args[0] === '--dry-run') {
    console.log(JSON.stringify(plan(exampleConfig, exampleIds)));
    return 0;
  }
  if (args[0] !== '--live' || args[1] !== '--config' || !args[2] ||
      args.length > 4 || (args.length === 4 && args[3] !== '--show-content')) {
    throw new ProbeError('usage: --dry-run OR --live --config PRIVATE_FILE [--show-content]');
  }
  const stat = await lstat(args[2]);
  if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size > 32768) {
    throw new ProbeError('configRequiresPrivateRegularFile');
  }
  const config = validateConfig(JSON.parse(await readFile(args[2], 'utf8')));
  if (config.token === exampleConfig.token) throw new ProbeError('replaceExampleCredential');
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    const result = await runProbe(config, { signal: controller.signal });
    console.log(safeReport(result, config.token, args[3] === '--show-content'));
    return result.outcome === 'complete' ? 0 : 2;
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}
if (import.meta.main) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) {
    // Never echo JSON parse errors, filenames, headers or upstream exceptions.
    console.error(JSON.stringify({ outcome: error instanceof ProbeError ? error.kind : 'localInputError' }));
    process.exitCode = 2;
  }
}
