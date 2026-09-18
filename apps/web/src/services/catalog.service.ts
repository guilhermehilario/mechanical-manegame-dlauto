import type {
  Paginated,
  ProductDto,
  SeedCatalogResultDto,
  ServiceDto,
  StockMovementDto,
  SupplierDto,
} from '@mechanic-system/types';
import type {
  CreateProductInput,
  CreateServiceInput,
  CreateStockMovementInput,
  CreateSupplierInput,
  UpdateProductInput,
  UpdateServiceInput,
  UpdateSupplierInput,
} from '@mechanic-system/validation';
import { api } from './auth.service';

// ─── Services (catalog) ───────────────────────────────────────

export interface ListServicesParams {
  page?: number;
  limit?: number;
  search?: string;
  includeInactive?: boolean;
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

export function listServices(
  params: ListServicesParams = {},
): Promise<Paginated<ServiceDto>> {
  return api.get<Paginated<ServiceDto>>(`/services?${toQuery(params)}`);
}

export function createService(input: CreateServiceInput): Promise<ServiceDto> {
  return api.post<ServiceDto>('/services', input);
}

export function updateService(id: string, input: UpdateServiceInput): Promise<ServiceDto> {
  return api.patch<ServiceDto>(`/services/${id}`, input);
}

export function deleteService(id: string): Promise<unknown> {
  return api.delete<unknown>(`/services/${id}`);
}

/**
 * Optional example catalog (Bloco F/F3). Explicit opt-in — nothing is
 * seeded automatically. Requires ADMIN/MANAGER (the API enforces it).
 */
export function seedCatalogExample(): Promise<SeedCatalogResultDto> {
  return api.post<SeedCatalogResultDto>('/catalog/seed-examples');
}

// ─── Suppliers ────────────────────────────────────────────────

export interface ListSuppliersParams {
  page?: number;
  limit?: number;
  search?: string;
  includeInactive?: boolean;
}

export function listSuppliers(
  params: ListSuppliersParams = {},
): Promise<Paginated<SupplierDto>> {
  return api.get<Paginated<SupplierDto>>(`/suppliers?${toQuery(params)}`);
}

export function createSupplier(input: CreateSupplierInput): Promise<SupplierDto> {
  return api.post<SupplierDto>('/suppliers', input);
}

export function updateSupplier(id: string, input: UpdateSupplierInput): Promise<SupplierDto> {
  return api.patch<SupplierDto>(`/suppliers/${id}`, input);
}

export function deleteSupplier(id: string): Promise<unknown> {
  return api.delete<unknown>(`/suppliers/${id}`);
}

// ─── Products + stock ─────────────────────────────────────────

export interface ListProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  supplierId?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
}

export function listProducts(
  params: ListProductsParams = {},
): Promise<Paginated<ProductDto>> {
  return api.get<Paginated<ProductDto>>(`/products?${toQuery(params)}`);
}

export function listStockMovements(
  params: { page?: number; limit?: number; productId?: string } = {},
): Promise<Paginated<StockMovementDto>> {
  return api.get<Paginated<StockMovementDto>>(`/products/movements?${toQuery(params)}`);
}

export function createProduct(input: CreateProductInput): Promise<ProductDto> {
  return api.post<ProductDto>('/products', input);
}

export function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
  return api.patch<ProductDto>(`/products/${id}`, input);
}

export function registerStockMovement(
  input: CreateStockMovementInput,
): Promise<StockMovementDto> {
  return api.post<StockMovementDto>('/products/movements', input);
}

export function deleteProduct(id: string): Promise<unknown> {
  return api.delete<unknown>(`/products/${id}`);
}
