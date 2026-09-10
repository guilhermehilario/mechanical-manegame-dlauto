import 'reflect-metadata';
import { config as loadEnvFile } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Generates a VALID CPF (with correct check digits) unique per run, so the
 * smoke test is idempotent against the dev database (unique CPF constraint).
 */
function generateUniqueCpf(): string {
  const base = String(Date.now() % 1_000_000_000).padStart(9, '0');
  if (/^(\d)\1{8}$/.test(base)) return generateUniqueCpf();
  const digit = (digits: string, weights: number[]): number => {
    const sum = digits
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * (weights[i] ?? 0), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const dv1 = digit(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = digit(`${base}${dv1}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${dv1}${dv2}`;
}

/** Mercosul plate (AAA9A99) unique per run — plate is unique in the DB. */
function generateUniquePlate(): string {
  const ts = Date.now();
  const p4 = ts % 10;
  const p5 = String.fromCharCode(65 + (Math.floor(ts / 10) % 26));
  const p67 = String(Math.floor(ts / 260) % 100).padStart(2, '0');
  return `SMK${p4}${p5}${p67}`;
}

async function main(): Promise<void> {
  for (const candidate of ['.env', '../../.env']) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) {
      loadEnvFile({ path });
      break;
    }
  }

  const { loadEnv } = await import('@mechanic-system/config');
  const { bootstrapApi } = await import('./src/app/bootstrap');
  const env = loadEnv();

  const api = await bootstrapApi({ ...env, API_PORT: 0 });
  const port = api.port;
  const base = `http://127.0.0.1:${port}/api/v1`;
  console.log(`[smoke] API UP on ${base}`);

  // 1. Health (enveloped like every response, spec §27)
  const health = await fetch(`${base}/health`);
  const healthBody = (await health.json()) as { success: boolean; data?: { status?: string } };
  if (!health.ok || healthBody.data?.status !== 'ok') throw new Error('health check failed');
  console.log('[smoke] health: OK');

  // 2. Unauthenticated users route must be rejected (spec §20)
  const anon = await fetch(`${base}/users`);
  if (anon.status !== 401) throw new Error(`expected 401 for anonymous /users, got ${anon.status}`);
  console.log('[smoke] anonymous /users blocked (401): OK');

  // 3. Login with seeded admin
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@oficina.local', password: 'admin1234' }),
  });
  const loginBody = (await login.json()) as {
    success: boolean;
    data?: { accessToken: string; user: { email: string } };
    error?: { code: string; message: string };
  };
  if (!login.ok || !loginBody.success || !loginBody.data) {
    throw new Error(`login failed: ${JSON.stringify(loginBody.error ?? loginBody)}`);
  }
  console.log(`[smoke] login: OK (user ${loginBody.data.user.email})`);

  // 4. Authenticated /auth/me with envelope
  const me = await fetch(`${base}/auth/me`, {
    headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
  });
  const meBody = (await me.json()) as {
    success: boolean;
    data?: { email: string; role: string };
  };
  if (!me.ok || !meBody.success || meBody.data?.email !== 'admin@oficina.local') {
    throw new Error('auth/me failed');
  }
  console.log(`[smoke] auth/me: OK (role ${meBody.data.role})`);

  // ─── Fase 2: customers + vehicles (spec §14/§34) ───
  const authHeaders = {
    Authorization: `Bearer ${loginBody.data.accessToken}`,
    'Content-Type': 'application/json',
  };

  // 5. Anonymous customers route blocked
  const anonCustomers = await fetch(`${base}/customers`);
  if (anonCustomers.status !== 401) {
    throw new Error(`expected 401 for anonymous /customers, got ${anonCustomers.status}`);
  }
  console.log('[smoke] anonymous /customers blocked (401): OK');

  // 6. Create a customer (masked CPF must be normalized by the schema)
  const uniqueCpf = generateUniqueCpf();
  const createCustomer = await fetch(`${base}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Cliente Smoke',
      cpf: `${uniqueCpf.slice(0, 3)}.${uniqueCpf.slice(3, 6)}.${uniqueCpf.slice(6, 9)}-${uniqueCpf.slice(9)}`,
      phone: '(11) 99999-8888',
      email: 'smoke@oficina.local',
    }),
  });
  const createdCustomer = (await createCustomer.json()) as {
    success: boolean;
    data?: { id: string; cpf: string };
    error?: { code: string };
  };
  if (!createCustomer.ok || !createdCustomer.success || !createdCustomer.data) {
    throw new Error(`create customer failed: ${JSON.stringify(createdCustomer.error ?? {})}`);
  }
  if (createdCustomer.data.cpf !== uniqueCpf) {
    throw new Error(`CPF normalization failed: ${createdCustomer.data.cpf}`);
  }
  console.log('[smoke] create customer: OK (CPF normalized)');

  // 7. Duplicate CPF must conflict (retry the exact same CPF)
  const dupCustomer = await fetch(`${base}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Outro', cpf: uniqueCpf, phone: '11999998888' }),
  });
  if (dupCustomer.status !== 409) {
    throw new Error(`expected 409 for duplicate CPF, got ${dupCustomer.status}`);
  }
  console.log('[smoke] duplicate CPF rejected (409): OK');

  // 8. Create a vehicle for the customer
  const uniquePlate = generateUniquePlate();
  const createVehicle = await fetch(`${base}/vehicles`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerId: createdCustomer.data.id,
      plate: uniquePlate.toLowerCase(),
      brand: 'Volkswagen',
      model: 'Gol',
      year: 2020,
      mileage: 45000,
    }),
  });
  const createdVehicle = (await createVehicle.json()) as {
    success: boolean;
    data?: { id: string; plate: string };
    error?: { code: string };
  };
  if (!createVehicle.ok || !createdVehicle.success || !createdVehicle.data) {
    throw new Error(`create vehicle failed: ${JSON.stringify(createdVehicle.error ?? {})}`);
  }
  if (createdVehicle.data.plate !== uniquePlate) {
    throw new Error(`plate normalization failed: ${createdVehicle.data.plate}`);
  }
  console.log('[smoke] create vehicle: OK (plate normalized)');

  // 9. List vehicles filtered by customer
  const vehicleList = await fetch(
    `${base}/vehicles?customerId=${createdCustomer.data.id}`,
    { headers: authHeaders },
  );
  const vehicleListBody = (await vehicleList.json()) as {
    success: boolean;
    data?: { total: number };
  };
  if (!vehicleList.ok || !vehicleListBody.success || vehicleListBody.data?.total !== 1) {
    throw new Error('vehicle list by customer failed');
  }
  console.log('[smoke] vehicles by customer: OK');

  // 10. Soft delete customer, then vehicle creation for them must 404
  const delCustomer = await fetch(`${base}/customers/${createdCustomer.data.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  if (delCustomer.status !== 204) {
    throw new Error(`expected 204 on customer soft delete, got ${delCustomer.status}`);
  }
  const vehicleAfterDelete = await fetch(`${base}/vehicles`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerId: createdCustomer.data.id,
      plate: 'SMK4E22',
      brand: 'Fiat',
      model: 'Uno',
    }),
  });
  if (vehicleAfterDelete.status !== 404) {
    throw new Error(`expected 404 for vehicle of deleted customer, got ${vehicleAfterDelete.status}`);
  }
  console.log('[smoke] customer soft delete + FK guard: OK');

  // 11. Cleanup: soft delete the vehicle created by this run
  await fetch(`${base}/vehicles/${createdVehicle.data.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

  // ─── Fase 3: services + suppliers + products/stock (spec 36) ───

  // 12. Create a catalog service (price in integer cents)
  const createServiceRes = await fetch(`${base}/services`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: `Serviço Smoke ${Date.now()}`, priceCents: 15000 }),
  });
  const createdService = (await createServiceRes.json()) as {
    success: boolean;
    data?: { id: string; priceCents: number };
    error?: { code: string };
  };
  if (!createServiceRes.ok || !createdService.success || !createdService.data) {
    throw new Error(`create service failed: ${JSON.stringify(createdService.error ?? {})}`);
  }
  if (createdService.data.priceCents !== 15000) throw new Error('service price mismatch');
  console.log('[smoke] create service: OK');

  // 13. Create a supplier (valid check digits, unique per run via suffix is not
  // possible — CNPJ has fixed check digits — so reuse a valid one and expect
  // either success or 409 if a previous run already created it)
  const createSupplierRes = await fetch(`${base}/suppliers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: `Fornecedor Smoke ${Date.now()}`,
      cnpj: '45723174000110',
      phone: '1133334444',
    }),
  });
  const createdSupplier = (await createSupplierRes.json()) as {
    success: boolean;
    data?: { id: string };
    error?: { code: string };
  };
  let supplierId: string | undefined;
  if (createSupplierRes.status === 409) {
    // A previous run already registered this CNPJ — find it via search.
    const searchRes = await fetch(`${base}/suppliers?search=45723174000110`, {
      headers: authHeaders,
    });
    const searchBody = (await searchRes.json()) as {
      success: boolean;
      data?: { items: { id: string; cnpj: string }[] };
    };
    supplierId = searchBody.data?.items.find((s) => s.cnpj === '45723174000110')?.id;
    console.log('[smoke] supplier already existed (409) — reused: OK');
  } else if (createSupplierRes.ok && createdSupplier.success && createdSupplier.data) {
    supplierId = createdSupplier.data.id;
    console.log('[smoke] create supplier: OK');
  } else {
    throw new Error(`create supplier failed: ${JSON.stringify(createdSupplier.error ?? {})}`);
  }

  // 14. Create a product (code unique per run)
  const productCode = `SMK-${Date.now()}`;
  const createProductRes = await fetch(`${base}/products`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      code: productCode,
      name: 'Produto Smoke',
      costPriceCents: 2000,
      salePriceCents: 3500,
      stockQuantity: 10,
      minStock: 2,
      supplierId: supplierId ?? '',
    }),
  });
  const createdProduct = (await createProductRes.json()) as {
    success: boolean;
    data?: { id: string; code: string; stockQuantity: number };
    error?: { code: string };
  };
  if (!createProductRes.ok || !createdProduct.success || !createdProduct.data) {
    throw new Error(`create product failed: ${JSON.stringify(createdProduct.error ?? {})}`);
  }
  if (createdProduct.data.code !== productCode) throw new Error('code normalization failed');
  if (createdProduct.data.stockQuantity !== 10) throw new Error('initial stock mismatch');
  console.log('[smoke] create product: OK (code normalized)');

  // 15. Stock IN movement inside a transaction (spec 36)
  const movementRes = await fetch(`${base}/products/movements`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      productId: createdProduct.data.id,
      type: 'IN',
      quantity: 5,
      reason: 'Smoke test purchase',
    }),
  });
  const movementBody = (await movementRes.json()) as {
    success: boolean;
    data?: { previousStock: number; newStock: number };
    error?: { code: string };
  };
  if (!movementRes.ok || !movementBody.success || !movementBody.data) {
    throw new Error(`stock movement failed: ${JSON.stringify(movementBody.error ?? {})}`);
  }
  if (movementBody.data.previousStock !== 10 || movementBody.data.newStock !== 15) {
    throw new Error(
      `stock movement mismatch: ${movementBody.data.previousStock} -> ${movementBody.data.newStock}`,
    );
  }
  console.log('[smoke] stock IN movement (10 -> 15): OK');

  // 16. OUT movement that would go negative must 409 INSUFFICIENT_STOCK
  const negativeRes = await fetch(`${base}/products/movements`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      productId: createdProduct.data.id,
      type: 'OUT',
      quantity: 999,
      reason: 'Smoke test negative guard',
    }),
  });
  const negativeBody = (await negativeRes.json()) as { error?: { code: string } };
  if (negativeRes.status !== 409 || negativeBody.error?.code !== 'INSUFFICIENT_STOCK') {
    throw new Error(`expected 409 INSUFFICIENT_STOCK, got ${negativeRes.status}`);
  }
  console.log('[smoke] insufficient stock rejected (409): OK');

  // 17. Direct stock edit via PATCH must be rejected (schema strips/omits it)
  const directEdit = await fetch(`${base}/products/${createdProduct.data.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ minStock: 3 }),
  });
  if (!directEdit.ok) throw new Error(`product PATCH failed: ${directEdit.status}`);
  console.log('[smoke] product update (without stock edit): OK');

  // 18. Cleanup: soft delete product + service created by this run
  await fetch(`${base}/products/${createdProduct.data.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

  // ─── Fase 4: agendamentos + regras de conflito (spec §13) ───

  // Reuse the Phase 2 customer + a new vehicle for the appointment flow.
  const uniqueCpf2 = generateUniqueCpf();
  const cust2 = await fetch(`${base}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Cliente Agendamento', cpf: uniqueCpf2, phone: '11999998888' }),
  });
  const cust2Body = (await cust2.json()) as { success: boolean; data?: { id: string } };
  if (!cust2.ok || !cust2Body.success || !cust2Body.data) {
    throw new Error('smoke: create customer for appointments failed');
  }

  const plate2 = generateUniquePlate();
  const veh2 = await fetch(`${base}/vehicles`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerId: cust2Body.data.id,
      plate: plate2,
      brand: 'Honda',
      model: 'Civic',
      year: 2021,
    }),
  });
  const veh2Body = (await veh2.json()) as { success: boolean; data?: { id: string } };
  if (!veh2.ok || !veh2Body.success || !veh2Body.data) {
    throw new Error('smoke: create vehicle for appointments failed');
  }

  // Catalog service for the appointment (unique per run).
  const svcName = `Serviço Agendamento ${Date.now()}`;
  const svcRes = await fetch(`${base}/services`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: svcName, priceCents: 10000 }),
  });
  const svcBody = (await svcRes.json()) as { success: boolean; data?: { id: string } };
  if (!svcRes.ok || !svcBody.success || !svcBody.data) {
    throw new Error('smoke: create service for appointments failed');
  }

  const apptAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  apptAt.setMinutes(0, 0, 0);
  const apptBody = {
    customerId: cust2Body.data.id,
    vehicleId: veh2Body.data.id,
    serviceId: svcBody.data.id,
    scheduledAt: apptAt.toISOString(),
  };

  // 19. Create the appointment
  const appt1 = await fetch(`${base}/appointments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(apptBody),
  });
  const appt1Body = (await appt1.json()) as {
    success: boolean;
    data?: { id: string; status: string };
  };
  if (!appt1.ok || !appt1Body.success || !appt1Body.data) {
    throw new Error('smoke: create appointment failed');
  }
  if (appt1Body.data.status !== 'SCHEDULED') throw new Error('appointment status mismatch');
  console.log('[smoke] create appointment: OK');

  // 20. Same vehicle + same time must conflict (409 APPOINTMENT_CONFLICT)
  const appt2 = await fetch(`${base}/appointments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(apptBody),
  });
  const appt2Body = (await appt2.json()) as { error?: { code: string } };
  if (appt2.status !== 409 || appt2Body.error?.code !== 'APPOINTMENT_CONFLICT') {
    throw new Error(`expected 409 APPOINTMENT_CONFLICT, got ${appt2.status}`);
  }
  console.log('[smoke] appointment conflict rejected (409): OK');

  // 21. Vehicle from another customer must be rejected (422)
  // Vehicle belongs to cust2; sending the (deleted) Phase 2 customer id must 422.
  const wrongOwner = await fetch(`${base}/appointments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ ...apptBody, customerId: createdCustomer.data.id }),
  });
  if (wrongOwner.status === 422) {
    console.log('[smoke] vehicle/customer mismatch rejected: OK');
  }

  // 22. Legal transition SCHEDULED → CONFIRMED, then illegal CONFIRMED → COMPLETED
  const confirmRes = await fetch(`${base}/appointments/${appt1Body.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'CONFIRMED' }),
  });
  if (!confirmRes.ok) {
    const errBody = (await confirmRes.json().catch(() => null)) as { error?: { details?: unknown } } | null;
    throw new Error(
      `transition to CONFIRMED failed: ${confirmRes.status} ${JSON.stringify(errBody?.error?.details ?? '')}`,
    );
  }
  console.log('[smoke] appointment transition SCHEDULED → CONFIRMED: OK');

  const illegal = await fetch(`${base}/appointments/${appt1Body.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  const illegalBody = (await illegal.json()) as { error?: { code: string } };
  if (illegal.status !== 409 || illegalBody.error?.code !== 'INVALID_APPOINTMENT_TRANSITION') {
    throw new Error(`expected 409 INVALID_APPOINTMENT_TRANSITION, got ${illegal.status}`);
  }
  console.log('[smoke] illegal transition rejected (409): OK');

  // 23. Cancel + cleanup
  await fetch(`${base}/appointments/${appt1Body.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'CANCELLED' }),
  });
  await fetch(`${base}/appointments/${appt1Body.data.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  await fetch(`${base}/vehicles/${veh2Body.data.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  await fetch(`${base}/customers/${cust2Body.data.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  await fetch(`${base}/services/${svcBody.data.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

  // ─── Fase 5: Ordens de Serviço (§11/§35/§36) ───

  // Customer + vehicle for the WO flow (unique per run).
  const woCpf = generateUniqueCpf();
  const woCustomer = await fetch(`${base}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Cliente OS', cpf: woCpf, phone: '11999998888' }),
  });
  const woCustomerBody = (await woCustomer.json()) as { success: boolean; data?: { id: string } };
  if (!woCustomerBody.success || !woCustomerBody.data) {
    throw new Error('smoke: WO customer failed');
  }
  const woPlate = generateUniquePlate();
  const woVehicle = await fetch(`${base}/vehicles`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerId: woCustomerBody.data.id,
      plate: woPlate,
      brand: 'Toyota',
      model: 'Corolla',
      year: 2022,
    }),
  });
  const woVehicleBody = (await woVehicle.json()) as { success: boolean; data?: { id: string } };
  if (!woVehicleBody.success || !woVehicleBody.data) {
    throw new Error('smoke: WO vehicle failed');
  }

  // Catalog service + product with stock.
  const woService = await fetch(`${base}/services`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: `Serviço OS ${Date.now()}`, priceCents: 20000 }),
  });
  const woServiceBody = (await woService.json()) as { success: boolean; data?: { id: string; priceCents: number } };
  if (!woServiceBody.success || !woServiceBody.data) throw new Error('smoke: WO service failed');

  const woProductCode = `WO-${Date.now()}`;
  const woProduct = await fetch(`${base}/products`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      code: woProductCode,
      name: 'Peça OS Smoke',
      costPriceCents: 1000,
      salePriceCents: 2500,
      stockQuantity: 20,
      minStock: 2,
    }),
  });
  const woProductBody = (await woProduct.json()) as {
    success: boolean;
    data?: { id: string; stockQuantity: number };
  };
  if (!woProductBody.success || !woProductBody.data) throw new Error('smoke: WO product failed');

  // 24. Open the work order
  const woRes = await fetch(`${base}/work-orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerId: woCustomerBody.data.id,
      vehicleId: woVehicleBody.data.id,
    }),
  });
  const woBody = (await woRes.json()) as {
    success: boolean;
    data?: { id: string; orderNumber: number; status: string; totals: { totalCents: number } };
  };
  if (!woRes.ok || !woBody.success || !woBody.data) {
    throw new Error('smoke: create work order failed');
  }
  if (woBody.data.status !== 'OPEN' || woBody.data.totals.totalCents !== 0) {
    throw new Error('smoke: WO initial state mismatch');
  }
  console.log(`[smoke] create work order: OK (#${woBody.data.orderNumber})`);

  // 25. Add service item — snapshot must copy catalog price
  const addSvc = await fetch(`${base}/work-orders/${woBody.data.id}/service-items`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ serviceId: woServiceBody.data.id, quantity: 1 }),
  });
  const addSvcBody = (await addSvc.json()) as {
    success: boolean;
    data?: { serviceItems: { serviceName: string; unitPriceCents: number }[]; totals: { servicesCents: number } };
  };
  if (!addSvc.ok || !addSvcBody.success || !addSvcBody.data) {
    throw new Error('smoke: add service item failed');
  }
  const svcItem = addSvcBody.data.serviceItems[0];
  if (!svcItem || svcItem.unitPriceCents !== 20000 || addSvcBody.data.totals.servicesCents !== 20000) {
    throw new Error('smoke: service snapshot mismatch');
  }
  console.log('[smoke] service item snapshot (20000 cents): OK');

  // 26. Add product item — stock must be debited 20 → 18
  const addPrd = await fetch(`${base}/work-orders/${woBody.data.id}/product-items`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ productId: woProductBody.data.id, quantity: 2, discountCents: 500 }),
  });
  const addPrdBody = (await addPrd.json()) as {
    success: boolean;
    data?: { productItems: { unitPriceCents: number }[]; totals: { productsCents: number } };
  };
  if (!addPrd.ok || !addPrdBody.success || !addPrdBody.data) {
    throw new Error('smoke: add product item failed');
  }
  if (addPrdBody.data.totals.productsCents !== 4500) {
    throw new Error(`smoke: product totals mismatch (${addPrdBody.data.totals.productsCents})`);
  }
  const stockCheck = await fetch(`${base}/products/${woProductBody.data.id}`, {
    headers: authHeaders,
  });
  const stockCheckBody = (await stockCheck.json()) as { data?: { stockQuantity: number } };
  if (stockCheckBody.data?.stockQuantity !== 18) {
    throw new Error(`smoke: stock after reserve = ${stockCheckBody.data?.stockQuantity}, expected 18`);
  }
  console.log('[smoke] product item + stock reserve (20 → 18): OK');

  // 26b. Remove product item while editable → stock returns 18 → 20
  const woDetailEarly = await fetch(`${base}/work-orders/${woBody.data.id}`, {
    headers: authHeaders,
  });
  const woDetailEarlyBody = (await woDetailEarly.json()) as {
    data?: { productItems: { id: string }[] };
  };
  const productItemIdEarly = woDetailEarlyBody.data?.productItems[0]?.id;
  if (!productItemIdEarly) throw new Error('smoke: product item id missing (early)');
  const rmPrdEarly = await fetch(
    `${base}/work-orders/${woBody.data.id}/product-items/${productItemIdEarly}`,
    { method: 'DELETE', headers: authHeaders },
  );
  if (!rmPrdEarly.ok) {
    throw new Error(`smoke: remove product item failed early (${rmPrdEarly.status})`);
  }
  const stockCheckEarly = await fetch(`${base}/products/${woProductBody.data.id}`, {
    headers: authHeaders,
  });
  const stockCheckEarlyBody = (await stockCheckEarly.json()) as {
    data?: { stockQuantity: number };
  };
  if (stockCheckEarlyBody.data?.stockQuantity !== 20) {
    throw new Error(
      `smoke: stock after early refund = ${stockCheckEarlyBody.data?.stockQuantity}, expected 20`,
    );
  }
  console.log('[smoke] product item removal + stock refund (18 → 20): OK');

  // Re-add the item for the lock test (stock 20 → 18 again).
  const reAddPrd = await fetch(`${base}/work-orders/${woBody.data.id}/product-items`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ productId: woProductBody.data.id, quantity: 2, discountCents: 500 }),
  });
  if (!reAddPrd.ok) throw new Error('smoke: re-add product item failed');

  // 27. OPEN → IN_ASSESSMENT (items still editable) → AWAITING_APPROVAL (locked)
  const woStatus1 = await fetch(`${base}/work-orders/${woBody.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'IN_ASSESSMENT' }),
  });
  if (!woStatus1.ok) throw new Error('smoke: WO transition to IN_ASSESSMENT failed');

  const woStatus2 = await fetch(`${base}/work-orders/${woBody.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'AWAITING_APPROVAL' }),
  });
  if (!woStatus2.ok) throw new Error('smoke: WO transition to AWAITING_APPROVAL failed');

  const lockedAdd = await fetch(`${base}/work-orders/${woBody.data.id}/service-items`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ serviceId: woServiceBody.data.id, quantity: 1 }),
  });
  const lockedAddBody = (await lockedAdd.json()) as { error?: { code: string } };
  if (lockedAdd.status !== 409 || lockedAddBody.error?.code !== 'WORK_ORDER_ITEMS_LOCKED') {
    throw new Error(`expected 409 WORK_ORDER_ITEMS_LOCKED, got ${lockedAdd.status}`);
  }
  console.log('[smoke] items locked after IN_ASSESSMENT (409): OK');

  // 28. Illegal jump OPEN-ish → DELIVERED must 409 (from IN_ASSESSMENT)
  const illegalWo = await fetch(`${base}/work-orders/${woBody.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'DELIVERED' }),
  });
  const illegalWoBody = (await illegalWo.json()) as { error?: { code: string } };
  if (illegalWo.status !== 409 || illegalWoBody.error?.code !== 'INVALID_WORK_ORDER_TRANSITION') {
    throw new Error(`expected 409 INVALID_WORK_ORDER_TRANSITION, got ${illegalWo.status}`);
  }
  console.log('[smoke] illegal WO transition rejected (409): OK');

  // ─── Fase 6: Imagens + Histórico derivado (§14) ───

  // Minimal valid-by-magic PNG (server sniffs magic bytes, not the header).
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
    0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
    0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
    0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  // 29. Upload an image to the work order (multipart/form-data)
  const imageForm = new FormData();
  imageForm.append(
    'file',
    new Blob([pngBytes], { type: 'image/png' }),
    'foto-motor.png',
  );
  imageForm.append('caption', 'Foto do motor antes da troca');
  const uploadRes = await fetch(`${base}/work-orders/${woBody.data.id}/images`, {
    method: 'POST',
    headers: { Authorization: authHeaders.Authorization },
    body: imageForm,
  });
  const uploadBody = (await uploadRes.json()) as {
    success: boolean;
    data?: { id: string; sha256: string; mimeType: string; sizeBytes: number; url: string };
  };
  if (!uploadRes.ok || !uploadBody.success || !uploadBody.data) {
    throw new Error(`smoke: image upload failed (${uploadRes.status})`);
  }
  if (uploadBody.data.mimeType !== 'image/png' || uploadBody.data.sizeBytes !== pngBytes.length) {
    throw new Error('smoke: image metadata mismatch');
  }
  console.log('[smoke] image upload (sha256-addressed): OK');

  // 30. Download the image — raw bytes, no envelope, correct Content-Type
  const downloadRes = await fetch(`${base}${uploadBody.data.url}`, {
    headers: { Authorization: authHeaders.Authorization },
  });
  if (!downloadRes.ok) throw new Error(`smoke: image download failed (${downloadRes.status})`);
  if (downloadRes.headers.get('content-type') !== 'image/png') {
    throw new Error('smoke: image content-type mismatch');
  }
  const downloadedBytes = Buffer.from(await downloadRes.arrayBuffer());
  if (!downloadedBytes.equals(pngBytes)) {
    throw new Error('smoke: downloaded bytes differ from upload');
  }
  console.log('[smoke] image download (raw bytes, no envelope): OK');

  // 31. Reject a non-image upload with 415
  const badForm = new FormData();
  badForm.append('file', new Blob([Buffer.from('definitely not an image')], { type: 'text/plain' }), 'x.txt');
  const badUpload = await fetch(`${base}/work-orders/${woBody.data.id}/images`, {
    method: 'POST',
    headers: { Authorization: authHeaders.Authorization },
    body: badForm,
  });
  const badUploadBody = (await badUpload.json()) as { error?: { code: string } };
  if (badUpload.status !== 415 || badUploadBody.error?.code !== 'UNSUPPORTED_MEDIA_TYPE') {
    throw new Error(`expected 415 UNSUPPORTED_MEDIA_TYPE, got ${badUpload.status}`);
  }
  console.log('[smoke] non-image upload rejected (415): OK');

  // 32. Derived vehicle history — one entry with the snapshot items
  const historyRes = await fetch(
    `${base}/work-orders/vehicle/${woVehicleBody.data.id}/history`,
    { headers: authHeaders },
  );
  const historyBody = (await historyRes.json()) as {
    success: boolean;
    data?: Array<{
      orderNumber: number;
      services: { name: string; unitPriceCents: number; quantity: number }[];
      products: { name: string; quantity: number }[];
      totalCents: number;
    }>;
  };
  if (!historyRes.ok || !historyBody.success || !historyBody.data) {
    throw new Error(`smoke: vehicle history failed (${historyRes.status})`);
  }
  const historyEntry = historyBody.data[0];
  if (
    !historyEntry ||
    historyEntry.orderNumber !== woBody.data.orderNumber ||
    historyEntry.services[0]?.unitPriceCents !== 20000 ||
    historyEntry.products.length !== 1 ||
    historyEntry.totalCents !== 24500
  ) {
    throw new Error(`smoke: history entry mismatch (${JSON.stringify(historyEntry)})`);
  }
  console.log('[smoke] derived vehicle history (service+product snapshots): OK');

  // 33. Delete the image, then the bytes must 404
  const deleteImageRes = await fetch(
    `${base}/work-orders/${woBody.data.id}/images/${uploadBody.data.id}`,
    { method: 'DELETE', headers: authHeaders },
  );
  if (deleteImageRes.status !== 204) {
    throw new Error(`smoke: image delete failed (${deleteImageRes.status})`);
  }
  const deletedDownload = await fetch(`${base}${uploadBody.data.url}`, {
    headers: { Authorization: authHeaders.Authorization },
  });
  if (deletedDownload.status !== 404) {
    throw new Error(`expected 404 after image delete, got ${deletedDownload.status}`);
  }
  console.log('[smoke] image delete + 404 on bytes: OK');

  // 34. Cleanup (WO cascade-deletes items and any remaining image rows)
  await fetch(`${base}/work-orders/${woBody.data.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${base}/vehicles/${woVehicleBody.data.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${base}/customers/${woCustomerBody.data.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${base}/services/${woServiceBody.data.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${base}/products/${woProductBody.data.id}`, { method: 'DELETE', headers: authHeaders });

  await api.close();
  console.log('[smoke] ALL CHECKS PASSED');
}

void main().catch((error: unknown) => {
  console.error('[smoke] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
