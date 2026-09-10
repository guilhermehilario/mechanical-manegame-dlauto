import { describe, expect, it } from 'vitest';
import { createUserSchema, loginSchema, paginationQuerySchema } from '../src/index';

describe('validation schemas', () => {
  it('validates a user creation payload', () => {
    const parsed = createUserSchema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret123',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.role).toBe('ATTENDANT'); // default role
    }
  });

  it('rejects weak passwords', () => {
    const parsed = createUserSchema.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'short',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid login payloads', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'secret123' }).success).toBe(
      false,
    );
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '123' }).success).toBe(false);
  });

  it('rejects pagination limit above the backend cap (spec §25)', () => {
    expect(paginationQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
    const parsed = paginationQuerySchema.parse({ limit: '50' });
    expect(parsed.limit).toBe(50);
  });

  it('applies pagination defaults', () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });
});
