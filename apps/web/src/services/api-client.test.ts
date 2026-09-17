import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './api-client';

const mockFetch = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiClient', () => {
  it('unwraps success envelopes', async () => {
    global.fetch = mockFetch(200, { success: true, data: { hello: 'world' } });
    const client = new ApiClient({ baseUrl: 'http://x' });
    await expect(client.get('/thing')).resolves.toEqual({ hello: 'world' });
  });

  it('throws typed errors from error envelopes', async () => {
    global.fetch = mockFetch(404, {
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    });
    const client = new ApiClient({ baseUrl: 'http://x' });
    await expect(client.get('/users/1')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
      status: 404,
    });
  });

  it('maps network failures to NETWORK_ERROR without leaking details', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED boom secret'));
    const client = new ApiClient({ baseUrl: 'http://x' });
    await expect(client.get('/users')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  it('attaches the bearer token when available', async () => {
    const fetchMock = mockFetch(200, { success: true, data: null });
    global.fetch = fetchMock;
    const client = new ApiClient({ baseUrl: 'http://x', getToken: () => 'tok-123' });
    await client.get('/me');
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('resolves void on 204 No Content (no envelope)', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ApiClient({ baseUrl: 'http://x' });
    await expect(client.delete('/users/usr_1')).resolves.toBeUndefined();
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    let token: string | null = 'old-token';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { ok: 1 } }), { status: 200 }),
      );
    global.fetch = fetchMock;
    const client = new ApiClient({
      baseUrl: 'http://x',
      getToken: () => token,
      onUnauthorized: () => {
        token = 'new-token'; // simulated rotation
        return Promise.resolve(true);
      },
    });

    await expect(client.get('/me')).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryHeaders = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect((retryHeaders.headers as Record<string, string>).Authorization).toBe('Bearer new-token');
  });

  it('does not retry when the session refresh fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } }),
        { status: 401 },
      ),
    );
    global.fetch = fetchMock;
    const client = new ApiClient({
      baseUrl: 'http://x',
      getToken: () => 'old-token',
      onUnauthorized: () => Promise.resolve(false),
    });

    await expect(client.get('/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
