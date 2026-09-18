import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Data access for users (spec §22). No business rules here.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** True when at least one active ADMIN exists (first-run setup gate, F1). */
  async hasActiveAdmin(): Promise<boolean> {
    const admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN', active: true },
      select: { id: true },
    });
    return admin !== null;
  }

  list(page: number, limit: number, search?: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  count(search?: string): Promise<number> {
    return this.prisma.user.count({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : undefined,
    });
  }

  create(data: { name: string; email: string; passwordHash: string; role: User['role'] }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Partial<{ name: string; email: string; role: User['role']; active: boolean }>): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  updatePassword(id: string, passwordHash: string): Promise<void> {
    return this.prisma.user
      .update({ where: { id }, data: { passwordHash } })
      .then(() => undefined);
  }
}
