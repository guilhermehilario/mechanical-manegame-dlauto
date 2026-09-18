import type { CustomerDto, Paginated } from '@mechanic-system/types';
import type { CreateCustomerInput, UpdateCustomerInput } from '@mechanic-system/validation';
import { api } from './auth.service';

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  includeInactive?: boolean;
  sortBy?: 'name' | 'cpf' | 'phone' | 'email' | 'createdAt' | 'updatedAt';
  sortDir?: 'asc' | 'desc';
}

function toQuery(params: ListCustomersParams): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 20));
  if (params.search) search.set('search', params.search);
  if (params.includeInactive) search.set('includeInactive', 'true');
  if (params.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortDir) search.set('sortDir', params.sortDir);
  return search.toString();
}

export function listCustomers(params: ListCustomersParams = {}): Promise<Paginated<CustomerDto>> {
  return api.get<Paginated<CustomerDto>>(`/customers?${toQuery(params)}`);
}

export function getCustomer(id: string): Promise<CustomerDto> {
  return api.get<CustomerDto>(`/customers/${id}`);
}

export function createCustomer(input: CreateCustomerInput): Promise<CustomerDto> {
  return api.post<CustomerDto>('/customers', input);
}

export function updateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerDto> {
  return api.patch<CustomerDto>(`/customers/${id}`, input);
}

export function deleteCustomer(id: string): Promise<unknown> {
  return api.delete<unknown>(`/customers/${id}`);
}
