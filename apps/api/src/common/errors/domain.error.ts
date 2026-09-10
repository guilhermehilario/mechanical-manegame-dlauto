/**
 * Domain errors (spec §27).
 * Carries a stable machine-readable code + HTTP status. The global exception
 * filter translates these into the standard envelope; internal errors never
 * leak stack traces or database details.
 */

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, 409, details);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(code, message, 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Insufficient permissions', code = 'FORBIDDEN') {
    super(code, message, 403);
  }
}
