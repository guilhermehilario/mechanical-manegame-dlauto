/**
 * Presentation-only date helpers for the agenda views (spec §23).
 * Appointments are stored as UTC instants; the agenda works in the
 * workshop's local timezone (the same one used by `datetime-local` inputs).
 */

/** Start of the day (00:00 local) containing `date`. */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Start of the week (Monday 00:00 local) containing `date` —
 * Brazilian calendars start on Monday.
 */
export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay(); // 0 = Sunday … 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

/** The 7 days of the week containing `date`, Monday → Sunday. */
export function weekDays(date: Date): Date[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** `HH:mm` in local time. */
export function formatTime(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Short weekday + day/month label, e.g. "seg, 05/10". */
export function formatDayLabel(date: Date): string {
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date);
  const dayMonth = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
  return `${weekday.replace('.', '')}, ${dayMonth}`;
}

/** Long label for the day header, e.g. "segunda-feira, 5 de outubro de 2026". */
export function formatDayLong(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(date);
}

/** True when both dates are the same calendar day (local). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** True when `date` is today (local). */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
