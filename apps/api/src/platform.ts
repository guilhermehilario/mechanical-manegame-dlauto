import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadEnv } from '@mechanic-system/config';
import { bootstrapApi } from './app/bootstrap';

/**
 * Standalone entrypoint (development without Electron).
 * Loads the nearest .env (workspace root), validates it (spec §30) and boots.
 */
for (const candidate of ['.env', '../../.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) {
    loadDotenv({ path });
    break;
  }
}

bootstrapApi(loadEnv())
  .then((api) => {
    console.log(`API listening on http://127.0.0.1:${api.port} (offline-first loopback)`);
  })
  .catch((error: unknown) => {
    console.error('Failed to start API:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
