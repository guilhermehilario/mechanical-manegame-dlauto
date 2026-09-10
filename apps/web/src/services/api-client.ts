import type { ApiResponse, ApiError } from '@mechanic-system/types';

/**
 * Thin HTTP client (spec §22 — React → API Client → NestJS, never direct DB).
 *  - unwraps the standard envelope;
 *  - converts error envelopes into a typed ApiClientError;
 *  - attaches the bearer token when a getter is provided.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => string | null | undefined;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  private async request<TResponse>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<TResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.options.getToken?.();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      // Network failure — e.g. API still booting. Never leak internals.
      throw new ApiClientError('NETWORK_ERROR', 'Servidor indisponível', 0);
    }

    const payload = (await response.json().catch(() => null)) as ApiResponse<TResponse> | null;

    if (!response.ok || !payload || !payload.success) {
      const error: ApiError =
        payload && !payload.success
          ? payload.error
          : { code: 'UNKNOWN', message: `HTTP ${response.status}` };
      throw new ApiClientError(error.code, error.message, response.status, error.details);
    }

    // Successful envelope: { success: true, data }
    return (payload as { success: true; data: TResponse }).data;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /**
   * Multipart upload (Fase 6 images). FormData sets its own Content-Type
   * boundary — the JSON header must NOT be sent.
   */
  postForm<T>(path: string, form: FormData): Promise<T> {
    return this.requestRaw<T>('POST', path, form);
  }

  /** Fetches raw bytes with auth (image download via <img src> is impossible
   * with header-based auth, so callers get an object URL). */
  async getBlob(path: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    const token = this.options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, { method: 'GET', headers });
    } catch {
      throw new ApiClientError('NETWORK_ERROR', 'Servidor indisponível', 0);
    }
    if (!response.ok) {
      throw new ApiClientError('UNKNOWN', `HTTP ${response.status}`, response.status);
    }
    return response.blob();
  }

  private async requestRaw<TResponse>(
    method: string,
    path: string,
    body: FormData,
  ): Promise<TResponse> {
    const headers: Record<string, string> = {};
    const token = this.options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, { method, headers, body });
    } catch {
      throw new ApiClientError('NETWORK_ERROR', 'Servidor indisponível', 0);
    }
    const payload = (await response.json().catch(() => null)) as ApiResponse<TResponse> | null;
    if (!response.ok || !payload || !payload.success) {
      const error: ApiError =
        payload && !payload.success
          ? payload.error
          : { code: 'UNKNOWN', message: `HTTP ${response.status}` };
      throw new ApiClientError(error.code, error.message, response.status, error.details);
    }
    return (payload as { success: true; data: TResponse }).data;
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
