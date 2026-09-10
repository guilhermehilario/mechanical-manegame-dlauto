import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import type { Env } from '@mechanic-system/config';
import { AppModule } from './app.module';

export interface RunningApi {
  port: number;
  close: () => Promise<void>;
}

/**
 * Boots the NestJS API. Used by:
 *  - the standalone platform entry (src/platform.ts) during development;
 *  - the Electron main process, which starts the API in-process on
 *    127.0.0.1 so the renderer never needs an external server (offline-first).
 *
 * Security (spec §20): Helmet headers, CORS restricted to known origins,
 * loopback-only binding — the API is never exposed to the network.
 */
export async function bootstrapApi(env: Env): Promise<RunningApi> {
  // Make validated values visible to Nest subsystems (JwtModule factories).
  process.env.NODE_ENV = env.NODE_ENV;
  process.env.JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
  process.env.JWT_ACCESS_EXPIRES = env.JWT_ACCESS_EXPIRES;
  process.env.JWT_REFRESH_EXPIRES = env.JWT_REFRESH_EXPIRES;
  process.env.LOG_LEVEL = env.LOG_LEVEL;

  // Errors/warnings must ALWAYS be visible (spec §26/§27) — `logger: false`
  // would silence the exception filter's logging of unhandled errors.
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });

  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  await app.listen(env.API_PORT, '127.0.0.1');

  // Typed: resolve the final (possibly ephemeral) port from the app URL.
  const url = await app.getUrl();
  const match = /:(\d+)\//.exec(`${url}/`);
  const port = match?.[1] ? Number(match[1]) : env.API_PORT;

  return {
    port,
    close: async () => {
      await app.close();
    },
  };
}
