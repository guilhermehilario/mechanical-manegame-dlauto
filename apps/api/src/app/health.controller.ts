import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../modules/auth/public.decorator';

/**
 * Liveness endpoint. Electron main polls it to know when the in-process
 * API is ready to serve the renderer. Unauthenticated by design —
 * explicitly allowlisted via @Public() (R5/SEC-05 deny-by-default).
 */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
