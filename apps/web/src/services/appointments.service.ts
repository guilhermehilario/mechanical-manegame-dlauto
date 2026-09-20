import type { AppointmentDto, Paginated } from '@mechanic-system/types';
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '@mechanic-system/validation';
import type { AppointmentStatus } from '@mechanic-system/shared';
import { api } from './auth.service';

export interface ListAppointmentsParams {
  page?: number;
  limit?: number;
  customerId?: string;
  vehicleId?: string;
  status?: AppointmentStatus;
  from?: string;
  to?: string;
  search?: string;
  sortBy?: 'scheduledAt' | 'status' | 'createdAt';
  sortDir?: 'asc' | 'desc';
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

export function listAppointments(
  params: ListAppointmentsParams = {},
): Promise<Paginated<AppointmentDto>> {
  return api.get<Paginated<AppointmentDto>>(`/appointments?${toQuery(params)}`);
}

export function createAppointment(
  input: CreateAppointmentInput,
): Promise<AppointmentDto> {
  return api.post<AppointmentDto>('/appointments', input);
}

export function updateAppointment(
  id: string,
  input: UpdateAppointmentInput,
): Promise<AppointmentDto> {
  return api.patch<AppointmentDto>(`/appointments/${id}`, input);
}

export function transitionAppointment(
  id: string,
  status: AppointmentStatus,
): Promise<AppointmentDto> {
  return api.patch<AppointmentDto>(`/appointments/${id}/status`, { status });
}

export function deleteAppointment(id: string): Promise<unknown> {
  return api.delete<unknown>(`/appointments/${id}`);
}
