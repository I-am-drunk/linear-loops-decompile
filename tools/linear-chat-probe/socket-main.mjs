#!/usr/bin/env node
import { readPrivate } from './auth-main.mjs';
import { probeSocket } from './socket.mjs';
import { ProbeError } from './config.mjs';
try {
  if (process.argv.length !== 4 || process.argv[2] !== '--config') throw new ProbeError('usage: --config PRIVATE_FILE');
  const config = await readPrivate(process.argv[3]);
  const result = await probeSocket(config);
  console.log(JSON.stringify(result, (_key, value) =>
    typeof value === 'string' ? value.split(config.token).join('[REDACTED]') : value, 2));
} catch (error) {
  console.error(JSON.stringify({ outcome: error instanceof ProbeError ? error.kind : 'socketProbeFailure' }));
  process.exitCode = 2;
}
