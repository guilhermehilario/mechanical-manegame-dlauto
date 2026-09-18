import type { PrismaClient } from '@prisma/client';
import { PasswordHasher } from '../modules/auth/password-hasher';
import type { Env } from '@mechanic-system/config';

/**
 * First-run admin provisioning (automation path).
 *
 * The packaged desktop app runs ONLY `prisma migrate deploy` on first run
 * (no seed). Two provisioning paths exist:
 *
 *  1. **Automation/deploy** — when `FIRST_RUN_ADMIN_EMAIL` /
 *     `FIRST_RUN_ADMIN_PASSWORD` are set, the admin is created here on boot
 *     (headless installs, E2E, CI). No default credential (R4/SEC-04).
 *  2. **Interactive first access (F1)** — when the variables are absent and
 *     the DB has no ADMIN, boot proceeds and the renderer shows the
 *     "primeiro acesso" screen, which calls `POST /auth/setup`. The service
 *     refuses to run after an admin exists, so there is still no default or
 *     guessable credential.
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
    // F1: hand control to the first-access screen instead of failing to boot.
    console.log(
      '[first-run] Nenhum ADMIN e FIRST_RUN_ADMIN_* ausente — a tela de ' +
        'primeiro acesso será exibida no app.',
    );
    return;
  }

  const hasher = new PasswordHasher();
  const passwordHash = await hasher.hash(password);
  await prisma.user.create({
    data: { name: 'Administrator', email, passwordHash, role: 'ADMIN' },
  });
  console.log(`[first-run] ADMIN provisioned: ${email}`);
}
