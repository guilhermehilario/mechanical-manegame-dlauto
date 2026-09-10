import type { WorkOrderDto, Paginated } from '@mechanic-system/types';
import type {
  AddProductItemInput,
  AddServiceItemInput,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
} from '@mechanic-system/validation';
import type { WorkOrderStatus } from '@mechanic-system/shared';
import { api } from './auth.service';

export interface ListWorkOrdersParams {
  page?: number;
  limit?: number;
  customerId?: string;
  vehicleId?: string;
  status?: WorkOrderStatus;
}

function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export function listWorkOrders(
  params: ListWorkOrdersParams = {},
): Promise<Paginated<WorkOrderDto>> {
  return api.get<Paginated<WorkOrderDto>>(`/work-orders?${toQuery(params)}`);
}

export function getWorkOrder(id: string): Promise<WorkOrderDto> {
  return api.get<WorkOrderDto>(`/work-orders/${id}`);
}

export function createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrderDto> {
  return api.post<WorkOrderDto>('/work-orders', input);
}

export function updateWorkOrder(
  id: string,
  input: UpdateWorkOrderInput,
): Promise<WorkOrderDto> {
  return api.patch<WorkOrderDto>(`/work-orders/${id}`, input);
}

export function transitionWorkOrder(
  id: string,
  status: WorkOrderStatus,
): Promise<WorkOrderDto> {
  return api.patch<WorkOrderDto>(`/work-orders/${id}/status`, { status });
}

export function addServiceItem(
  workOrderId: string,
  input: AddServiceItemInput,
): Promise<WorkOrderDto> {
  return api.post<WorkOrderDto>(`/work-orders/${workOrderId}/service-items`, input);
}

export function addProductItem(
  workOrderId: string,
  input: AddProductItemInput,
): Promise<WorkOrderDto> {
  return api.post<WorkOrderDto>(`/work-orders/${workOrderId}/product-items`, input);
}

export function removeServiceItem(
  workOrderId: string,
  itemId: string,
): Promise<WorkOrderDto> {
  return api.delete<WorkOrderDto>(`/work-orders/${workOrderId}/service-items/${itemId}`);
}

export function removeProductItem(
  workOrderId: string,
  itemId: string,
): Promise<WorkOrderDto> {
  return api.delete<WorkOrderDto>(`/work-orders/${workOrderId}/product-items/${itemId}`);
}

export function deleteWorkOrder(id: string): Promise<unknown> {
  return api.delete<unknown>(`/work-orders/${id}`);
}
