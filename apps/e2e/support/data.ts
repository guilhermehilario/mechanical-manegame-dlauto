/** Random valid data generators for e2e scenarios (no seeded catalogs). */

/** Gera um CPF válido (11 dígitos, dígitos verificadores corretos). */
export function validCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (digits: number[], span: number): number => {
    const sum = digits.reduce((acc, d, i) => acc + d * (span - i), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const dv1 = dv(base, 10);
  const dv2 = dv([...base, dv1], 11);
  const full = [...base, dv1, dv2].join('');
  return `${full.slice(0, 3)}.${full.slice(3, 6)}.${full.slice(6, 9)}-${full.slice(9)}`;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Placa válida (formato antigo AAA9999). */
export function uniquePlate(): string {
  const letter = (): string => LETTERS[Math.floor(Math.random() * LETTERS.length)] ?? 'A';
  const digit = (): string => String(Math.floor(Math.random() * 10));
  return `${letter()}${letter()}${letter()}${digit()}${digit()}${digit()}${digit()}`;
}

/** Código de produto único (maiúsculas/dígitos/hífen). */
export function uniqueCode(prefix = 'E2E'): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

/** ISO local (sem fuso) para inputs `datetime-local` e API. */
export function localDateTime(offsetMinutes = 0): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
