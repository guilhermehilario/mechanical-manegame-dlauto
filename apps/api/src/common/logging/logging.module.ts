import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

/**
 * Structured logging (spec §26):
 *  - JSON logs with a request id per request for correlation;
 *  - PII redaction: cpf, phone, email, password, tokens never hit the logs;
 *  - stack traces omitted in production responses (handled by the filter).
 *
 * Pino-pretty is intentionally NOT used in production builds.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.refreshToken',
  '*.accessToken',
  '*.cpf',
  '*.phone',
  '*.email',
];

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: () => randomUUID(),
        redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
        autoLogging: {
          // Health checks (incl. the /api/v1 prefix) are readiness probes —
          // logging them would only add noise (Electron polls periodically).
          ignore: (req) => (req.url ?? '').endsWith('/health'),
        },
        // NOTE: no in-process pino-pretty transport — it spawns a worker thread
        // that can deadlock under tsx. For pretty dev logs run:
        //   pnpm dev:api | pnpm exec pino-pretty
      },
    }),
  ],
})
export class AppLoggingModule {}
