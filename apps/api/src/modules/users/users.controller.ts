import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DomainError, UnauthorizedError } from '../../common/errors/domain.error';
import {
  adminResetPasswordSchema,
  changePasswordSchema,
  createUserSchema,
  idSchema,
  userQuerySchema,
} from '@mechanic-system/validation';
import type {
  AdminResetPasswordInput,
  ChangePasswordInput,
  CreateUserInput,
  UpdateUserInput,
  UserQuery,
} from '@mechanic-system/validation';
import type { AuthUser, Paginated } from '@mechanic-system/types';
import { UsersService } from './users.service';
import { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { RequireRoles, RolesGuard } from '../auth/roles.guard';

// NOTE: global APP_INTERCEPTOR provides the response envelope (spec §27).
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequireRoles('ADMIN', 'MANAGER')
  list(
    @Query(new ZodValidationPipe(userQuerySchema, 'query')) query: UserQuery,
  ): Promise<Paginated<AuthUser>> {
    return this.usersService.list(query.page, query.limit, query.search, query.sortBy, query.sortDir);
  }

  @Get(':id')
  // R3 (SEC-02): PII (email/role) must not leak to lower roles.
  @RequireRoles('ADMIN', 'MANAGER')
  async getById(
    @Param('id', new ZodValidationPipe(idSchema, 'param')) id: string,
  ): Promise<AuthUser> {
    const user = await this.usersService.getById(id);
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  @Post()
  @RequireRoles('ADMIN')
  create(
    @Body(new ZodValidationPipe(createUserSchema)) input: CreateUserInput,
  ): Promise<AuthUser> {
    return this.usersService.create(input).then((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN')
  async deactivate(
    @Param('id', new ZodValidationPipe(idSchema, 'param')) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    const actingUser = request.user;
    if (!actingUser) {
      throw new UnauthorizedError();
    }
    if (actingUser.id === id) {
      throw new DomainError('CONFLICT', 'You cannot deactivate your own account', 409);
    }
    await this.usersService.update(id, { active: false } as UpdateUserInput);
  }

  /**
   * Self-service password change (Bloco D) — ANY authenticated user.
   * No @RequireRoles: every role can change its own password.
   */
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeMyPassword(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(changePasswordSchema)) input: ChangePasswordInput,
  ): Promise<void> {
    const actingUser = request.user;
    if (!actingUser) {
      throw new UnauthorizedError();
    }
    await this.usersService.changePassword(actingUser.id, input);
  }

  /**
   * Admin reset of another user's password (Bloco D) — ADMIN only.
   * Revokes the target's sessions (forced re-login with the new password).
   */
  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles('ADMIN')
  async adminResetPassword(
    @Param('id', new ZodValidationPipe(idSchema, 'param')) targetUserId: string,
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(adminResetPasswordSchema)) input: AdminResetPasswordInput,
  ): Promise<void> {
    const actingUser = request.user;
    if (!actingUser) {
      throw new UnauthorizedError();
    }
    await this.usersService.adminResetPassword(targetUserId, {
      newPassword: input.newPassword,
      _actingAdminId: actingUser.id,
    });
  }
}
