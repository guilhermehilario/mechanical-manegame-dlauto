import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type { AuthenticatedRequest } from './jwt-auth.guard';

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Authorization (spec §20). Use together with JwtAuthGuard:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @RequireRoles('ADMIN', 'MANAGER')
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.user?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenError('Your role does not allow this action', ErrorCodes.FORBIDDEN);
    }
    return true;
  }
}
