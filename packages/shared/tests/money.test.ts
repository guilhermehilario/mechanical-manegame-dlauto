import { describe, expect, it } from 'vitest';
import {
  applyDiscountCents,
  assertCents,
  formatBRL,
  isCents,
  multiplyCents,
  parseToCents,
  sumCents,
} from '../src/money';

describe('money', () => {
  it('accepts valid integer cents', () => {
    expect(isCents(0)).toBe(true);
    expect(isCents(15000)).toBe(true);
    expect(isCents(-500)).toBe(true);
  });

  it('rejects non-integers and unsafe values', () => {
    expect(isCents(10.5)).toBe(false);
    expect(isCents(Number.NaN)).toBe(false);
    expect(isCents(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isCents('100')).toBe(false);
  });

  it('asserts with a helpful message', () => {
    expect(() => assertCents(1.5)).toThrow('integer amount in cents');
  });

  it('sums cents', () => {
    expect(sumCents(100, 200, 300)).toBe(600);
  });

  it('multiplies and applies discounts without float drift', () => {
    expect(multiplyCents(1099, 3)).toBe(3297);
    expect(applyDiscountCents(3297, 97)).toBe(3200);
  });

  it('rejects discount larger than amount', () => {
    expect(() => applyDiscountCents(100, 200)).toThrow();
  });

  it('rejects invalid quantity', () => {
    expect(() => multiplyCents(100, -1)).toThrow();
    expect(() => multiplyCents(100, Number.NaN)).toThrow();
  });

  it('formats BRL for presentation only', () => {
    expect(formatBRL(15000)).toContain('150,00');
  });

  it('parses decimal strings into cents', () => {
    expect(parseToCents('1234.50')).toBe(123450);
    expect(parseToCents('1234,50')).toBe(123450);
    expect(parseToCents('0.01')).toBe(1);
  });

  it('rejects invalid decimal strings', () => {
    expect(() => parseToCents('abc')).toThrow();
  });
});
