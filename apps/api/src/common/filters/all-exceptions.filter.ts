import {
  type ArgumentsHost,
  type ExceptionFilter,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type ApiErrorResponse, ErrorCodes } from '@mechanic-system/types';
import { DomainError } from '../errors/domain.error';
import type { Request, Response } from 'express';

interface ErrorBody {
  message?: string | string[];
  code?: string;
  details?: unknown;
}

/** Multer raises plain Errors with a `code` — translate them to stable codes. */
interface MulterLikeError extends Error {
  code?: string;
}

const MULTER_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  LIMIT_FILE_SIZE: {
    status: 413,
    code: ErrorCodes.IMAGE_TOO_LARGE,
    message: 'Arquivo excede o limite de 5 MB',
  },
  LIMIT_UNEXPECTED_FILE: {
    status: 400,
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'Campo de arquivo inesperado (use "file")',
  },
};

/**
 * Translates every thrown error into the standard envelope (spec §27):
 *   { success: false, error: { code, message, details? } }
 *
 * Security rules (spec §20):
 *  - unknown/internal errors become generic INTERNAL_ERROR, no stack trace;
 *  - in production, HttpException internals are also reduced to stable codes;
 *  - request id is echoed so the structured log can be correlated.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    let status: number;
    let body: ApiErrorResponse;

    if (exception instanceof DomainError) {
      status = exception.status;
      body = {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.details !== undefined ? { details: exception.details } : {}),
        },
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorBody = exception.getResponse() as ErrorBody;
      const isDev = process.env.NODE_ENV !== 'production';
      const rawMessage: string | string[] | undefined = isDev
        ? errorBody.message
        : 'Request failed';
      const message =
        Array.isArray(rawMessage) ? rawMessage.join('; ') : (rawMessage ?? 'Request failed');
      body = {
        success: false,
        error: {
          code: errorBody.code ?? this.mapHttpStatusToCode(status),
          message,
          ...(isDev && errorBody.details !== undefined ? { details: errorBody.details } : {}),
        },
      };
    } else if (exception instanceof Error && exception.name === 'MulterError') {
      const mapped = MULTER_ERROR_MAP[(exception as MulterLikeError).code ?? ''];
      status = mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      body = {
        success: false,
        error: {
          code: mapped?.code ?? ErrorCodes.INTERNAL_ERROR,
          message: mapped?.message ?? 'Falha no upload do arquivo',
        },
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
      body = {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Internal server error',
        },
      };
    }

    // `id` is the request correlation id injected by pino-http; it is part of
    // the log line, so no need to echo it in the error body.
    this.logger.debug(`error response for request ${request.id}`);
    response.status(status).json(body);
  }

  private mapHttpStatusToCode(status: number): string {
    const codeByStatus: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: ErrorCodes.VALIDATION_ERROR,
      [HttpStatus.UNAUTHORIZED]: ErrorCodes.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCodes.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCodes.CONFLICT,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.RATE_LIMITED,
    };
    return codeByStatus[status] ?? ErrorCodes.INTERNAL_ERROR;
  }
}
