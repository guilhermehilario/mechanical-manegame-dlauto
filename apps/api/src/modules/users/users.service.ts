import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import { UsersRepository } from './users.repository';
import { PasswordHasher } from '../auth/password-hasher';
import type { CreateUserInput, UpdateUserInput, UserRole } from '@mechanic-system/validation';

/** Public shape of a user — NEVER includes passwordHash (spec §20). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
}

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async create(input: CreateUserInput): Promise<PublicUser> {
    const existing = await this.usersRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError(ErrorCodes.EMAIL_ALREADY_EXISTS, 'E-mail already registered');
    }
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.usersRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });
    return toPublicUser(user);
  }

  async list(page: number, limit: number, search?: string): Promise<{
    items: PublicUser[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const [users, total] = await Promise.all([
      this.usersRepository.list(page, limit, search),
      this.usersRepository.count(search),
    ]);
    return {
      items: users.map(toPublicUser),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError(ErrorCodes.USER_NOT_FOUND, 'User not found');
    }
    return toPublicUser(user);
  }

  async update(id: string, input: UpdateUserInput): Promise<PublicUser> {
    await this.getById(id);
    if (input.email) {
      const existing = await this.usersRepository.findByEmail(input.email);
      if (existing && existing.id !== id) {
        throw new ConflictError(ErrorCodes.EMAIL_ALREADY_EXISTS, 'E-mail already registered');
      }
    }
    const user = await this.usersRepository.update(id, input);
    return toPublicUser(user);
  }
}
