import type { Paginated, VehiclePickupDto } from '@mechanic-system/types';
import type { CreateVehiclePickupInput } from '@mechanic-system/validation';
import { api } from './auth.service';

export interface ListPickupsParams {
  page?: number;
  limit?: number;
}

export function listVehiclePickups(
  params: ListPickupsParams = {},
): Promise<Paginated<VehiclePickupDto>> {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return api.get<Paginated<VehiclePickupDto>>(`/vehicle-pickups${qs ? `?${qs}` : ''}`);
}

export function getVehiclePickupByWorkOrder(
  workOrderId: string,
): Promise<VehiclePickupDto> {
  return api.get<VehiclePickupDto>(`/vehicle-pickups/work-order/${workOrderId}`);
}

export function registerVehiclePickup(
  workOrderId: string,
  input: CreateVehiclePickupInput,
): Promise<VehiclePickupDto> {
  return api.post<VehiclePickupDto>(`/vehicle-pickups/work-order/${workOrderId}`, input);
}
