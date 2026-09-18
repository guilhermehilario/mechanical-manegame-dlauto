import { Injectable } from '@nestjs/common';
import { ConflictError, UnauthorizedError } from '../../common/errors/domain.error';
import { ErrorCodes } from '@mechanic-system/types';
import type {
  AuthUser,
  LoginResponse,
  RefreshResponse,
  SetupStatus,
} from '@mechanic-system/types';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';
import { UsersRepository } from '../users/users.repository';
import type {
  LoginInput,
  RefreshInput,
  SetupAdminInput,
} from '@mechanic-system/validation';

/**
 * Authentication use cases (spec §20):
 *  - generic error on login (no user-enumeration feedback);
 *  - refresh rotation; logout revokes all sessions of the user;
 *  - first-run admin provisioning (F1): while the DB has no active ADMIN,
 *    the public setup screen may create one — never a default credential.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  /** True while the setup screen must be shown instead of the login form. */
  async getSetupStatus(): Promise<SetupStatus> {
    const adminExists = await this.usersRepository.hasActiveAdmin();
    return { needsSetup: !adminExists };
  }

  /**
   * Creates the very first ADMIN. Refuses once any active ADMIN exists so the
   * endpoint can never be used to mint extra admins after setup. The password
   * is hashed with Argon2id; the caller logs in normally afterwards.
   */
  async setupFirstAdmin(input: SetupAdminInput): Promise<AuthUser> {
    const adminExists = await this.usersRepository.hasActiveAdmin();
    if (adminExists) {
      throw new ConflictError(
        ErrorCodes.SETUP_ALREADY_COMPLETED,
        'A configuração inicial já foi concluída.',
      );
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.usersRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'ADMIN',
    });

    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

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
