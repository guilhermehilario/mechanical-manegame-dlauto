import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { UnauthorizedError } from '../../common/errors/domain.error';
import { ErrorCodes, type UserRole } from '@mechanic-system/types';
import { TokenService } from './token.service';
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
 * Route protection (spec §20). Bearer-token based; the renderer stores the
 * access token in memory only (never localStorage) to limit XSS impact.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7) || null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
