import type { Paginated, VehiclePickupDto, VehiclePickupReceiptDto } from '@mechanic-system/types';
import type { CreateVehiclePickupInput } from '@mechanic-system/validation';
import { api } from './auth.service';

export interface ListPickupsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'receiverName' | 'createdAt';
  sortDir?: 'asc' | 'desc';
}

export function listVehiclePickups(
  params: ListPickupsParams = {},
): Promise<Paginated<VehiclePickupDto>> {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.search) search.set('search', params.search);
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortDir) search.set('sortDir', params.sortDir);
  const qs = search.toString();
  return api.get<Paginated<VehiclePickupDto>>(`/vehicle-pickups${qs ? `?${qs}` : ''}`);
}

export function getVehiclePickupByWorkOrder(
  workOrderId: string,
): Promise<VehiclePickupDto> {
  return api.get<VehiclePickupDto>(`/vehicle-pickups/work-order/${workOrderId}`);
}

/** Full receipt for printing (Bloco B2) — includes the signature data URL. */
export function getVehiclePickupReceipt(workOrderId: string): Promise<VehiclePickupReceiptDto> {
  return api.get<VehiclePickupReceiptDto>(`/vehicle-pickups/work-order/${workOrderId}/receipt`);
}

export function registerVehiclePickup(
  workOrderId: string,
  input: CreateVehiclePickupInput,
): Promise<VehiclePickupDto> {
  return api.post<VehiclePickupDto>(`/vehicle-pickups/work-order/${workOrderId}`, input);
}
