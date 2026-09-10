import { rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Prepara um banco E2E limpo (migrações + seed do admin) ANTES de o Playwright
 * subir os servidores. Roda o API/prisma resolvem `file:./e2e.db` relativo ao
 * schema, então o banco vive em database/prisma/e2e.db (gitignored via *.db).
 *
 * Deve rodar antes de `playwright test`: o PrismaClient da API cacheia o caminho
 * no $connect; se o arquivo for substituído depois do boot, o engine fica preso
 * a um inode órfão e as escritas falham com SQLITE_READONLY.
 */
const e2eDir = dirname(fileURLToPath(import.meta.url));
const dbPath = join(e2eDir, '..', '..', 'database', 'prisma', 'e2e.db');

const env = {
  ...process.env,
  DATABASE_URL: 'file:./e2e.db',
  SEED_ADMIN_EMAIL: 'admin@oficina.local',
  SEED_ADMIN_PASSWORD: 'admin1234',
};

await rm(dbPath, { force: true });
execFileSync('pnpm', ['--filter', '@mechanic-system/database', 'db:deploy'], { cwd: e2eDir, env, stdio: 'inherit' });
execFileSync('pnpm', ['--filter', '@mechanic-system/database', 'db:seed'], { cwd: e2eDir, env, stdio: 'inherit' });
console.log('[e2e] banco preparado em database/prisma/e2e.db');