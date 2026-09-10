/**
 * Money handling.
 *
 * Rule (spec §18): NEVER use float for monetary values. All amounts are
 * stored and transported as integer cents (`amountInCents`). Formatting to
 * BRL happens only at the presentation edge.
 */

/** Monetary amount in cents (integer). */
export type Cents = number;

/** ~R$ 900 million safety ceiling — shared with validation schemas. */
export const MAX_SAFE_CENTS = 900_000_000_00;

/** Type guard: value must be a finite integer within safe bounds. */
export function isCents(value: unknown): value is Cents {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= MAX_SAFE_CENTS
  );
}

/** Assert a value is a valid cents amount; throws otherwise. */
export function assertCents(value: unknown, label = 'amount'): Cents {
  if (!isCents(value)) {
    throw new Error(`${label} must be an integer amount in cents, got: ${String(value)}`);
  }
  return value;
}

/** Sum cents amounts with validation. */
export function sumCents(...amounts: Cents[]): Cents {
  return amounts.reduce<Cents>((total, amount) => {
    assertCents(amount);
    const result = total + amount;
    assertCents(result, 'sum result');
    return result;
  }, 0);
}

/** Multiply cents by a quantity (integer), rounding half-up to the nearest cent. */
export function multiplyCents(amount: Cents, quantity: number): Cents {
  assertCents(amount);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error(`quantity must be a non-negative finite number, got: ${String(quantity)}`);
  }
  const raw = amount * quantity;
  // Guard against quantity precision problems; result must still be integer cents.
  const rounded = Math.round(raw);
  assertCents(rounded, 'product result');
  return rounded;
}

/** Apply a per-item discount in cents; never negative. */
export function applyDiscountCents(amount: Cents, discount: Cents): Cents {
  assertCents(amount);
  assertCents(discount, 'discount');
  if (discount > amount) {
    throw new Error('discount cannot exceed the item amount');
  }
  return amount - discount;
}

/** Format cents as BRL currency string (presentation only). */
export function formatBRL(amount: Cents): string {
  assertCents(amount);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount / 100);
}

/** Parse a BRL-like decimal string (e.g. "1234.50") into cents. */
export function parseToCents(decimal: string): Cents {
  const normalized = decimal.trim().replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`invalid decimal value: ${decimal}`);
  }
  const cents = Math.round(value * 100);
  return assertCents(cents);
}
