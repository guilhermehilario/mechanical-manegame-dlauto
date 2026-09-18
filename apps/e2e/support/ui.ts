import { expect, type Page } from '@playwright/test';
import { E2E_ADMIN_EMAIL, readE2EAdminPassword } from './credentials';

/** Logs in through the real login form and waits for the dashboard. */
export async function login(page: Page): Promise<void> {
  await page.goto('/#/login');
  await page.getByLabel('E-mail').fill(E2E_ADMIN_EMAIL);
  await page.getByLabel('Senha').fill(readE2EAdminPassword());
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/?$/);
}

/** Navigation link on the sidebar (the label also appears on KPI cards). */
export function nav(page: Page, label: string) {
  return page.getByRole('link', { name: label, exact: true });
}

/** No-ops `window.print` so the injected `#print-root` is not cleaned up. */
export async function stubPrint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Runs in the browser; `window` is not in the Node-side lib types.
    (globalThis as unknown as { print: () => void }).print = () => undefined;
  });
}
