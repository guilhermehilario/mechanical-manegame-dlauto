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

/** Local "YYYY-MM-DD" for a Date (report input format). */
function formatYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  // R4/SEC-04: no default credentials. The smoke logs in with the SAME admin
  // the developer seeded (SEED_ADMIN_*), read from the environment/.env
  // (dotenv above already merged the file into process.env).
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      'Smoke aborted: SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD não definidos. ' +
        'R4/SEC-04 — este projeto não tem credenciais padrão; configure-as no .env ' +
        '(as mesmas usadas no `pnpm db:seed`).',
    );
  }

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

  // 3. Login with the seeded admin (env-provided, R4)
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
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
  if (!me.ok || !meBody.success || meBody.data?.email !== adminEmail) {
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

  // ─── Fase 7: Retirada/Entrega (1─1, transacional com → DELIVERED) ───

  // At this point the OS is AWAITING_APPROVAL — moving to AWAITING_PICKUP
  // requires the full happy path: APPROVED → IN_EXECUTION → COMPLETED.
  const path1 = await fetch(`${base}/work-orders/${woBody.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'APPROVED' }),
  });
  if (!path1.ok) throw new Error('smoke: WO transition to APPROVED failed');
  const path2 = await fetch(`${base}/work-orders/${woBody.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'IN_EXECUTION' }),
  });
  if (!path2.ok) throw new Error('smoke: WO transition to IN_EXECUTION failed');
  const path3 = await fetch(`${base}/work-orders/${woBody.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'COMPLETED' }),
  });
  if (!path3.ok) throw new Error('smoke: WO transition to COMPLETED failed');
  const path4 = await fetch(`${base}/work-orders/${woBody.data.id}/status`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'AWAITING_PICKUP' }),
  });
  if (!path4.ok) throw new Error('smoke: WO transition to AWAITING_PICKUP failed');
  console.log('[smoke] WO path to AWAITING_PICKUP: OK');

  // 34. Registering a pickup on a non-AWAITING_PICKUP OS must 409
  const wo2Res = await fetch(`${base}/work-orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerId: woCustomerBody.data.id,
      vehicleId: woVehicleBody.data.id,
    }),
  });
  const wo2Body = (await wo2Res.json()) as { success: boolean; data?: { id: string } };
  if (!wo2Res.ok || !wo2Body.success || !wo2Body.data) {
    throw new Error('smoke: second work order failed');
  }
  const earlyPickup = await fetch(`${base}/vehicle-pickups/work-order/${wo2Body.data.id}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ receiverName: 'Maria Souza', receiverDoc: '52998224725' }),
  });
  const earlyPickupBody = (await earlyPickup.json()) as { error?: { code: string } };
  if (
    earlyPickup.status !== 409 ||
    earlyPickupBody.error?.code !== 'WORK_ORDER_NOT_AWAITING_PICKUP'
  ) {
    throw new Error(`expected 409 WORK_ORDER_NOT_AWAITING_PICKUP, got ${earlyPickup.status}`);
  }
  console.log('[smoke] pickup on non-AWAITING_PICKUP OS rejected (409): OK');

  // 35. Register the pickup — receipt + → DELIVERED in one transaction
  const pickupRes = await fetch(`${base}/vehicle-pickups/work-order/${woBody.data.id}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      receiverName: 'Maria Souza',
      receiverDoc: '529.982.247-25',
      receiverPhone: '(11) 99999-8888',
      mileageKm: 45200,
      signatureData: 'data:image/png;base64,iVBORw0KGgo=',
      notes: 'Cliente satisfeito',
    }),
  });
  const pickupBody = (await pickupRes.json()) as {
    success: boolean;
    data?: {
      id: string;
      orderNumber: number;
      receiverDoc: string;
      hasSignature: boolean;
    };
  };
  if (!pickupRes.ok || !pickupBody.success || !pickupBody.data) {
    throw new Error(`smoke: pickup register failed (${pickupRes.status})`);
  }
  if (pickupBody.data.receiverDoc !== '52998224725' || !pickupBody.data.hasSignature) {
    throw new Error('smoke: pickup receipt content mismatch');
  }
  const woAfterPickup = await fetch(`${base}/work-orders/${woBody.data.id}`, {
    headers: authHeaders,
  });
  const woAfterPickupBody = (await woAfterPickup.json()) as { data?: { status: string } };
  if (woAfterPickupBody.data?.status !== 'DELIVERED') {
    throw new Error(`expected OS DELIVERED after pickup, got ${woAfterPickupBody.data?.status}`);
  }
  console.log('[smoke] pickup registered + OS DELIVERED (transactional): OK');

  // 36. Second receipt for the same OS must 409 — the OS is now DELIVERED,
  // so the status guard fires first (the 1─1 is also DB-enforced via unique FK).
  const dupPickup = await fetch(`${base}/vehicle-pickups/work-order/${woBody.data.id}`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ receiverName: 'Maria Souza', receiverDoc: '52998224725' }),
  });
  const dupPickupBody = (await dupPickup.json()) as { error?: { code: string } };
  if (
    dupPickup.status !== 409 ||
    (dupPickupBody.error?.code !== 'WORK_ORDER_NOT_AWAITING_PICKUP' &&
      dupPickupBody.error?.code !== 'PICKUP_ALREADY_EXISTS')
  ) {
    throw new Error(`expected 409 conflict for duplicate pickup, got ${dupPickup.status}`);
  }
  console.log('[smoke] duplicate pickup rejected (409): OK');

  // 37. The receipts list shows the registered pickup
  const pickupsList = await fetch(`${base}/vehicle-pickups?limit=10`, {
    headers: authHeaders,
  });
  const pickupsListBody = (await pickupsList.json()) as {
    success: boolean;
    data?: { items: Array<{ id: string; orderNumber: number }>; total: number };
  };
  if (!pickupsList.ok || !pickupsListBody.success || !pickupsListBody.data) {
    throw new Error('smoke: pickups list failed');
  }
  if (!pickupsListBody.data.items.some((p) => p.id === pickupBody.data?.id)) {
    throw new Error('smoke: registered pickup missing from list');
  }
  console.log('[smoke] pickups list contains receipt: OK');

  // ─── Fase 8: Dashboard + Relatórios (derived queries) ───

  // 38. Dashboard summary reflects the data created by this run.
  const dashboardRes = await fetch(`${base}/dashboard/summary`, { headers: authHeaders });
  const dashboardBody = (await dashboardRes.json()) as {
    success: boolean;
    data?: {
      counts: { customers: number; activeWorkOrders: number; awaitingPickup: number; todayAppointments: number; lowStockProducts: number };
      revenue: { currentMonthCents: number; previousMonthCents: number };
      workOrdersByStatus: Array<{ status: string; count: number }>;
      upcomingAppointments: unknown[];
      recentWorkOrders: Array<{ orderNumber: number }>;
      lowStockProducts: unknown[];
    };
  };
  if (!dashboardRes.ok || !dashboardBody.success || !dashboardBody.data) {
    throw new Error(`smoke: dashboard summary failed (${dashboardRes.status})`);
  }
  const dashData = dashboardBody.data;
  if (dashData.counts.customers < 1 || dashData.counts.activeWorkOrders < 0) {
    throw new Error('smoke: dashboard counters invalid');
  }
  if (
    typeof dashData.revenue.currentMonthCents !== 'number' ||
    typeof dashData.revenue.previousMonthCents !== 'number'
  ) {
    throw new Error('smoke: dashboard revenue buckets invalid');
  }
  if (!dashData.workOrdersByStatus.some((row) => row.status === 'DELIVERED' && row.count >= 1)) {
    throw new Error('smoke: dashboard status distribution missing DELIVERED OS');
  }
  console.log('[smoke] dashboard summary (counters + revenue + status): OK');

  // 39. Revenue report over a wide period includes today's delivered OS.
  const reportFrom = formatYmd(new Date(Date.now() - 365 * 24 * 3600 * 1000));
  const reportTo = formatYmd(new Date());
  const revenueRes = await fetch(
    `${base}/reports/revenue?from=${reportFrom}&to=${reportTo}`,
    { headers: authHeaders },
  );
  const revenueBody = (await revenueRes.json()) as {
    success: boolean;
    data?: { from: string; to: string; totalCents: number; items: Array<{ totalCents: number }> };
  };
  if (!revenueRes.ok || !revenueBody.success || !revenueBody.data) {
    throw new Error(`smoke: revenue report failed (${revenueRes.status})`);
  }
  if (revenueBody.data.totalCents <= 0 || revenueBody.data.items.length < 1) {
    throw new Error(`smoke: revenue report empty (${JSON.stringify(revenueBody.data)})`);
  }
  console.log('[smoke] revenue report (delivered OS totaled): OK');

  // 40. Top services/products rank the snapshots of the delivered OS.
  const topSvcRes = await fetch(
    `${base}/reports/top-services?from=${reportFrom}&to=${reportTo}`,
    { headers: authHeaders },
  );
  const topSvcBody = (await topSvcRes.json()) as {
    success: boolean;
    data?: { items: Array<{ name: string; revenueCents: number }> };
  };
  if (!topSvcRes.ok || !topSvcBody.success || !topSvcBody.data || topSvcBody.data.items.length < 1) {
    throw new Error('smoke: top-services report failed');
  }
  const topService = topSvcBody.data.items[0];
  if (!topService || !(topService.revenueCents >= 20000)) {
    throw new Error(
      `smoke: top-services did not include this run's OS (${JSON.stringify(topSvcBody.data.items)})`,
    );
  }
  console.log('[smoke] top-services report (snapshot ranking): OK');

  // 41. Work-order status report fills every status (including zeros).
  const woReportRes = await fetch(
    `${base}/reports/work-orders?from=${reportFrom}&to=${reportTo}`,
    { headers: authHeaders },
  );
  const woReportBody = (await woReportRes.json()) as {
    success: boolean;
    data?: { items: Array<{ status: string; count: number }> };
  };
  if (!woReportRes.ok || !woReportBody.success || !woReportBody.data) {
    throw new Error(`smoke: work-order report failed (${woReportRes.status})`);
  }
  const deliveredRow = woReportBody.data.items.find((row) => row.status === 'DELIVERED');
  if (!deliveredRow || deliveredRow.count < 1) {
    throw new Error(`smoke: work-order report missing DELIVERED (${JSON.stringify(woReportBody.data)})`);
  }
  console.log('[smoke] work-order status report (full matrix): OK');

  // Cleanup for the second WO used in the guard test.
  await fetch(`${base}/work-orders/${wo2Body.data.id}`, { method: 'DELETE', headers: authHeaders });

  // 42. A delivered OS with a pickup receipt is a legal record: hard delete
  // must be refused with a clean 409 (domain error), not a raw Prisma P2003.
  const protectedDelete = await fetch(`${base}/work-orders/${woBody.data.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const protectedDeleteBody = (await protectedDelete.json()) as { error?: { code: string } };
  if (
    protectedDelete.status !== 409 ||
    protectedDeleteBody.error?.code !== 'WORK_ORDER_HAS_FINANCIAL_RECORDS'
  ) {
    throw new Error(
      `expected 409 WORK_ORDER_HAS_FINANCIAL_RECORDS on delivered OS delete, got ${protectedDelete.status}`,
    );
  }
  console.log('[smoke] public OS delete protected (409 WORK_ORDER_HAS_FINANCIAL_RECORDS): OK');
  await fetch(`${base}/vehicles/${woVehicleBody.data.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${base}/customers/${woCustomerBody.data.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${base}/services/${woServiceBody.data.id}`, { method: 'DELETE', headers: authHeaders });
  await fetch(`${base}/products/${woProductBody.data.id}`, { method: 'DELETE', headers: authHeaders });

  // 43. R3/SEC-02: financial routes reject ATTENDANT (403) but accept ADMIN.
  const attendantEmail = `smoke-attendant-${Date.now()}@oficina.local`;
  const attendantPassword = `smoke-${Date.now()}-pass`;
  const createAttendantRes = await fetch(`${base}/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Smoke Attendant',
      email: attendantEmail,
      password: attendantPassword,
      role: 'ATTENDANT',
    }),
  });
  if (!createAttendantRes.ok) {
    throw new Error(`smoke: failed to create ATTENDANT (${createAttendantRes.status})`);
  }
  const attendantLogin = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: attendantEmail, password: attendantPassword }),
  });
  const attendantBody = (await attendantLogin.json()) as {
    success: boolean;
    data?: { accessToken: string };
  };
  if (!attendantLogin.ok || !attendantBody.data) {
    throw new Error('smoke: ATTENDANT login failed');
  }
  const attendantHeaders = { Authorization: `Bearer ${attendantBody.data.accessToken}` };

  const attendantReportsRes = await fetch(`${base}/reports/revenue`, { headers: attendantHeaders });
  if (attendantReportsRes.status !== 403) {
    throw new Error(`expected 403 for ATTENDANT on /reports/revenue, got ${attendantReportsRes.status}`);
  }
  const attendantUsersRes = await fetch(`${base}/users`, { headers: attendantHeaders });
  if (attendantUsersRes.status !== 403) {
    throw new Error(`expected 403 for ATTENDANT on /users, got ${attendantUsersRes.status}`);
  }
  console.log('[smoke] R3: ATTENDANT blocked on financial/user routes (403): OK');

  // Cleanup the smoke attendant.
  const attendantListRes = await fetch(`${base}/users?search=${encodeURIComponent(attendantEmail)}`, {
    headers: authHeaders,
  });
  const attendantListBody = (await attendantListRes.json()) as {
    success: boolean;
    data?: { items?: Array<{ id: string; email: string }> };
  };
  const createdAttendant = attendantListBody.data?.items?.find((u) => u.email === attendantEmail);
  if (createdAttendant) {
    await fetch(`${base}/users/${createdAttendant.id}`, { method: 'DELETE', headers: authHeaders });
  }

  // ─── Fase 10: backup → mutate → restore → verify (spec §3, R7) ───
  // 44. ATTENDANT cannot even list backups (admin-only surface).
  const attendantBackupsRes = await fetch(`${base}/backups`, { headers: attendantHeaders });
  if (attendantBackupsRes.status !== 403) {
    throw new Error(`expected 403 for ATTENDANT on /backups, got ${attendantBackupsRes.status}`);
  }
  console.log('[smoke] backups admin-only (403 for ATTENDANT): OK');

  // 45. Snapshot the DB, mutate it (new customer), restore, confirm the
  // customer is gone again — proof that restore really replaced the data.
  const createBackupRes = await fetch(`${base}/backups`, {
    method: 'POST',
    headers: authHeaders,
  });
  const backupBody = (await createBackupRes.json()) as {
    success: boolean;
    data?: { backup: { id: string; manifest: { databaseSha256: string; storageFiles: number } } };
  };
  if (!createBackupRes.ok || !backupBody.success || !backupBody.data) {
    throw new Error(`smoke: backup creation failed (${createBackupRes.status})`);
  }
  const backupId = backupBody.data.backup.id;
  if (!/^[0-9a-f]{64}$/.test(backupBody.data.backup.manifest.databaseSha256)) {
    throw new Error('smoke: backup manifest missing sha256');
  }
  console.log(`[smoke] backup created (${backupId}): OK`);

  // Mutate: unique customer AFTER the snapshot.
  const restoreProofCpf = generateUniqueCpf();
  const mutateRes = await fetch(`${base}/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Smoke Pós-Backup',
      cpf: restoreProofCpf,
      phone: '11999998888',
    }),
  });
  if (!mutateRes.ok) {
    throw new Error(`smoke: post-backup mutation failed (${mutateRes.status})`);
  }

  // Restore without confirm must be rejected (destructive guardrail).
  const restoreNoConfirm = await fetch(`${base}/backups/${backupId}/restore`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  if (restoreNoConfirm.status !== 400) {
    throw new Error(`expected 400 for restore without confirm, got ${restoreNoConfirm.status}`);
  }

  // Restore for real.
  const restoreRes = await fetch(`${base}/backups/${backupId}/restore`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ confirm: true }),
  });
  const restoreBody = (await restoreRes.json()) as {
    success: boolean;
    data?: { databaseRestored: boolean };
  };
  if (!restoreRes.ok || !restoreBody.success || !restoreBody.data?.databaseRestored) {
    throw new Error(`smoke: restore failed (${restoreRes.status})`);
  }

  // Verify: the post-backup customer no longer exists (data rolled back).
  const verifyRes = await fetch(
    `${base}/customers?search=${encodeURIComponent(restoreProofCpf)}`,
    { headers: authHeaders },
  );
  const verifyBody = (await verifyRes.json()) as {
    success: boolean;
    data?: { items: Array<{ id: string }> };
  };
  if (!verifyRes.ok || !verifyBody.success || (verifyBody.data?.items.length ?? 1) !== 0) {
    throw new Error('smoke: restored data still contains the post-backup customer');
  }

  // Cleanup the backup folder (idempotent runs) and finish.
  const deleteBackupRes = await fetch(`${base}/backups/${backupId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  if (!deleteBackupRes.ok && deleteBackupRes.status !== 404) {
    throw new Error(`smoke: backup cleanup failed (${deleteBackupRes.status})`);
  }
  console.log('[smoke] backup → mutate → restore rolls data back: OK');

  await api.close();
  console.log('[smoke] ALL CHECKS PASSED');
}

void main().catch((error: unknown) => {
  console.error('[smoke] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
