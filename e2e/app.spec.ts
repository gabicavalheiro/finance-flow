import { test, expect, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe('app autenticado', () => {
  test.skip(!EMAIL || !PASSWORD, 'defina E2E_EMAIL e E2E_PASSWORD para rodar estes fluxos');

  async function login(page: Page) {
    await page.goto('/');
    await page.getByPlaceholder('seu@email.com').fill(EMAIL!);
    await page.getByPlaceholder('••••••••').fill(PASSWORD!);
    await page.getByRole('button', { name: /Entrar/ }).last().click();
    await expect(page.getByRole('button', { name: /Ocultar valores|Mostrar valores/ })).toBeVisible({ timeout: 15_000 });
  }

  test('dashboard mostra os três resumos e permite ocultar valores', async ({ page }) => {
    await login(page);
    await expect(page.getByText('Saldo do Mês')).toBeVisible();
    await expect(page.getByText('Pendente a Pagar')).toBeVisible();
    await expect(page.getByText('A Receber')).toBeVisible();
    const toggle = page.getByRole('button', { name: 'Ocultar valores' });
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Mostrar valores' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('relatórios: aba Previsão exibe o painel de ML ou o aviso de dados insuficientes', async ({ page }) => {
    await login(page);
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    await page.getByRole('button', { name: /Previsão/ }).click();
    // Com histórico: métricas de backtest. Sem histórico: aviso explícito (nunca números inventados).
    await expect(page.getByText(/backtest|não confiável|histórico|insuficiente/i).first()).toBeVisible();
  });

  test('navegação entre páginas não quebra (ErrorBoundary não aparece)', async ({ page }) => {
    await login(page);
    for (const path of ['/cards', '/fixed', '/faturas', '/reports', '/classifier']) {
      await page.goto(path);
      await expect(page.getByText('Algo deu errado')).toHaveCount(0);
    }
  });
});
