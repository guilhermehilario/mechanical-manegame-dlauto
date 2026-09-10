import { type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import { DomainError } from '../errors/domain.error';
import type { ZodTypeAny, output } from 'zod';

/**
 * Validates any external input (body, query, param) against a Zod schema
 * (spec §19 — validation exists in the backend even when the frontend also
 * validates). Produces a stable VALIDATION_ERROR with field details.
 */
export class ZodValidationPipe<T extends ZodTypeAny>
  implements PipeTransform<unknown, output<T>>
{
  constructor(
    private readonly schema: T,
    private readonly source: 'body' | 'query' | 'param' = 'body',
  ) {}

  transform(value: unknown, _metadata: ArgumentMetadata): output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || this.source,
        message: issue.message,
      }));
      throw new DomainError('VALIDATION_ERROR', 'Validation failed', 400, details);
    }
    return result.data as output<T>;
  }
}
