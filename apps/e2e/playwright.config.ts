import { defineConfig, devices } from '@playwright/test';
import { E2E_API_BASE_URL, E2E_API_PORT, E2E_API_ORIGIN, E2E_WEB_PORT, E2E_WEB_URL } from './support/env';

/**
 * R4/SEC-04: the admin password is generated randomly per run by
 * scripts/prepare-e2e-db.mjs and read by the tests via support/credentials.
 * No default credential exists in the repository.
 *
 * Ports are configurable so the suite can run next to a developer's own dev
 * stack (which usually holds 3001/5173):
 *   E2E_API_PORT=3101 E2E_WEB_PORT=5174 pnpm test:e2e
 */
const apiPort = E2E_API_PORT;
const webUrl = E2E_WEB_URL;

const apiEnv = {
  ...process.env,
  NODE_ENV: 'production',
  LOG_LEVEL: 'error',
  API_PORT: apiPort,
  CORS_ORIGIN: webUrl,
  DATABASE_URL: 'file:./e2e.db',
  STORAGE_DIR: './data/e2e-storage',
  // Deterministic runs: the automatic backup scheduler stays off in e2e.
  BACKUP_AUTO_ENABLED: '0',
  JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef',
  JWT_ACCESS_EXPIRES: '15m',
  JWT_REFRESH_EXPIRES: '7d',
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --dir ../api dev',
      url: `${E2E_API_ORIGIN}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: apiEnv,
    },
    {
      command: `pnpm --dir ../web dev --port ${E2E_WEB_PORT}`,
      url: webUrl,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        VITE_API_URL: E2E_API_BASE_URL,
      },
    },
  ],
});
