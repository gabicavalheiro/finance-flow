import { test, expect } from '@playwright/test';

test.describe('autenticação (sem login)', () => {
  test('visitante é levado à tela de login', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar/ }).first()).toBeVisible();
  });

  test('alterna entre entrar, criar conta e recuperar senha', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Criar conta' }).first().click();
    await expect(page.getByPlaceholder('Seu nome')).toBeVisible();
    await expect(page.getByPlaceholder('Repita a senha')).toBeVisible();
    await page.getByRole('button', { name: 'Entrar' }).first().click();
    await expect(page.getByPlaceholder('Seu nome')).toHaveCount(0);
  });

  test('credenciais inválidas não entram no app', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('seu@email.com').fill('nao-existe@example.com');
    await page.getByPlaceholder('••••••••').fill('senha-errada-123');
    await page.getByRole('button', { name: /Entrar/ }).last().click();
    // continua na tela de login
    await expect(page.getByPlaceholder('seu@email.com')).toBeVisible();
  });
});
