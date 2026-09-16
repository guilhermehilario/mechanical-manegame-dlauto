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
  updatedAt: string;
}
