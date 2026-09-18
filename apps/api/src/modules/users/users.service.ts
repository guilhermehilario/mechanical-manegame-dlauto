import { Injectable } from '@nestjs/common';
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import { UsersRepository } from './users.repository';
import { PasswordHasher } from '../auth/password-hasher';
import { TokenService } from '../auth/token.service';
import type {
  AdminResetPasswordServiceInput,
  ChangePasswordInput,
  CreateUserInput,
  UpdateUserInput,
  UserSortField,
  UserRole,
} from '@mechanic-system/validation';

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
    private readonly tokens: TokenService,
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

  async list(
    page: number,
    limit: number,
    search?: string,
    sortBy?: UserSortField,
    sortDir?: 'asc' | 'desc',
  ): Promise<{
    items: PublicUser[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const [users, total] = await Promise.all([
      this.usersRepository.list(page, limit, search, sortBy, sortDir),
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

  /**
   * Self-service password change (Bloco D/D3): requires the CURRENT password
   * (never trust the client), and revokes every refresh token afterwards so
   * other devices/sessions are forced out. The current session keeps its
   * access token until it expires (≤15 min) — acceptable and documented.
   */
  async changePassword(id: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError(ErrorCodes.USER_NOT_FOUND, 'User not found');
    }
    if (!(await this.hasher.verify(user.passwordHash, input.currentPassword))) {
      throw new DomainError('INVALID_CREDENTIALS', 'Current password is incorrect', 403);
    }
    if (input.currentPassword === input.newPassword) {
      throw new DomainError(
        'PASSWORD_UNCHANGED',
        'A nova senha deve ser diferente da atual',
        409,
      );
    }
    const passwordHash = await this.hasher.hash(input.newPassword);
    await this.usersRepository.updatePassword(id, passwordHash);
    await this.tokens.revokeAllForUser(id);
  }

  /**
   * Admin password reset (Bloco D/D3): no current password needed (caller is
   * ADMIN, verified by the controller's RolesGuard). Also revokes all sessions
   * of the target user. Guards: cannot reset your own password through this
   * path (use changePassword), and MECHANIC/ATTENDANT targets are out of an
   * ADMIN's scope in shops where managers handle staff — only ADMIN/MANAGER
   * targets may be reset by ADMIN (defense in depth on top of RBAC).
   */
  async adminResetPassword(
    targetUserId: string,
    input: AdminResetPasswordServiceInput,
  ): Promise<void> {
    if (targetUserId === input._actingAdminId) {
      throw new DomainError(
        'SELF_PASSWORD_RESET',
        'Use "Trocar senha" para alterar a sua própria senha',
        409,
      );
    }
    const user = await this.usersRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundError(ErrorCodes.USER_NOT_FOUND, 'User not found');
    }
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      throw new ForbiddenError(
        'Somente senhas de ADMIN/MANAGER podem ser redefinidas nesta rota',
        ErrorCodes.FORBIDDEN,
      );
    }
    const passwordHash = await this.hasher.hash(input.newPassword);
    await this.usersRepository.updatePassword(targetUserId, passwordHash);
    await this.tokens.revokeAllForUser(targetUserId);
  }
}
