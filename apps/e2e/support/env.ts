/**
 * Single source of truth for the e2e stack ports/origins. Ports are
 * configurable so the suite can run next to a developer's own dev stack
 * (which usually holds 3001/5173):
 *
 *   E2E_API_PORT=3101 E2E_WEB_PORT=5174 pnpm --filter @mechanic-system/e2e test:e2e
 */

export const E2E_API_PORT = process.env.E2E_API_PORT ?? '3001';
export const E2E_WEB_PORT = process.env.E2E_WEB_PORT ?? '5173';

export const E2E_API_ORIGIN = `http://127.0.0.1:${E2E_API_PORT}`;
export const E2E_API_BASE_URL = `${E2E_API_ORIGIN}/api/v1`;
export const E2E_WEB_URL = `http://localhost:${E2E_WEB_PORT}`;
