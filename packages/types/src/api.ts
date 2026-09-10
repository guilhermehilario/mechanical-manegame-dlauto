/**
 * Standard API envelope (spec §27).
 * Every response follows { success, data } or { success:false, error }.
 */

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Paginated payload (spec §25). */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Well-known error codes. Keep stable — clients rely on them. */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  CPF_ALREADY_EXISTS: 'CPF_ALREADY_EXISTS',
  VEHICLE_NOT_FOUND: 'VEHICLE_NOT_FOUND',
  VEHICLE_PLATE_ALREADY_EXISTS: 'VEHICLE_PLATE_ALREADY_EXISTS',
  SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
  SUPPLIER_NOT_FOUND: 'SUPPLIER_NOT_FOUND',
  CNPJ_ALREADY_EXISTS: 'CNPJ_ALREADY_EXISTS',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_CODE_ALREADY_EXISTS: 'PRODUCT_CODE_ALREADY_EXISTS',
  APPOINTMENT_NOT_FOUND: 'APPOINTMENT_NOT_FOUND',
  INVALID_APPOINTMENT_TRANSITION: 'INVALID_APPOINTMENT_TRANSITION',
  APPOINTMENT_CONFLICT: 'APPOINTMENT_CONFLICT',
  INVALID_OS_TRANSITION: 'INVALID_OS_TRANSITION',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
