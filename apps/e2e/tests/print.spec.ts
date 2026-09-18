import { expect, test } from '@playwright/test';
import { E2eApi } from '../support/api';
import { uniqueCode, uniquePlate, validCpf } from '../support/data';
import { login, nav, stubPrint } from '../support/ui';

/**
 * B5 — printing end-to-end. `window.print` is stubbed so the injected
 * `#print-root` (normally removed on `afterprint`) stays in the DOM and can be
 * asserted. Verify the generated document, not the OS print dialog.
 */

const RECEIVER_NAME = 'João Retirou E2E';

/** Seeds an OS driven all the way to Entregue (pickup registered). */
async function seedDeliveredOrder(api: E2eApi) {
  const cpf = validCpf();
  const customer = await api.createCustomer({
    name: `Cliente Impressão ${cpf.slice(0, 3)}`,
    cpf,
    phone: '(11) 91234-5678',
  });
  const vehicle = await api.createVehicle({
    customerId: customer.id,
    plate: uniquePlate(),
    brand: 'Chevrolet',
    model: 'Onix',
  });
  const service = await api.createService({ name: 'Revisão completa E2E', priceCents: 25000 });
  const product = await api.createProduct({
    code: uniqueCode('PEC'),
    name: 'Vela de ignição E2E',
    costPriceCents: 1500,
    salePriceCents: 4000,
    stockQuantity: 3,
  });

  const workOrder = await api.createWorkOrder({
    customerId: customer.id,
    vehicleId: vehicle.id,
  });
  await api.addServiceItem(workOrder.id, service.id);
  await api.addProductItem(workOrder.id, product.id);
  for (const status of [
    'IN_ASSESSMENT',
    'AWAITING_APPROVAL',
    'APPROVED',
    'IN_EXECUTION',
    'COMPLETED',
    'AWAITING_PICKUP',
  ]) {
    await api.transitionWorkOrder(workOrder.id, status);
  }
  await api.registerPickup(workOrder.id, {
    receiverName: RECEIVER_NAME,
    receiverDoc: '52998224725',
  });

  return { customer, vehicle, service, product, workOrder };
}

test('prints the work order document (B5)', async ({ page }) => {
  const api = await E2eApi.create();
  try {
    const { customer, service, product, workOrder } = await seedDeliveredOrder(api);

    await stubPrint(page);
    await login(page);
    await page.goto(`/#/work-orders/${workOrder.id}`);
    await expect(page.getByRole('heading', { name: /^OS #/ })).toBeVisible();

    await page.getByRole('button', { name: /Imprimir OS/ }).click();

    const printRoot = page.locator('#print-root');
    await expect(printRoot).toContainText(`Ordem de Serviço #${workOrder.orderNumber}`);
    await expect(printRoot).toContainText(customer.name);
    await expect(printRoot).toContainText(service.name);
    await expect(printRoot).toContainText(product.name);
    await expect(printRoot).toContainText('A oficina');
  } finally {
    await api.dispose();
  }
});

test('prints the pickup receipt after the vehicle is handed over (B5)', async ({ page }) => {
  const api = await E2eApi.create();
  try {
    const { workOrder } = await seedDeliveredOrder(api);

    await stubPrint(page);
    await login(page);
    await nav(page, 'Retirada/Entrega').click();
    await expect(
      page.getByRole('heading', { name: 'Retirada / Entrega de Veículos' }),
    ).toBeVisible();

    const historyRow = page
      .getByRole('row')
      .filter({ has: page.getByText(`#${workOrder.orderNumber}`, { exact: true }) });
    await historyRow.getByRole('button', { name: /Recibo/ }).click();

    const printRoot = page.locator('#print-root');
    await expect(printRoot).toContainText('Comprovante de Retirada de Veículo');
    await expect(printRoot).toContainText(RECEIVER_NAME);
  } finally {
    await api.dispose();
  }
});
