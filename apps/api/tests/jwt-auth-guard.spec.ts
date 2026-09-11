import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import type { TokenService } from '../src/modules/auth/token.service';
import { Public, IS_PUBLIC_KEY } from '../src/modules/auth/public.decorator';
import { UnauthorizedError } from '../src/common/errors/domain.error';

/**
 * R5/SEC-05 — deny-by-default authentication:
 *  - a route WITHOUT @Public() requires a valid bearer token;
 *  - @Public() (handler or class level) bypasses authentication;
  * - a valid token attaches the user payload to the request.
 */
function makeContext(request: {
  headers: Record<string, string>;
  user?: unknown;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  } as unknown as ExecutionContext;
}

function makeReflector(isPublic: boolean): Reflector {
  return {
    getAllAndOverride: vi.fn(() => isPublic),
  } as unknown as Reflector;
}

function makeTokenService(verify: ReturnType<typeof vi.fn>): TokenService {
  return { verifyAccess: verify } as unknown as TokenService;
}

describe('JwtAuthGuard (global, R5/SEC-05)', () => {
  let verifyAccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    verifyAccess = vi.fn(() =>
      Promise.resolve({ sub: 'usr_1', name: 'Admin', email: 'a@b.c', role: 'ADMIN' }),
    );
  });

  it('rejects anonymous requests with 401 when no @Public()', async () => {
    const guard = new JwtAuthGuard(makeReflector(false), makeTokenService(verifyAccess));

    await expect(
      guard.canActivate(makeContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(verifyAccess).not.toHaveBeenCalled();
  });

  it('rejects malformed Authorization headers (no Bearer prefix)', async () => {
    const guard = new JwtAuthGuard(makeReflector(false), makeTokenService(verifyAccess));

    await expect(
      guard.canActivate(makeContext({ headers: { authorization: 'Basic abc' } })),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an invalid/expired token even when present', async () => {
    verifyAccess.mockRejectedValueOnce(new Error('jwt expired'));
    const guard = new JwtAuthGuard(makeReflector(false), makeTokenService(verifyAccess));
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers: { authorization: 'Bearer bad-token' },
    };

    await expect(guard.canActivate(makeContext(request))).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(request.user).toBeUndefined();
  });

  it('allows @Public() routes without any token (handler-level metadata)', async () => {
    const guard = new JwtAuthGuard(makeReflector(true), makeTokenService(verifyAccess));

    await expect(
      guard.canActivate(makeContext({ headers: {} })),
    ).resolves.toBe(true);
    expect(verifyAccess).not.toHaveBeenCalled();
  });

  it('attaches the verified payload to request.user for protected routes', async () => {
    const guard = new JwtAuthGuard(makeReflector(false), makeTokenService(verifyAccess));
    const request: { headers: Record<string, string>; user?: unknown } = {
      headers: { authorization: 'Bearer good-token' },
    };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'usr_1',
      name: 'Admin',
      email: 'a@b.c',
      role: 'ADMIN',
    });
  });

  it('the @Public() decorator sets the metadata key the guard reads', () => {
    // Guard + decorator share the SAME key; this pins the contract in both
    // placements Nest supports (class-level and method-level via descriptor).
    const decorator = Public();

    class Host {
      handler(): void {}
    }
    const decoratedClass = decorator(Host) as object;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, decoratedClass)).toBe(true);

    const descriptor = Object.getOwnPropertyDescriptor(Host.prototype, 'handler');
    if (!descriptor) throw new Error('handler descriptor missing');
    decorator(Host.prototype, 'handler', descriptor);
    const handlerFn = descriptor.value as object;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handlerFn)).toBe(true);
  });
});
