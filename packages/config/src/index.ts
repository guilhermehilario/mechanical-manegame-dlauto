import { z } from 'zod';

/**
 * Environment schema (spec §30).
 * Required variables are validated at startup — the app refuses to boot
 * with missing/invalid configuration instead of failing later at runtime.
 */

const isTest = process.env.NODE_ENV === 'test';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // 0 is valid: the Electron sidecar binds to an ephemeral port.
  API_PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),

  /** Root directory for uploaded files (Fase 6 images). Relative → cwd. */
  STORAGE_DIR: z.string().min(1).default('./data/storage'),

  /** Backup destination (Fase 10). Relative → cwd. Created with mode 0700. */
  BACKUP_DIR: z.string().min(1).default('./data/backups'),

  /**
   * Automatic daily backup (Bloco E of docs/todo-mvp.md). Enabled by default:
   * the whole business dataset is local-only, so the scheduler is the real
   * safety net. Set BACKUP_AUTO_ENABLED=0 to disable (e.g. CI/e2e).
   */
  BACKUP_AUTO_ENABLED: z
    .union([z.literal('0'), z.literal('1')])
    .default('1'),
  /** How often the scheduler tries to create a backup, in hours. */
  BACKUP_INTERVAL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  /** Dashboard warning threshold: hours without a backup before alerting. */
  BACKUP_ALERT_AFTER_HOURS: z.coerce.number().int().min(1).max(720).default(24),
  /** How many automatic backups to keep (oldest beyond this are deleted). */
  BACKUP_KEEP: z.coerce.number().int().min(1).max(365).default(14),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  /**
   * First-run admin (packaged desktop flow, R4/SEC-04): used ONLY when the
   * database has no active ADMIN. No defaults on purpose — missing values
   * with an empty admin table fail the boot with an actionable message.
   */
  FIRST_RUN_ADMIN_EMAIL: z.string().email().optional(),
  FIRST_RUN_ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Parse and validate the environment; throws a readable error on failure. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

/**
 * Test environment defaults so unit tests never depend on a real .env file.
 * Secrets here are throwaway values used only in test runs.
 */
export function testEnv(): Env {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    API_PORT: '0',
    CORS_ORIGIN: 'http://localhost:5173',
    DATABASE_URL: isTest ? 'file:./test.db' : 'file:./dev.db',
    STORAGE_DIR: isTest ? './data/storage-test' : './data/storage',
    BACKUP_DIR: isTest ? './data/backups-test' : './data/backups',
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
    JWT_ACCESS_EXPIRES: '15m',
    JWT_REFRESH_EXPIRES: '7d',
    BACKUP_AUTO_ENABLED: '0',
    BACKUP_INTERVAL_HOURS: '24',
    BACKUP_ALERT_AFTER_HOURS: '24',
    BACKUP_KEEP: '14',
  });
}
