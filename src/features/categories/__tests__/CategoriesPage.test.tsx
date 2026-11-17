import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { CustomCategory } from '@/lib/customCategories';
import type { CategoryData, MergePlan } from '../logic';

const customs: CustomCategory[] = [
  { id: 'custom_merc', label: 'Mercado', icon: 'ShoppingBag', color: '30 90% 55%', categoryType: 'expense' },
  { id: 'custom_super', label: 'Supermercado', icon: 'ShoppingBag', color: '30 90% 55%', categoryType: 'expense' },
  { id: 'custom_pet', label: 'Pet', icon: 'Dog', color: '45 90% 50%', categoryType: 'expense' },
];

const data: CategoryData = {
  expenses: [
    { id: 'e1', category: 'custom_merc' as never },
    { id: 'e2', category: 'custom_merc' as never },
    { id: 'e3', category: 'custom_apagada' as never },
  ],
  fixedExpenses: [{ id: 'f1', category: 'custom_super' as never }],
  fixedIncomes: [],
  variable: [],
  budgets: [{ category: 'custom_merc', amount: 400 }],
};

const applyMergePlan = vi.fn(async (plan: MergePlan) => plan.updates.length);
const deleteCustomCategory = vi.fn(async () => {});

vi.mock('@/lib/categoryAdmin', () => ({
  loadCategoryData: vi.fn(async () => data),
  applyMergePlan: (plan: MergePlan) => applyMergePlan(plan),
  updateCustomCategory: vi.fn(),
}));
vi.mock('@/lib/customCategories', () => ({
  isCustomCategory: (id: string) => id.startsWith('custom_'),
  deleteCustomCategory: () => deleteCustomCategory(),
  saveCustomCategory: vi.fn(),
}));
vi.mock('@/contexts/CustomCategoryContext', () => ({
  useCustomCategories: () => ({
    customCategories: customs,
    reload: async () => {},
    findCustomCategory: (id: string) => customs.find(c => c.id === id),
  }),
}));
vi.mock('@/contexts/FinanceDataContext', () => ({ useFinanceData: () => ({ hardRefresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CategoriesPage from '@/pages/CategoriesPage';

describe('CategoriesPage', () => {
  beforeEach(() => {
    applyMergePlan.mockClear();
    deleteCustomCategory.mockClear();
    localStorage.clear();
  });

  it('lista categorias com uso, removidas e sugestão de duplicadas', async () => {
    render(<CategoriesPage />);
    expect(await screen.findByText('Suas categorias · 3')).toBeInTheDocument();
    expect(screen.getByText('2 lançamentos · orçamento R$ 400,00', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Categoria removida')).toBeInTheDocument();
    expect(screen.getByText('Parecem repetidas')).toBeInTheDocument();
    expect(screen.getByText('Mercado · Supermercado', { exact: false })).toBeInTheDocument();
  });

  it('unifica a partir da sugestão e manda o plano para gravação', async () => {
    render(<CategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unificar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1 lançamento vai/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unificar' }));

    await waitFor(() => expect(applyMergePlan).toHaveBeenCalledTimes(1));
    const plan = applyMergePlan.mock.calls[0][0];
    expect(plan.targetId).toBe('custom_merc');
    expect(plan.sourceIds).toEqual(['custom_super']);
    expect(plan.deleteCustomIds).toEqual(['custom_super']);
  });

  it('excluir categoria sem uso pede só confirmação; com uso pede destino', async () => {
    render(<CategoriesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir Pet' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(deleteCustomCategory).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Excluir Mercado' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Excluir "Mercado"')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Mover e excluir' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Alimentação/ }));
    expect(within(dialog).getByText(/Orçamentos somados/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Mover e excluir' })).toBeEnabled();
  });
});
