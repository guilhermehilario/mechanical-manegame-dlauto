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

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
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
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
    JWT_ACCESS_EXPIRES: '15m',
    JWT_REFRESH_EXPIRES: '7d',
  });
}
