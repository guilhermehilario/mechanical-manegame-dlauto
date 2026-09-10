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

  await api.close();
  console.log('[smoke] ALL CHECKS PASSED');
}

void main().catch((error: unknown) => {
  console.error('[smoke] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
