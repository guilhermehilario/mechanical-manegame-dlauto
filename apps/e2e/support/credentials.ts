import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * R4/SEC-04: the E2E admin password never lives in the repository. It is
 * generated randomly per run by scripts/prepare-e2e-db.mjs and persisted to a
 * gitignored file that both the Playwright config and the tests read.
 */

export const E2E_ADMIN_EMAIL = 'admin@oficina.local';
// apps/e2e/support/../.e2e-admin-password — Playwright transpiles TS to CJS,
// where __dirname is available.
const PASSWORD_FILE = join(__dirname, '..', '.e2e-admin-password');

export function readE2EAdminPassword(): string {
  try {
    return readFileSync(PASSWORD_FILE, 'utf8').trim();
  } catch {
    throw new Error(
      `Arquivo .e2e-admin-password não encontrado — rode ` +
        `'pnpm --filter @mechanic-system/e2e test:e2e' (o script de preparação ` +
        'gera a senha aleatória antes de os servidores subirem).',
    );
  }
}
