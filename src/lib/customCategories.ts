import { CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG, ExpenseCategory } from '@/lib/types';

export interface CustomCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  categoryType: 'expense' | 'income' | 'both';
}

const KEY = 'finapp_custom_categories';

export function getCustomCategories(): CustomCategory[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveCustomCategory(cat: CustomCategory): void {
  const all = getCustomCategories();
  all.push(cat);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteCustomCategory(id: string): void {
  const all = getCustomCategories().filter(c => c.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getCustomCategoriesForType(type: 'expense' | 'income'): CustomCategory[] {
  return getCustomCategories().filter(
    c => c.categoryType === 'both' || c.categoryType === type
  );
}

export function findCustomCategory(id: string): CustomCategory | undefined {
  return getCustomCategories().find(c => c.id === id);
}

export function isCustomCategory(id: string): boolean {
  return id.startsWith('custom_');
}

/**
 * Resolve o label e a cor de qualquer chave de categoria —
 * funciona tanto para categorias padrão quanto para customizadas.
 */
export function resolveCategoryInfo(key: string): { label: string; color: string; icon?: string } {
  // 1. Tenta nas categorias de gasto padrão
  const expense = CATEGORY_CONFIG[key as ExpenseCategory];
  if (expense) return { label: expense.label, color: expense.color, icon: expense.icon };

  // 2. Tenta nas categorias de ganho padrão
  const income = INCOME_CATEGORY_CONFIG[key as keyof typeof INCOME_CATEGORY_CONFIG];
  if (income) return { label: income.label, color: income.color, icon: income.icon };

  // 3. Busca nas categorias customizadas do localStorage
  const custom = findCustomCategory(key);
  if (custom) return { label: custom.label, color: custom.color, icon: custom.icon };

  // 4. Fallback: exibe a chave crua (nunca deve chegar aqui)
  return { label: key, color: '240 5% 55%' };
}