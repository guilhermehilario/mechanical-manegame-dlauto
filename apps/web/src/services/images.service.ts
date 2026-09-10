import type { VehicleHistoryEntryDto, WorkOrderImageDto } from '@mechanic-system/types';
import { api } from './auth.service';
import { resolveApiBaseUrl } from './api-url';
import { authStore } from './auth-store';

/**
 * Image + history endpoints (Fase 6). Downloads stream raw bytes (no JSON
 * envelope), so they go through dedicated blob/object-URL helpers instead of
 * the JSON client.
 */

export function listWorkOrderImages(workOrderId: string): Promise<WorkOrderImageDto[]> {
  return api.get<WorkOrderImageDto[]>(`/work-orders/${workOrderId}/images`);
}

export function uploadWorkOrderImage(
  workOrderId: string,
  file: File,
  caption?: string,
): Promise<WorkOrderImageDto> {
  const form = new FormData();
  form.append('file', file);
  if (caption && caption.trim().length > 0) {
    form.append('caption', caption.trim());
  }
  return api.postForm<WorkOrderImageDto>(`/work-orders/${workOrderId}/images`, form);
}

export function deleteWorkOrderImage(workOrderId: string, imageId: string): Promise<unknown> {
  return api.delete<unknown>(`/work-orders/${workOrderId}/images/${imageId}`);
}

export function getVehicleHistory(vehicleId: string): Promise<VehicleHistoryEntryDto[]> {
  return api.get<VehicleHistoryEntryDto[]>(`/work-orders/vehicle/${vehicleId}/history`);
}

/**
 * Authenticated image download: fetches the bytes with the bearer token and
 * returns an object URL usable in <img src>. Caller must revoke the URL.
 */
export async function fetchImageObjectUrl(workOrderId: string, imageId: string): Promise<string> {
  const blob = await api.getBlob(`/work-orders/${workOrderId}/images/${imageId}/content`);
  return URL.createObjectURL(blob);
}

/** Direct URL builder for cases where auth is not required (unused today). */
export function imageUrl(workOrderId: string, imageId: string): string {
  const token = authStore.getAccessToken();
  return `${resolveApiBaseUrl()}/work-orders/${workOrderId}/images/${imageId}/content${
    token ? `?token=${encodeURIComponent(token)}` : ''
  }`;
}
