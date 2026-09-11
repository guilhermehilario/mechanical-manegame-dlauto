import type { PrismaClient } from '@prisma/client';
import { PasswordHasher } from '../modules/auth/password-hasher';
import type { Env } from '@mechanic-system/config';

/**
 * First-run admin provisioning.
 *
 * The packaged desktop app runs ONLY `prisma migrate deploy` on first run
 * (no seed) — without this, the installed product would have no way to log
 * in. When the database has no active ADMIN, one is created from
 * `FIRST_RUN_ADMIN_EMAIL` / `FIRST_RUN_ADMIN_PASSWORD`.
 *
 * Security (R4 — SEC-04): there is NO default password. If the variables are
 * missing, the API refuses to boot with an actionable message instead of
 * silently creating a guessable credential.
 */
export async function ensureFirstRunAdmin(
  prisma: PrismaClient,
  env: Pick<Env, 'FIRST_RUN_ADMIN_EMAIL' | 'FIRST_RUN_ADMIN_PASSWORD'>,
): Promise<void> {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN', active: true },
    select: { id: true },
  });
  if (existingAdmin) return;

  const email = env.FIRST_RUN_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.FIRST_RUN_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Nenhum usuário ADMIN existe no banco e FIRST_RUN_ADMIN_EMAIL/' +
        'FIRST_RUN_ADMIN_PASSWORD não foram definidos — configure-os para ' +
        'provisionar o acesso inicial.',
    );
  }

  const hasher = new PasswordHasher();
  const passwordHash = await hasher.hash(password);
  await prisma.user.create({
    data: { name: 'Administrator', email, passwordHash, role: 'ADMIN' },
  });
  console.log(`[first-run] ADMIN provisioned: ${email}`);
}
