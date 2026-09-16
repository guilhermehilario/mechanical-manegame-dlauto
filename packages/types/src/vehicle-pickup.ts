/**
 * Vehicle pickup DTOs (Fase 7). One pickup per work order (1─1); the row is
 * the legal handover receipt, so it is immutable once created.
 */

export interface VehiclePickupDto {
  id: string;
  workOrderId: string;
  orderNumber: number;
  customerName: string;
  vehiclePlate: string;
  receiverName: string;
  receiverDoc: string;
  receiverPhone: string | null;
  mileageKm: number | null;
  hasSignature: boolean;
  notes: string | null;
  registeredByName: string | null;
  createdAt: string;
}

/**
 * Full receipt for printing (Bloco B) — includes the signature PNG (data URL)
 * and vehicle brand/model, which the list DTO omits on purpose (smaller
 * payloads on every table render).
 */
export interface VehiclePickupReceiptDto extends VehiclePickupDto {
  signatureData: string | null;
  vehicleModel: string;
  workOrderTotalCents: number;
}
