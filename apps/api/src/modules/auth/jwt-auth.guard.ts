import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedError } from '../../common/errors/domain.error';
import { ErrorCodes, type UserRole } from '@mechanic-system/types';
import { TokenService } from './token.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

/**
 * Authentication (spec §20). Registered GLOBALLY as APP_GUARD in AppModule
 * (R5/SEC-05): every route requires a valid bearer token UNLESS explicitly
 * marked @Public() (health, auth/login, auth/refresh). Controllers no longer
 * declare JwtAuthGuard per route — deny-by-default is the rule.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7) || null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedError('Missing bearer token', ErrorCodes.UNAUTHORIZED);
    }

    try {
      const payload = await this.tokens.verifyAccess(token);
      request.user = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        role: payload.role as UserRole,
      };
      return true;
    } catch {
      throw new UnauthorizedError('Invalid or expired token', ErrorCodes.UNAUTHORIZED);
    }
  }
}
