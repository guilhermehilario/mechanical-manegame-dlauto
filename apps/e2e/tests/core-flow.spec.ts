import { expect, test } from '@playwright/test';
import { validCpf } from '../support/data';
import { login, nav } from '../support/ui';

/**
 * End-to-end smoke (spec §Fase 8): the full stack (API real + web real)
 * against a clean seeded database. Exercises the happy path a person would
 * click through the packaged app.
 *
 * R4/SEC-04: credentials are generated per run — never hardcoded.
 */

test('login reaches the dashboard', async ({ page }) => {
  await login(page);

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(nav(page, 'Clientes')).toBeVisible();
  await expect(nav(page, 'Relatórios')).toBeVisible();
});

test('create a customer through the UI', async ({ page }) => {
  await login(page);

  await nav(page, 'Clientes').click();
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();

  await page.getByRole('button', { name: 'Novo cliente' }).click();
  const cpf = validCpf();
  await page.getByLabel('Nome *').fill(`Cliente E2E ${cpf.slice(0, 3)}`);
  await page.getByLabel('CPF *').fill(cpf);
  await page.getByLabel('Telefone *').fill('(11) 91234-5678');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByRole('button', { name: 'Novo cliente' })).toBeVisible();
  await expect(page.getByText(`Cliente E2E ${cpf.slice(0, 3)}`)).toBeVisible();
});

test('reports page renders its tabs', async ({ page }) => {
  await login(page);

  await nav(page, 'Relatórios').click();
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Receita' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Serviços' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Produtos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Status das OS' })).toBeVisible();
});

test('exports the active report as CSV (B4)', async ({ page }) => {
  await login(page);

  await nav(page, 'Relatórios').click();
  await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^relatorio-revenue-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/,
  );
});