/**
 * Appointment DTOs (Fase 4). These are the shapes the API returns —
 * never the raw Prisma entities (spec §22/§23).
 */

export interface AppointmentDto {
  id: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehiclePlate: string;
  serviceId: string;
  serviceName: string;
  /** ISO datetime (UTC). */
  scheduledAt: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
