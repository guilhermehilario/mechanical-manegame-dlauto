/**
 * Local-timezone date buckets shared by the dashboard and report services
 * (Fase 8). The workshop lives in one timezone; "day"/"month" boundaries
 * follow the machine's local clock, matching the web UI.
 */

/** Start of the day containing `date` (00:00:00.000 local). */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** End of the day containing `date` (23:59:59.999 local, inclusive). */
export function endOfDay(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  result.setMilliseconds(result.getMilliseconds() - 1);
  return result;
}

/** First day of the month containing `date` (00:00 local). */
export function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Last millisecond of the month containing `date` (inclusive). */
export function endOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}

/** Month containing `date`, shifted by `offset` (e.g. -1 = last month). */
export function offsetMonth(date: Date, offset: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  return result;
}

/** Day containing `date`, shifted by `offset` days (e.g. -6 = 6 days before). */
export function offsetDays(date: Date, offset: number): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + offset);
  return result;
}

/** Parses a validated "YYYY-MM-DD" into a local-timezone midnight Date. */
export function parseReportDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? NaN, (month ?? 1) - 1, day ?? 1);
}

/** Formats a Date as local "YYYY-MM-DD" (report grouping key). */
export function toYyyyMmDd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}