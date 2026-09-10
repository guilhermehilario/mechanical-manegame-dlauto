import { expect, test, type Page } from '@playwright/test';

/**
 * End-to-end smoke (spec §Fase 8): the full stack (API real + web real)
 * against a clean seeded database. Exercises the happy path a person would
 * click through the packaged app.
 */

async function login(page: Page): Promise<void> {
  await page.goto('/#/login');
  await page.getByLabel('E-mail').fill('admin@oficina.local');
  await page.getByLabel('Senha').fill('admin1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/?$/);
}

/** Navigation link on the sidebar (the label also appears on KPI cards). */
function nav(page: Page, label: string) {
  return page.getByRole('link', { name: label, exact: true });
}

/** Gera um CPF válido (11 dígitos, dígitos verificadores corretos). */
function validCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (digits: number[], span: number): number => {
    const sum = digits.reduce((acc, d, i) => acc + d * (span - i), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const dv1 = dv(base, 10);
  const dv2 = dv([...base, dv1], 11);
  const full = [...base, dv1, dv2].join('');
  return `${full.slice(0, 3)}.${full.slice(3, 6)}.${full.slice(6, 9)}-${full.slice(9)}`;
}

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