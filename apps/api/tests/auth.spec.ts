import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@prisma/client';
import { PasswordHasher } from '../src/modules/auth/password-hasher';
import { TokenService } from '../src/modules/auth/token.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { UsersService } from '../src/modules/users/users.service';
import type { UsersRepository } from '../src/modules/users/users.repository';

// ─────────────────────────────────────────────────────────────
// Fakes
// ─────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr_1',
    name: 'Admin',
    email: 'admin@oficina.local',
    passwordHash: '',
    role: 'ADMIN',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface RefreshTokenCreateArgs {
  data: { tokenHash: string; userId: string; expiresAt: Date };
}

function prismaMock() {
  return {
    refreshToken: {
      create: vi.fn((args: RefreshTokenCreateArgs) => ({
        id: 'rt_1',
        ...args.data,
      })),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
    },
    $transaction: vi.fn((ops: unknown[]) => Promise.resolve(ops)),
  };
}

function jwtMock() {
  return {
    sign: vi.fn(() => 'access-token'),
    verifyAsync: vi.fn(() =>
      Promise.resolve({ sub: 'usr_1', email: 'a@b.c', name: 'Admin', role: 'ADMIN' }),
    ),
  };
}

function usersRepoMock() {
  return {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn((data: Record<string, unknown>) => makeUser(data as Partial<User>)),
    update: vi.fn((id: string, data: Record<string, unknown>) => makeUser({ id, ...data })),
    updatePassword: vi.fn((_id: string, _passwordHash: string) => Promise.resolve(undefined)),
  };
}

// ─────────────────────────────────────────────────────────────
// Password hashing (spec §20 — never plain text)
// ─────────────────────────────────────────────────────────────

describe('PasswordHasher', () => {
  it('hashes and verifies a password', async () => {
    const hasher = new PasswordHasher();
    const hashValue = await hasher.hash('secret123');
    expect(hashValue).not.toContain('secret123');
    await expect(hasher.verify(hashValue, 'secret123')).resolves.toBe(true);
    await expect(hasher.verify(hashValue, 'wrong')).resolves.toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// AuthService.login
// ─────────────────────────────────────────────────────────────

describe('AuthService.login', () => {
  let hasher: PasswordHasher;
  let repo: ReturnType<typeof usersRepoMock>;
  let tokens: TokenService;
  let prisma: ReturnType<typeof prismaMock>;
  let service: AuthService;

  beforeEach(() => {
    hasher = new PasswordHasher();
    repo = usersRepoMock();
    prisma = prismaMock();
    tokens = new TokenService(jwtMock() as never, prisma as never);
    service = new AuthService(repo as unknown as UsersRepository, hasher, tokens);
  });

  it('returns tokens for valid credentials', async () => {
    const user = makeUser({ passwordHash: await hasher.hash('secret123') });
    repo.findByEmail.mockResolvedValue(user);

    const result = await service.login({ email: user.email, password: 'secret123' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe(user.email);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects unknown email with generic error (no enumeration)', async () => {
    repo.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'ghost@x.com', password: 'whatever1' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('rejects wrong password with generic error', async () => {
    repo.findByEmail.mockResolvedValue(
      makeUser({ passwordHash: await hasher.hash('secret123') }),
    );
    await expect(
      service.login({ email: 'admin@oficina.local', password: 'wrong-pass-1' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('rejects inactive users', async () => {
    repo.findByEmail.mockResolvedValue(
      makeUser({ active: false, passwordHash: await hasher.hash('secret123') }),
    );
    await expect(
      service.login({ email: 'admin@oficina.local', password: 'secret123' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});

// ─────────────────────────────────────────────────────────────
// Refresh rotation + theft detection (spec §20)
// ─────────────────────────────────────────────────────────────

describe('TokenService rotation', () => {
  function setup() {
    const prisma = prismaMock();
    const tokens = new TokenService(jwtMock() as never, prisma as never);
    return { prisma, tokens };
  }

  it('issues and rotates refresh tokens', async () => {
    const { prisma, tokens } = setup();
    const first = await tokens.issueRefreshToken('usr_1');
    expect(first).toBeTruthy();
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_1',
      tokenHash: 'abc',
      userId: 'usr_1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    const rotated = await tokens.rotateRefreshToken(first);
    expect(rotated.userId).toBe('usr_1');
    expect(rotated.refreshToken).not.toBe(first);
    // old revoked + new created inside a transaction (spec §36)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('revokes the whole family when a revoked token is reused', async () => {
    const { prisma, tokens } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_1',
      userId: 'usr_1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
    });

    await expect(tokens.rotateRefreshToken('stolen')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'usr_1', revokedAt: null } }),
    );
  });

  it('rejects expired refresh tokens', async () => {
    const { prisma, tokens } = setup();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_1',
      userId: 'usr_1',
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
    });
    await expect(tokens.rotateRefreshToken('expired')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

// ─────────────────────────────────────────────────────────────
// UsersService
// ─────────────────────────────────────────────────────────────

describe('UsersService', () => {
  function setup() {
    const hasher = new PasswordHasher();
    const repo = usersRepoMock();
    const prisma = prismaMock();
    const tokens = new TokenService(jwtMock() as never, prisma as never);
    const service = new UsersService(
      repo as unknown as UsersRepository,
      hasher,
      tokens,
    );
    return { repo, service };
  }

  it('creates a user and never exposes the hash', async () => {
    const { repo, service } = setup();
    repo.findByEmail.mockResolvedValue(null);

    const user = await service.create({
      name: 'Alice',
      email: 'alice@oficina.local',
      password: 'secret123',
      role: 'ATTENDANT',
    });

    expect(user.email).toBe('alice@oficina.local');
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects duplicate email', async () => {
    const { repo, service } = setup();
    repo.findByEmail.mockResolvedValue(makeUser());
    await expect(
      service.create({
        name: 'Bob',
        email: 'admin@oficina.local',
        password: 'secret123',
        role: 'ATTENDANT',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
  });

  it('returns 404 for missing user', async () => {
    const { repo, service } = setup();
    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      status: 404,
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Password change/reset (Bloco D — docs/todo-mvp.md)
// ─────────────────────────────────────────────────────────────

describe('UsersService.changePassword (self-service)', () => {
  function setup() {
    const hasher = new PasswordHasher();
    const repo = usersRepoMock();
    const prisma = prismaMock();
    const tokens = new TokenService(jwtMock() as never, prisma as never);
    const service = new UsersService(repo as unknown as UsersRepository, hasher, tokens);
    return { repo, service, hasher, tokens };
  }

  it('accepts the current password, rehashes and revokes sessions', async () => {
    const { repo, service, hasher, tokens } = setup();
    const revokeSpy = vi.spyOn(tokens, 'revokeAllForUser').mockResolvedValue(undefined);
    repo.findById.mockResolvedValue(
      makeUser({ passwordHash: await hasher.hash('old-secret-1') }),
    );

    await service.changePassword('usr_1', {
      currentPassword: 'old-secret-1',
      newPassword: 'new-secret-2',
    });

    expect(revokeSpy).toHaveBeenCalledWith('usr_1');
    // Repository received a fresh argon2 hash (never the plain password).
    const updateArgs = repo.updatePassword.mock.calls[0]?.[1] as string;
    expect(updateArgs).not.toContain('new-secret-2');
    await expect(hasher.verify(updateArgs, 'new-secret-2')).resolves.toBe(true);
  });

  it('rejects a wrong current password (403)', async () => {
    const { repo, service } = setup();
    repo.findById.mockResolvedValue(
      makeUser({ passwordHash: await new PasswordHasher().hash('old-secret-1') }),
    );
    await expect(
      service.changePassword('usr_1', {
        currentPassword: 'wrong-pass-9',
        newPassword: 'new-secret-2',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 403 });
  });

  it('rejects reusing the same password', async () => {
    const { repo, service } = setup();
    repo.findById.mockResolvedValue(
      makeUser({ passwordHash: await new PasswordHasher().hash('same-pass-1') }),
    );
    await expect(
      service.changePassword('usr_1', {
        currentPassword: 'same-pass-1',
        newPassword: 'same-pass-1',
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_UNCHANGED' });
  });
});

describe('UsersService.adminResetPassword', () => {
  function setup() {
    const hasher = new PasswordHasher();
    const repo = usersRepoMock();
    const prisma = prismaMock();
    const tokens = new TokenService(jwtMock() as never, prisma as never);
    const service = new UsersService(repo as unknown as UsersRepository, hasher, tokens);
    return { repo, service, tokens };
  }

  it('resets a manager password and revokes sessions', async () => {
    const { repo, service, tokens } = setup();
    const revokeSpy = vi.spyOn(tokens, 'revokeAllForUser').mockResolvedValue(undefined);
    repo.findById.mockResolvedValue(makeUser({ role: 'MANAGER' }));

    await service.adminResetPassword('usr_2', {
      newPassword: 'fresh-pass-1',
      _actingAdminId: 'usr_1',
    });

    expect(revokeSpy).toHaveBeenCalledWith('usr_2');
    expect(repo.updatePassword).toHaveBeenCalledWith('usr_2', expect.any(String));
  });

  it('refuses self-reset through the admin path (409)', async () => {
    const { service } = setup();
    await expect(
      service.adminResetPassword('usr_1', {
        newPassword: 'fresh-pass-1',
        _actingAdminId: 'usr_1',
      }),
    ).rejects.toMatchObject({ code: 'SELF_PASSWORD_RESET', status: 409 });
  });

  it('refuses MECHANIC/ATTENDANT targets (403)', async () => {
    const { repo, service } = setup();
    repo.findById.mockResolvedValue(makeUser({ role: 'MECHANIC' }));
    await expect(
      service.adminResetPassword('usr_2', {
        newPassword: 'fresh-pass-1',
        _actingAdminId: 'usr_1',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });
});
