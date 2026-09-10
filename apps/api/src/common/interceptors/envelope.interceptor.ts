import { type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { ApiSuccessResponse } from '@mechanic-system/types';
import { map, type Observable } from 'rxjs';

/**
 * Wraps every successful response in the standard envelope (spec §27):
 *   { success: true, data: ... }
 * Errors are handled by AllExceptionsFilter into { success: false, error }.
 */
export class EnvelopeInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(map((data) => ({ success: true as const, data })));
  }
}
