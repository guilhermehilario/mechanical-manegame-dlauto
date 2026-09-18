import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UnauthorizedError } from '../../common/errors/domain.error';
import { loginSchema, refreshSchema, setupAdminSchema } from '@mechanic-system/validation';
import type { LoginInput, RefreshInput, SetupAdminInput } from '@mechanic-system/validation';
import type {
  AuthUser,
  LoginResponse,
  RefreshResponse,
  SetupStatus,
} from '@mechanic-system/types';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './jwt-auth.guard';
import { Public } from './public.decorator';

// NOTE: no local EnvelopeInterceptor — the global APP_INTERCEPTOR already
// wraps every response (single envelope, spec §27).
// NOTE: no JwtAuthGuard here — authentication is GLOBAL since R5/SEC-05.
// Only login/refresh/setup are @Public(); me/logout inherit the global guard.
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * First-run gate (F1). Public: the web asks before showing the login form.
   * Leaks only whether an active ADMIN exists.
   */
  @Public()
  @Get('setup')
  setupStatus(): Promise<SetupStatus> {
    return this.authService.getSetupStatus();
  }

  /**
   * Creates the first ADMIN (F1). Public by necessity; the service refuses
   * with 409 SETUP_ALREADY_COMPLETED once an admin exists.
   */
  @Public()
  @Post('setup')
  @HttpCode(HttpStatus.CREATED)
  setup(
    @Body(new ZodValidationPipe(setupAdminSchema)) input: SetupAdminInput,
  ): Promise<AuthUser> {
    return this.authService.setupFirstAdmin(input);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) input: LoginInput): Promise<LoginResponse> {
    return this.authService.login(input);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) input: RefreshInput,
  ): Promise<RefreshResponse> {
    return this.authService.refresh(input);
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest): AuthUser {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedError();
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    if (request.user) {
      await this.authService.logout(request.user.id);
    }
  }
}
