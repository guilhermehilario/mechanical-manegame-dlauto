import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import type { Readable } from 'node:stream';
import { chmodSync, mkdirSync } from 'node:fs';
import { app } from 'electron';

/** Spawn result with piped stdout/stderr (stdin ignored): streams are non-null. */
type ApiChildProcess = ChildProcessByStdio<null, Readable, Readable>;
import { join, resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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

  if (app.isPackaged) {
    hardenUserDataDirs();
    await migrateDatabaseIfNeeded();
  }

  const child = spawn(process.execPath, [apiEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      API_PORT: '0',
      // Packaged: everything lives in userData (writable); never inside the
      // read-only bundle. Secrets are generated once and persisted there.
      ...(app.isPackaged
        ? {
            DATABASE_URL: databaseUrl(),
            STORAGE_DIR: join(userDataDir(), 'storage'),
            // Fase 10 (R7/SEC-07): backups live beside the data they protect.
            BACKUP_DIR: join(userDataDir(), 'backups'),
            JWT_ACCESS_SECRET: loadOrCreateSecret('jwt-access-secret'),
            JWT_REFRESH_SECRET: loadOrCreateSecret('jwt-refresh-secret'),
            // R2 (SEC-03): authorize the file:// renderer for the desktop
            // flow. All real routes sit behind the JWT guard — the loopback
            // CORS entry alone grants no data access.
            CORS_ORIGIN: corsOriginForPackaged(),
          }
        : {
            DATABASE_URL: process.env.DATABASE_URL ?? 'file:./dev.db',
            JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? '',
            JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? '',
          }),
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

// ─── Packaged layout (Fase 8) ───────────────────────────────────────────────

/**
 * Packaged app layout (electron-builder): a API roda 100% de arquivos REAIS
 * em resources/api/ (extraResources — fora do asar), porque o CLI do Prisma usa
 * import ESM e binários nativos não executam de dentro do asar.
 *   resources/api/           → API autocontida (bundle esbuild + node_modules prod)
 *   resources/renderer/      → build do web (asar)
 *   resources/api/prisma/    → schema + migrations (migrate deploy na 1ª execução)
 */
function resolveApiEntry(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'api', 'dist', 'platform.js');
  }
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

function userDataDir(): string {
  return app.getPath('userData');
}

/**
 * R7/SEC-07 (Fase 10): the packaged app's local data (database, uploads,
 * backups) is PII-bearing — its directories get owner-only permissions
 * (0700; on Windows this maps to the equivalent owner-only ACL).
 */
function hardenUserDataDirs(): void {
  for (const dir of [
    userDataDir(),
    join(userDataDir(), 'storage'),
    join(userDataDir(), 'backups'),
  ]) {
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      chmodSync(dir, 0o700);
    } catch {
      // Best-effort on filesystems without POSIX modes — never block boot.
    }
  }
}

/**
 * CORS origin for the packaged desktop flow (R2/SEC-03).
 * The renderer is loaded from file:// (Origin `null` on fetch); dev servers
 * keep using their http origins. Nothing else is authorized, and every
 * domain route remains behind the JWT guard.
 */
function corsOriginForPackaged(): string {
  return process.env.CORS_ORIGIN?.trim() || 'null';
}

function databaseUrl(): string {
  const dbPath = join(userDataDir(), 'mechanic.db');
  return `file:${dbPath}`;
}

/** Reads a persisted secret from userData, generating + persisting on first run. */
function loadOrCreateSecret(fileName: string): string {
  const secretsPath = join(userDataDir(), 'secrets.json');
  if (existsSync(secretsPath)) {
    try {
      const stored = JSON.parse(readFileSync(secretsPath, 'utf8')) as Record<string, string>;
      const existing = stored[fileName];
      if (typeof existing === 'string' && existing.length >= 32) return existing;
    } catch {
      // corrupt file → regenerate below
    }
  }
  const secret = randomBytes(48).toString('base64');
  const stored = existsSync(secretsPath)
    ? (JSON.parse(readFileSync(secretsPath, 'utf8')) as Record<string, string>)
    : {};
  stored[fileName] = secret;
  writeFileSync(secretsPath, JSON.stringify(stored, null, 2), { mode: 0o600 });
  return secret;
}

/**
 * First run: applies the embedded migrations via the deployed Prisma CLI
 * (resources/api/node_modules/prisma), creating SQLite under userData.
 * Subsequent runs keep the existing DB untouched.
 */
async function migrateDatabaseIfNeeded(): Promise<void> {
  const dbPath = join(userDataDir(), 'mechanic.db');
  if (existsSync(dbPath)) return;

  const prismaCli = join(
    process.resourcesPath,
    'api',
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );
  const schemaPath = join(process.resourcesPath, 'api', 'prisma', 'schema.prisma');
  if (!existsSync(prismaCli) || !existsSync(schemaPath)) {
    throw new Error('Empacotamento inválido: Prisma CLI ou schema ausentes em resources/api.');
  }

  await new Promise<void>((resolveMigrate, reject) => {
    const migrated = spawn(
      process.execPath,
      [prismaCli, 'migrate', 'deploy', '--schema', schemaPath],
      {
env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          DATABASE_URL: databaseUrl(),
        },
        stdio: 'inherit',
      },
    );
    migrated.on('exit', (code) => {
      if (code === 0) resolveMigrate();
      else reject(new Error(`Falha ao inicializar o banco de dados (prisma migrate, code ${code}).`));
    });
    migrated.on('error', (error) => {
      reject(error);
    });
  });
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