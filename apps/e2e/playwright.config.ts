import { defineConfig, devices } from '@playwright/test';

const apiEnv = {
  ...process.env,
  NODE_ENV: 'production',
  LOG_LEVEL: 'error',
  API_PORT: '3001',
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'file:./e2e.db',
  STORAGE_DIR: './data/e2e-storage',
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
    baseURL: 'http://localhost:5173',
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
      url: 'http://127.0.0.1:3001/api/v1/health',
      reuseExistingServer: false,
      timeout: 60_000,
      env: apiEnv,
    },
    {
      command: 'pnpm --dir ../web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});