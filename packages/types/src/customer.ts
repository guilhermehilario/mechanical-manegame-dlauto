/**
 * Customer/vehicle DTOs (Fase 2). These are the shapes the API returns —
 * never the raw Prisma entities (spec §22/§23).
 */

export interface CustomerDto {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleDto {
  id: string;
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  mileage: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
