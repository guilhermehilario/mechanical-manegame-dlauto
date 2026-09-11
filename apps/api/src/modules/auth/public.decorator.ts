import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as publicly reachable — the global JwtAuthGuard (R5/SEC-05,
 * registered as APP_GUARD in AppModule) skips authentication for it.
 *
 * The allowlist is EXPLICIT and small by design (spec §20): liveness/health,
 * login and refresh. Anything else is protected by default — a new route
 * "forgotten" by its author can never be born public again.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
