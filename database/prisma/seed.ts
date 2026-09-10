/**
 * Development seed (spec: database/seed).
 * Creates the initial ADMIN user. Password comes from env or a documented
 * default for local development only.
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
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@oficina.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';

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
  console.log('Password: value of SEED_ADMIN_PASSWORD env, or the documented dev default.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
