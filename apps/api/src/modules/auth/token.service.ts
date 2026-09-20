import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type { AuthUser } from '@mechanic-system/types';
import { PrismaService } from '../../prisma/prisma.service';

interface AccessPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Token lifecycle (spec §20):
 *  - short-lived signed access JWT;
 *  - refresh tokens are random, stored ONLY as SHA-256 hashes, rotated on use
 *    and revocable (theft detection: reuse of a revoked token revokes all).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  signAccessToken(user: AuthUser): string {
    return this.jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role });
  }

  verifyAccess(token: string): Promise<AccessPayload> {
    return this.jwt.verifyAsync<AccessPayload>(token);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt,
      },
    });
    return token;
  }

  /** Rotates the refresh token; returns the user id for re-issuing access. */
  async rotateRefreshToken(
    presentedToken: string,
  ): Promise<{ userId: string; refreshToken: string }> {
    const tokenHash = this.hashToken(presentedToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) {
      throw new UnauthorizedError('Invalid refresh token', ErrorCodes.UNAUTHORIZED);
    }
    if (stored.revokedAt) {
      // Token reuse detected — revoke the whole family for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedError('Refresh token reuse detected', ErrorCodes.UNAUTHORIZED);
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Refresh token expired', ErrorCodes.UNAUTHORIZED);
    }

    const nextToken = randomBytes(48).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          tokenHash: this.hashToken(nextToken),
          userId: stored.userId,
          expiresAt: new Date(Date.now() + this.refreshTtlMs()),
        },
      }),
    ]);

    return { userId: stored.userId, refreshToken: nextToken };
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private refreshTtlMs(): number {
    const raw = process.env.JWT_REFRESH_EXPIRES ?? '7d';
    const match = /^(\d+)([smhd])$/.exec(raw);
    if (!match || !match[1] || !match[2]) return 7 * 24 * 3600 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * (multipliers[unit] ?? 86_400_000);
  }
}
