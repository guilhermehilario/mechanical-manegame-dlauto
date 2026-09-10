import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UnauthorizedError } from '../../common/errors/domain.error';
import { loginSchema, refreshSchema } from '@mechanic-system/validation';
import type { LoginInput, RefreshInput } from '@mechanic-system/validation';
import type { AuthUser, LoginResponse, RefreshResponse } from '@mechanic-system/types';
import { AuthService } from './auth.service';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';

// NOTE: no local EnvelopeInterceptor — the global APP_INTERCEPTOR already
// wraps every response (single envelope, spec §27).
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(loginSchema)) input: LoginInput): Promise<LoginResponse> {
    return this.authService.login(input);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) input: RefreshInput,
  ): Promise<RefreshResponse> {
    return this.authService.refresh(input);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest): AuthUser {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedError();
    }
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: AuthenticatedRequest): Promise<void> {
    if (request.user) {
      await this.authService.logout(request.user.id);
    }
  }
}
