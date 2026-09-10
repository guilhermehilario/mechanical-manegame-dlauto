import {
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import type { ApiSuccessResponse } from '@mechanic-system/types';
import { map, type Observable } from 'rxjs';

/**
 * Wraps every successful response in the standard envelope (spec §27):
 *   { success: true, data: ... }
 * Errors are handled by AllExceptionsFilter into { success: false, error }.
 * Raw binary responses (StreamableFile — e.g. image downloads, Fase 6) pass
 * through unwrapped: bytes are not JSON.
 */
export class EnvelopeInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T> | StreamableFile> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T> | StreamableFile> {
    return next.handle().pipe(
      map((data) =>
        data instanceof StreamableFile ? data : { success: true as const, data },
      ),
    );
  }
}
