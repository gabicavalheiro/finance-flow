import { test, expect } from '@playwright/test';

// Demonstração pública: não exige login nem Firebase.
test.describe('laboratório de ML (público)', () => {
  test('abre sem login e mostra a avaliação do modelo', async ({ page }) => {
    await page.goto('/ml-lab');
    await expect(page.getByRole('heading', { name: 'Laboratório de ML' })).toBeVisible();
    await expect(page.getByText('Previsão x realidade')).toBeVisible();
    await expect(page.getByText(/Modelo escolhido/)).toBeVisible();
  });

  test('mudar o padrão de gasto mantém a tela consistente', async ({ page }) => {
    await page.goto('/ml-lab');
    await page.getByRole('button', { name: 'Com picos' }).click();
    await expect(page.getByRole('button', { name: 'Com picos' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Gerar outra amostra' }).click();
    await expect(page.getByText('Previsão x realidade')).toBeVisible();
  });

  test('classificador responde a uma descrição', async ({ page }) => {
    await page.goto('/ml-lab');
    await page.getByRole('tab', { name: 'Classificador de gastos' }).click();
    await expect(page.getByText('Categoria prevista')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Descrição do gasto').fill('Netflix.com');
    await expect(page.getByText('Assinatura').first()).toBeVisible();
  });

  test('tela de login tem o link para a demonstração', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /demonstração dos modelos de ML/ }).click();
    await expect(page).toHaveURL(/\/ml-lab$/);
  });
});
