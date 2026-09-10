import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

/** Spawn result with piped stdout/stderr (stdin ignored): streams are non-null. */
type ApiChildProcess = ChildProcessByStdio<null, Readable, Readable>;
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

export interface RunningApiProcess {
  baseUrl: string;
  stop: () => void;
}

const HEALTH_TIMEOUT_MS: number = 30_000;
const HEALTH_INTERVAL_MS: number = 250;

/**
 * Starts the NestJS API as a sidecar using Electron's embedded Node runtime
 * (ELECTRON_RUN_AS_NODE), so no system Node.js is required on the workshop
 * machine — the app is fully self-contained and offline-first.
 *
 * The API binds to 127.0.0.1 on an ephemeral port (API_PORT=0); the renderer
 * learns the final URL only through the preload bridge (least privilege).
 */
export async function startApiProcess(): Promise<RunningApiProcess> {
  const apiEntry = resolveApiEntry();
  const child = spawn(process.execPath, [apiEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      API_PORT: '0',
      // TODO (Fase 8 — empacotamento): em produção empacotada, DATABASE_URL
      // deve apontar para o diretório de dados do usuário (app.getPath
      // ('userData')), nunca para dentro do bundle (somente leitura).
      DATABASE_URL: process.env.DATABASE_URL ?? 'file:./dev.db',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? '',
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '',
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Non-null streams: stdin is ignored, stdout/stderr are piped (ApiChildProcess).
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    // Forward API logs to the main process log (pino output).
    process.stdout.write(`[api] ${chunk}`);
  });

  const port = await waitForPort(apiEntry, child);
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  return {
    baseUrl,
    stop: () => {
      if (!child.killed) {
        child.kill();
      }
    },
  };
}

function resolveApiEntry(): string {
  // Packaged/env override first; dev fallback walks to the API build output.
  const override = process.env.MECHANIC_API_ENTRY;
  if (override && existsSync(override)) return resolve(override);

  // dist/main/main.js → apps/api/dist/platform.js
  const devPath = join(__dirname, '..', '..', '..', 'api', 'dist', 'platform.js');
  if (existsSync(devPath)) return devPath;

  throw new Error(
    `API entry not found. Build @mechanic-system/api first (looked at: ${devPath}).`,
  );
}

async function waitForPort(apiEntry: string, child: ApiChildProcess): Promise<number> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  const stdout = child.stdout;

  // The API prints its final ephemeral port on boot: "listening on http://127.0.0.1:<port>".
  return new Promise<number>((resolvePort, reject) => {
    const timer = setInterval(() => {
      if (Date.now() > deadline) {
        cleanup();
        reject(new Error(`API did not become ready within ${HEALTH_TIMEOUT_MS}ms`));
      }
    }, HEALTH_INTERVAL_MS);

    function cleanup(): void {
      clearInterval(timer);
      stdout.off('data', onData);
    }

    function onData(chunk: string): void {
      const match = /127\.0\.0\.1:(\d+)/.exec(chunk);
      if (match?.[1]) {
        cleanup();
        resolvePort(Number(match[1]));
      }
    }

    stdout.setEncoding('utf8');
    stdout.on('data', onData);
    child.once('exit', (code) => {
      cleanup();
      reject(new Error(`API exited early with code ${code ?? 'unknown'} (entry: ${apiEntry})`));
    });
  });
}
