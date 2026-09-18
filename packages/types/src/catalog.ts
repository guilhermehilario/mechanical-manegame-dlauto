/**
 * Catalog/stock DTOs (Fase 3). These are the shapes the API returns —
 * never the raw Prisma entities (spec §22/§23). Money is integer cents (§18).
 */

export interface ServiceDto {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  estimatedMinutes: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDto {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  costPriceCents: number;
  salePriceCents: number;
  stockQuantity: number;
  minStock: number;
  location: string | null;
  supplierId: string | null;
  supplierName?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementDto {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  previousStock: number;
  newStock: number;
  userId: string | null;
  createdAt: string;
}

/**
 * Result of the optional example-catalog seed (Bloco F/F3). Counts of rows
 * actually created; existing items are skipped (idempotent).
 */
export interface SeedCatalogResultDto {
  services: number;
  products: number;
  suppliers: number;
}
