import { request, type APIRequestContext, type APIResponse } from '@playwright/test';
import { E2E_API_ORIGIN } from './env';
import { E2E_ADMIN_EMAIL, readE2EAdminPassword } from './credentials';

/**
 * Thin API client for e2e SETUP (G1/B5). The e2e database seeds only the admin
 * user, so scenarios need prerequisite catalog/records. Creating those through
 * the API keeps the UI tests focused on the behaviour under test, while still
 * exercising the real stack.
 */

const API_PREFIX = '/api/v1';

export interface ApiCustomer {
  id: string;
  name: string;
}
export interface ApiVehicle {
  id: string;
  plate: string;
}
export interface ApiService {
  id: string;
  name: string;
}
export interface ApiProduct {
  id: string;
  name: string;
  stockQuantity: number;
}
export interface ApiWorkOrder {
  id: string;
  orderNumber: number;
  status: string;
}
export interface ApiAppointment {
  id: string;
}
export interface ApiPickup {
  id: string;
}

export interface NewCustomer {
  name: string;
  cpf: string;
  phone: string;
}
export interface NewVehicle {
  customerId: string;
  plate: string;
  brand: string;
  model: string;
}
export interface NewService {
  name: string;
  priceCents: number;
}
export interface NewProduct {
  code: string;
  name: string;
  costPriceCents: number;
  salePriceCents: number;
  stockQuantity: number;
}
export interface NewWorkOrder {
  customerId: string;
  vehicleId: string;
  notes?: string;
}

interface ErrorEnvelope {
  success: false;
  error?: { code?: string; message?: string };
}
type Envelope<T> = { success: true; data: T } | ErrorEnvelope;

async function unwrap<T>(response: APIResponse): Promise<T> {
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok() || body === null || !body.success) {
    const error = body && !body.success ? body.error : undefined;
    throw new Error(
      `E2E API ${response.status()} ${error?.code ?? 'UNKNOWN'}: ${error?.message ?? 'sem corpo'}`,
    );
  }
  return body.data;
}

export class E2eApi {
  private constructor(
    private readonly ctx: APIRequestContext,
    private readonly token: string,
  ) {}

  static async create(): Promise<E2eApi> {
    const ctx = await request.newContext({ baseURL: E2E_API_ORIGIN });
    const login = await unwrap<{ accessToken: string }>(
      await ctx.post(`${API_PREFIX}/auth/login`, {
        data: { email: E2E_ADMIN_EMAIL, password: readE2EAdminPassword() },
      }),
    );
    return new E2eApi(ctx, login.accessToken);
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' };
  }

  private async get<T>(path: string): Promise<T> {
    return unwrap<T>(await this.ctx.get(`${API_PREFIX}${path}`, { headers: this.headers() }));
  }

  private async post<T>(path: string, data: unknown): Promise<T> {
    return unwrap<T>(await this.ctx.post(`${API_PREFIX}${path}`, { headers: this.headers(), data }));
  }

  private async patch<T>(path: string, data: unknown): Promise<T> {
    return unwrap<T>(
      await this.ctx.patch(`${API_PREFIX}${path}`, { headers: this.headers(), data }),
    );
  }

  dispose(): Promise<void> {
    return this.ctx.dispose();
  }

  // ─── Catalog / records ────────────────────────────────────────────────────

  createCustomer(input: NewCustomer): Promise<ApiCustomer> {
    return this.post<ApiCustomer>('/customers', input);
  }

  createVehicle(input: NewVehicle): Promise<ApiVehicle> {
    return this.post<ApiVehicle>('/vehicles', input);
  }

  createService(input: NewService): Promise<ApiService> {
    return this.post<ApiService>('/services', { ...input, estimatedMinutes: 30 });
  }

  createProduct(input: NewProduct): Promise<ApiProduct> {
    return this.post<ApiProduct>('/products', input);
  }

  createWorkOrder(input: NewWorkOrder): Promise<ApiWorkOrder> {
    return this.post<ApiWorkOrder>('/work-orders', input);
  }

  /** Used after creating an OS through the UI to learn its id/number. */
  async findWorkOrderByCustomer(customerId: string): Promise<ApiWorkOrder> {
    const result = await this.get<{ items: ApiWorkOrder[] }>(
      `/work-orders?customerId=${encodeURIComponent(customerId)}&limit=1`,
    );
    const first = result.items[0];
    if (!first) {
      throw new Error('Nenhuma OS encontrada para o cliente recém-criado.');
    }
    return first;
  }

  addServiceItem(workOrderId: string, serviceId: string, quantity = 1): Promise<ApiWorkOrder> {
    return this.post<ApiWorkOrder>(`/work-orders/${workOrderId}/service-items`, {
      serviceId,
      quantity,
    });
  }

  addProductItem(workOrderId: string, productId: string, quantity = 1): Promise<ApiWorkOrder> {
    return this.post<ApiWorkOrder>(`/work-orders/${workOrderId}/product-items`, {
      productId,
      quantity,
      discountCents: 0,
    });
  }

  transitionWorkOrder(workOrderId: string, status: string): Promise<ApiWorkOrder> {
    return this.patch<ApiWorkOrder>(`/work-orders/${workOrderId}/status`, { status });
  }

  createAppointment(input: {
    customerId: string;
    vehicleId: string;
    serviceId: string;
    scheduledAt: string;
  }): Promise<ApiAppointment> {
    return this.post<ApiAppointment>('/appointments', input);
  }

  registerPickup(
    workOrderId: string,
    input: { receiverName: string; receiverDoc: string },
  ): Promise<ApiPickup> {
    return this.post<ApiPickup>(`/vehicle-pickups/work-order/${workOrderId}`, input);
  }
}
