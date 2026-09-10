import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Liveness endpoint. Electron main polls it to know when the in-process
 * API is ready to serve the renderer. Unauthenticated by design.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
