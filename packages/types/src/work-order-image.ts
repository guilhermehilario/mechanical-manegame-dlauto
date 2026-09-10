/**
 * Image + history DTOs (Fase 6). Image bytes never travel in the DB —
 * metadata here, bytes served by the StorageService. Maintenance history
 * is DERIVED from work-order snapshots (§14/§35) — no source of truth of
 * its own, so it can never disagree with the orders.
 */

export interface WorkOrderImageDto {
  id: string;
  workOrderId: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  caption: string | null;
  /** Download URL relative to the API base (serves raw bytes, not the envelope). */
  url: string;
  createdAt: string;
}

/** One maintenance-history line for a vehicle (derived query, spec §14). */
export interface VehicleHistoryEntryDto {
  workOrderId: string;
  orderNumber: number;
  status: string;
  openedAt: string;
  completedAt: string | null;
  services: Array<{ name: string; quantity: number; unitPriceCents: number }>;
  products: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
    discountCents: number;
  }>;
  totalCents: number;
}
