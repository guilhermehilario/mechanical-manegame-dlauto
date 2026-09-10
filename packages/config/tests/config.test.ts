import { describe, expect, it } from 'vitest';
import { loadEnv, testEnv } from '../src/index';

describe('env config', () => {
  it('accepts a valid environment', () => {
    const env = testEnv();
    expect(env.API_PORT).toBe(0);
    expect(env.JWT_ACCESS_SECRET.length).toBeGreaterThanOrEqual(16);
  });

  it('rejects missing required variables with a readable error', () => {
    expect(() => loadEnv({})).toThrow(/Invalid environment configuration/);
  });

  it('rejects invalid port', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: 'file:./x.db',
        JWT_ACCESS_SECRET: '0123456789abcdef',
        JWT_REFRESH_SECRET: '0123456789abcdef',
        API_PORT: '99999',
      }),
    ).toThrow();
  });
});
