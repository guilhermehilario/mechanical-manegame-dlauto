import { expect, test } from '@playwright/test';
import { E2eApi } from '../support/api';
import { localDateTime, uniqueCode, uniquePlate, validCpf } from '../support/data';
import { login, nav } from '../support/ui';

/**
 * G1 — deeper end-to-end coverage: the full work-order lifecycle, the stock
 * guard and the appointment conflict, all against the real stack.
 *
 * Prerequisites (customer/vehicle/catalog) are seeded through the API — the
 * e2e database only ships the admin user. The behaviour under test is always
 * driven through the UI.
 */

test('full work order cycle: open → items → approve → execute → complete → pay → pick up', async ({
  page,
}) => {
  const api = await E2eApi.create();
  try {
    const cpf = validCpf();
    const customer = await api.createCustomer({
      name: `Cliente Ciclo ${cpf.slice(0, 3)}`,
      cpf,
      phone: '(11) 91234-5678',
    });
    const vehicle = await api.createVehicle({
      customerId: customer.id,
      plate: uniquePlate(),
      brand: 'Volkswagen',
      model: 'Gol',
    });
    const service = await api.createService({ name: 'Troca de óleo E2E', priceCents: 15000 });
    const product = await api.createProduct({
      code: uniqueCode('FIL'),
      name: 'Filtro de óleo E2E',
      costPriceCents: 2000,
      salePriceCents: 5000,
      stockQuantity: 5,
    });

    await login(page);

    // 1. Create the OS through the real form.
    await nav(page, 'Ordens de Serviço').click();
    await page.getByRole('button', { name: 'Nova OS' }).click();
    await page.getByLabel('Cliente *').selectOption(customer.id);
    await page.getByLabel('Veículo *').selectOption(vehicle.id);
    await page.getByRole('button', { name: 'Abrir OS' }).click();

    const workOrder = await api.findWorkOrderByCustomer(customer.id);

    await page.goto(`/#/work-orders/${workOrder.id}`);
    await expect(
      page.getByRole('heading', { name: `OS #${workOrder.orderNumber}` }),
    ).toBeVisible();

    // 2. Add a service and a product (the product debits stock server-side).
    const serviceSelect = page.locator('select:has(option:text("Selecione o serviço…"))');
    await serviceSelect.selectOption(service.id);
    await page
      .locator('form', { has: serviceSelect })
      .getByRole('button', { name: 'Adicionar' })
      .click();
    await expect(page.getByRole('cell', { name: service.name })).toBeVisible();

    const productSelect = page.locator('select:has(option:text("Selecione a peça…"))');
    await productSelect.selectOption(product.id);
    await page
      .locator('form', { has: productSelect })
      .getByRole('button', { name: 'Adicionar' })
      .click();
    await expect(page.getByRole('cell', { name: product.name })).toBeVisible();

    // 3. Walk the status chain up to Concluída.
    for (const status of [
      'Em avaliação',
      'Aguardando aprovação',
      'Aprovada',
      'Em execução',
      'Concluída',
    ]) {
      await page.getByRole('button', { name: `Marcar: ${status}` }).click();
      await expect(page.getByRole('heading', { name: /^OS #/ })).toContainText(status);
    }

    // 4. Pay the full balance (service 150 + product 50 = R$ 200,00).
    await page.getByRole('button', { name: /Receber saldo/ }).click();
    await page.getByRole('button', { name: 'Receber', exact: true }).click();
    await expect(page.getByText('PAGO', { exact: true })).toBeVisible();

    // 5. Hand the vehicle over through the pickup screen.
    await page.getByRole('button', { name: 'Marcar: Aguardando retirada' }).click();
    await expect(page.getByRole('heading', { name: /^OS #/ })).toContainText(
      'Aguardando retirada',
    );

    await nav(page, 'Retirada/Entrega').click();
    await expect(
      page.getByRole('heading', { name: 'Retirada / Entrega de Veículos' }),
    ).toBeVisible();

    const queueRow = page
      .getByRole('row')
      .filter({ has: page.getByText(`#${workOrder.orderNumber}`, { exact: true }) });
    await queueRow.getByRole('button', { name: 'Registrar retirada' }).click();
    await page.getByLabel('Nome de quem retira *').fill('Maria Cliente E2E');
    await page.getByLabel('CPF/CNH (11 dígitos) *').fill('52998224725');
    await page.getByRole('button', { name: 'Confirmar retirada' }).click();

    const historyRow = page
      .getByRole('row')
      .filter({ has: page.getByText(`#${workOrder.orderNumber}`, { exact: true }) });
    await expect(historyRow.getByRole('button', { name: /Recibo/ })).toBeVisible();

    // 6. The OS is now Entregue.
    await page.goto(`/#/work-orders/${workOrder.id}`);
    await expect(page.getByRole('heading', { name: /^OS #/ })).toContainText('Entregue');
  } finally {
    await api.dispose();
  }
});

test('selling more than the available stock surfaces INSUFFICIENT_STOCK', async ({ page }) => {
  const api = await E2eApi.create();
  try {
    const cpf = validCpf();
    const customer = await api.createCustomer({
      name: `Cliente Estoque ${cpf.slice(0, 3)}`,
      cpf,
      phone: '(11) 91234-5678',
    });
    const vehicle = await api.createVehicle({
      customerId: customer.id,
      plate: uniquePlate(),
      brand: 'Fiat',
      model: 'Uno',
    });
    const product = await api.createProduct({
      code: uniqueCode('PEC'),
      name: 'Pastilha de freio E2E',
      costPriceCents: 3000,
      salePriceCents: 8000,
      stockQuantity: 1,
    });
    const workOrder = await api.createWorkOrder({
      customerId: customer.id,
      vehicleId: vehicle.id,
    });

    await login(page);
    await page.goto(`/#/work-orders/${workOrder.id}`);

    const productSelect = page.locator('select:has(option:text("Selecione a peça…"))');
    await productSelect.selectOption(product.id);
    const productForm = page.locator('form', { has: productSelect });
    await productForm.locator('input[type="number"]').first().fill('2');
    await productForm.getByRole('button', { name: 'Adicionar' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Estoque insuficiente para Pastilha de freio E2E (disponível: 1)',
    );
  } finally {
    await api.dispose();
  }
});

test('scheduling the same vehicle twice at the same time shows a conflict', async ({ page }) => {
  const api = await E2eApi.create();
  try {
    const cpf = validCpf();
    const customer = await api.createCustomer({
      name: `Cliente Agenda ${cpf.slice(0, 3)}`,
      cpf,
      phone: '(11) 91234-5678',
    });
    const vehicle = await api.createVehicle({
      customerId: customer.id,
      plate: uniquePlate(),
      brand: 'Toyota',
      model: 'Corolla',
    });
    const service = await api.createService({ name: 'Alinhamento E2E', priceCents: 8000 });
    const scheduledAt = localDateTime(60);
    await api.createAppointment({
      customerId: customer.id,
      vehicleId: vehicle.id,
      serviceId: service.id,
      scheduledAt,
    });

    await login(page);
    await nav(page, 'Agendamentos').click();
    await page.getByRole('button', { name: 'Novo agendamento' }).click();
    await page.getByLabel('Cliente *').selectOption(customer.id);
    await page.getByLabel('Veículo *').selectOption(vehicle.id);
    await page.getByLabel('Serviço *').selectOption(service.id);
    await page.getByLabel('Data e hora *').fill(scheduledAt);
    await page.getByRole('button', { name: 'Salvar' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Este veículo já possui um agendamento ativo nesse horário. Escolha outro horário.',
    );
  } finally {
    await api.dispose();
  }
});
