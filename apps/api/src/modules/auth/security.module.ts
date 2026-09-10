import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';

/**
 * Cross-cutting security providers (spec §20).
 * Imported by any module that needs authentication/authorization — keeps the
 * dependency graph acyclic (UsersModule ← SecurityModule ← nothing,
 * AuthModule ← SecurityModule + UsersModule).
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m' },
      }),
    }),
  ],
  providers: [PasswordHasher, TokenService, JwtAuthGuard, RolesGuard],
  exports: [PasswordHasher, TokenService, JwtAuthGuard, RolesGuard],
})
export class SecurityModule {}
