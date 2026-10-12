#!/usr/bin/env node
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { authenticate } from './auth.mjs';
import { ProbeError } from './config.mjs';

export async function readPrivate(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || (stat.mode & 0o077) || stat.size > 32768) {
      throw new ProbeError('inputRequiresPrivateRegularFile');
    }
    return JSON.parse(await file.readFile('utf8'));
  } finally { await file.close(); }
}
export async function authMain(args) {
  const [mode, inputFlag, inputPath, outputFlag, outputPath] = args;
  if (args.length !== 5 || !['challenge', 'complete'].includes(mode) ||
      inputFlag !== '--input' || outputFlag !== '--output') {
    throw new ProbeError('usage: challenge|complete --input PRIVATE_FILE --output NEW_PRIVATE_FILE');
  }
  const input = await readPrivate(inputPath);
  // Reserve before dispatch: an unwritable/existing destination must not consume a code.
  const file = await open(outputPath, 'wx', 0o600);
  try {
    const result = await authenticate(mode, input);
    await file.writeFile(JSON.stringify(result, null, 2) + '\n');
    await file.sync();
    console.log(JSON.stringify({ outcome: mode === 'challenge' ? 'challengeAccepted' : 'sessionCaptured' }));
  } finally { await file.close(); }
}
if (import.meta.main) {
  try { await authMain(process.argv.slice(2)); }
  catch (error) {
    console.error(JSON.stringify({ outcome: error instanceof ProbeError ? error.kind : 'authFailure' }));
    process.exitCode = 2;
  }
}
