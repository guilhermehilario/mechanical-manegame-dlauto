/**
 * Display preferences — date/time presentation format shared by the web UI.
 * Mirrors DateFormat/TimeFormat from @mechanic-system/validation.
 */
export type TimeFormat = 'H24' | 'H12';
export type DateFormat = 'DD_MM_YYYY' | 'YYYY_MM_DD' | 'MM_DD_YYYY';

/**
 * Shop settings (Bloco F2 mínimo — docs/todo-mvp.md): identity of the shop,
 * used by the printed documents (work order + pickup receipt). Singleton —
 * the API stores exactly one row.
 */
export interface ShopSettingsDto {
  name: string;
  phone: string | null;
  address: string | null;
  documentFooter: string | null;
  /** Date format used across the UI ('DD_MM_YYYY' default). */
  dateFormat: DateFormat;
  /** Time format used across the UI ('H24' default; 'H12' = AM/PM). */
  timeFormat: TimeFormat;
  updatedAt: string;
}
