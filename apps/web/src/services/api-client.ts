import type { ApiResponse, ApiError } from '@mechanic-system/types';

/**
 * Thin HTTP client (spec §22 — React → API Client → NestJS, never direct DB).
 *  - unwraps the standard envelope;
 *  - converts error envelopes into a typed ApiClientError;
 *  - attaches the bearer token when a getter is provided.
 *
 * Session recovery (Bloco D1): when any request comes back 401 while a token
 * is attached, the onUnauthorized hook (a silent refresh) runs ONCE and the
 * request is retried with the fresh token. The refresh request itself is
 * never intercepted (callingRefresh guard) — if it fails the store is wiped
 * and the router lands back on the login screen.
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
  /** Called once per 401 to restore the session. Resolve true = retry. */
  onUnauthorized?: () => Promise<boolean>;
}

export class ApiClient {
  /** True while the onUnauthorized callback is running (refreshing). */
  private callingRefresh = false;

  constructor(private readonly options: ApiClientOptions) {}

  /**
   * Single-flight session refresh. The guard prevents recursion when the
   * refresh request itself answers 401 (expired/revoked refresh token) —
   * that failure surfaces to the hook, which wipes the session.
   */
  private async refreshAndRetry(): Promise<boolean> {
    if (this.options.onUnauthorized === undefined) return false;
    this.callingRefresh = true;
    try {
      return await this.options.onUnauthorized();
    } finally {
      this.callingRefresh = false;
    }
  }

  /**
   * Fetches once and, on a 401, refreshes the session and fetches again with
   * the new token. Looping/recursion is impossible: the refresh path is
   * short-circuited while it is running and at most one retry happens per
   * original call.
   */
  private async fetchWithAuth(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: string | FormData,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, { method, headers, body });
    } catch {
      // Network failure — e.g. API still booting. Never leak internals.
      throw new ApiClientError('NETWORK_ERROR', 'Servidor indisponível', 0);
    }

    if (response.status === 401 && this.options.getToken?.() != null && !this.callingRefresh) {
      const ok = await this.refreshAndRetry();
      if (ok) {
        // getToken was narrowed non-nullish by the guard above.
        const newToken = this.options.getToken();
        if (newToken) headers.Authorization = `Bearer ${newToken}`;
        try {
          response = await fetch(`${this.options.baseUrl}${path}`, { method, headers, body });
        } catch {
          throw new ApiClientError('NETWORK_ERROR', 'Servidor indisponível', 0);
        }
      }
    }
    return response;
  }

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

    const requestBody = body === undefined ? undefined : JSON.stringify(body);
    const response = await this.fetchWithAuth(method, path, headers, requestBody);

    // 204 No Content (DELETE /users/:id, PATCH …/password): no envelope, no
    // body — parsing it would only produce a confusing UNKNOWN error.
    if (response.status === 204) {
      return undefined as TResponse;
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

    const response = await this.fetchWithAuth('GET', path, headers);
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

    const response = await this.fetchWithAuth(method, path, headers, body);
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