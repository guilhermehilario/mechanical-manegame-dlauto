import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type { AuthUser, LoginResponse, RefreshResponse } from '@mechanic-system/types';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';
import { UsersRepository } from '../users/users.repository';
import type { LoginInput, RefreshInput } from '@mechanic-system/validation';

/**
 * Authentication use cases (spec §20):
 *  - generic error on login (no user-enumeration feedback);
 *  - refresh rotation; logout revokes all sessions of the user.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async login(input: LoginInput): Promise<LoginResponse> {
    const user = await this.usersRepository.findByEmail(input.email);
    if (!user || !user.active) {
      throw new UnauthorizedError('Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    const passwordOk = await this.hasher.verify(user.passwordHash, input.password);
    if (!passwordOk) {
      throw new UnauthorizedError('Invalid credentials', ErrorCodes.INVALID_CREDENTIALS);
    }

    const authUser: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.tokens.signAccessToken(authUser);
    const refreshToken = await this.tokens.issueRefreshToken(user.id);

    return { user: authUser, accessToken, refreshToken };
  }

  async refresh(input: RefreshInput): Promise<RefreshResponse> {
    const { userId, refreshToken } = await this.tokens.rotateRefreshToken(input.refreshToken);
    const user = await this.usersRepository.findById(userId);
    if (!user || !user.active) {
      throw new UnauthorizedError('User is inactive', ErrorCodes.UNAUTHORIZED);
    }
    const accessToken = this.tokens.signAccessToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    return { accessToken, refreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }
}
