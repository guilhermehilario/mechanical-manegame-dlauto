/**
 * Development seed (spec: database/seed).
 * Creates the initial ADMIN user.
 *
 * R4 (SEC-04): there is NO default credential anymore. Both values are
 * REQUIRED from the environment — the seed fails fast with an actionable
 * message instead of creating a guessable admin. Used by `pnpm db:seed`
 * (development) and by the E2E setup (random password per run).
 *
 * Uses the same argon2id algorithm and parameters as the API so the seeded
 * user can authenticate immediately.
 *
 * Run: pnpm db:seed
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error(
      'Seed aborted: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.\n' +
        'R4/SEC-04 — this project ships no default credentials. Copy .env.example ' +
        'to .env and choose your own local admin credentials.',
    );
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Admin user already exists: ${adminEmail}`);
    return;
  }

  const passwordHash = await hash(adminPassword, {
    memoryCost: 19456, // 19 MiB — OWASP recommended baseline
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.create({
    data: {
      name: 'Administrator',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`Seeded admin user: ${adminEmail}`);
  console.log('Password: value of SEED_ADMIN_PASSWORD (never printed).');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
