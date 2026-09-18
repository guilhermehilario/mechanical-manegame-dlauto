import type { Paginated, VehicleDto } from '@mechanic-system/types';
import type { CreateVehicleInput, UpdateVehicleInput } from '@mechanic-system/validation';
import { api } from './auth.service';

export interface ListVehiclesParams {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  includeInactive?: boolean;
  sortBy?: 'plate' | 'brand' | 'model' | 'year' | 'createdAt' | 'updatedAt';
  sortDir?: 'asc' | 'desc';
}

function toQuery(params: ListVehiclesParams): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 20));
  if (params.search) search.set('search', params.search);
  if (params.customerId) search.set('customerId', params.customerId);
  if (params.includeInactive) search.set('includeInactive', 'true');
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortDir) search.set('sortDir', params.sortDir);
  return search.toString();
}

export function listVehicles(params: ListVehiclesParams = {}): Promise<Paginated<VehicleDto>> {
  return api.get<Paginated<VehicleDto>>(`/vehicles?${toQuery(params)}`);
}

export function getVehicle(id: string): Promise<VehicleDto> {
  return api.get<VehicleDto>(`/vehicles/${id}`);
}

export function listVehiclesByCustomer(customerId: string): Promise<VehicleDto[]> {
  return api.get<VehicleDto[]>(`/vehicles/customer/${customerId}`);
}

export function createVehicle(input: CreateVehicleInput): Promise<VehicleDto> {
  return api.post<VehicleDto>('/vehicles', input);
}

export function updateVehicle(id: string, input: UpdateVehicleInput): Promise<VehicleDto> {
  return api.patch<VehicleDto>(`/vehicles/${id}`, input);
}

export function deleteVehicle(id: string): Promise<unknown> {
  return api.delete<unknown>(`/vehicles/${id}`);
}
