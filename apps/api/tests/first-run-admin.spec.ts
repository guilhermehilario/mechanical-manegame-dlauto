import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureFirstRunAdmin } from '../src/app/first-run-admin';

function prismaMock() {
  return {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(
        (_args: {
          data: { name: string; email: string; passwordHash: string; role: string };
        }) => Promise.resolve({ id: 'usr_1' }),
      ),
    },
  };
}

describe('ensureFirstRunAdmin', () => {
  let prisma: ReturnType<typeof prismaMock>;

  beforeEach(() => {
    prisma = prismaMock();
  });

  it('does nothing when an active admin already exists', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'usr_existing' });

    await ensureFirstRunAdmin(prisma as never, {});

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('does not throw when there is no admin and no env (F1 first-access screen)', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      ensureFirstRunAdmin(prisma as never, {}),
    ).resolves.toBeUndefined();

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('provisions the admin from env with a hashed, normalized password', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await ensureFirstRunAdmin(prisma as never, {
      FIRST_RUN_ADMIN_EMAIL: '  Dono@Oficina.Local ',
      FIRST_RUN_ADMIN_PASSWORD: 'secret123',
    });

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    const args = prisma.user.create.mock.calls[0]?.[0];
    expect(args?.data.email).toBe('dono@oficina.local');
    expect(args?.data.role).toBe('ADMIN');
    expect(args?.data.passwordHash).not.toContain('secret123');
  });
});
