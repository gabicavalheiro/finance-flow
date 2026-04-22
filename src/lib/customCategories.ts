import { supabase } from './supabase';
import { CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG, ExpenseCategory } from '@/lib/types';

export interface CustomCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  categoryType: 'expense' | 'income' | 'both';
}

const LOCAL_KEY = 'finapp_custom_categories';

// Cache em memória — populado async, usado sync em resolveCategoryInfo
let _cache: CustomCategory[] | null = null;

function fromRow(r: Record<string, unknown>): CustomCategory {
  return {
    id:           r.id           as string,
    label:        r.label        as string,
    icon:         r.icon         as string,
    color:        r.color        as string,
    categoryType: r.category_type as CustomCategory['categoryType'],
  };
}

export async function getCustomCategories(): Promise<CustomCategory[]> {
  try {
    const { data, error } = await supabase
      .from('custom_categories')
      .select('*')
      .order('created_at');

    if (!error && data) {
      _cache = data.map(fromRow);
      return _cache;
    }
  } catch { /* segue para fallback */ }

  // fallback: localStorage (dados criados antes da migração)
  try {
    const local: CustomCategory[] = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
    _cache = local;
    return local;
  } catch {
    _cache = [];
    return [];
  }
}

export async function saveCustomCategory(cat: CustomCategory): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from('custom_categories').insert({
    id:            cat.id,
    user_id:       user.id,
    label:         cat.label,
    icon:          cat.icon,
    color:         cat.color,
    category_type: cat.categoryType,
  });

  if (error) {
    // fallback para localStorage se a tabela ainda não existir
    const all: CustomCategory[] = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
    all.push(cat);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  }

  _cache = null; // invalida cache para forçar re-fetch
}

export async function deleteCustomCategory(id: string): Promise<void> {
  await supabase.from('custom_categories').delete().eq('id', id);
  // remove do localStorage também (compatibilidade)
  try {
    const all: CustomCategory[] = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all.filter(c => c.id !== id)));
  } catch { /* ignora */ }
  _cache = null;
}

export async function getCustomCategoriesForType(type: 'expense' | 'income'): Promise<CustomCategory[]> {
  const all = await getCustomCategories();
  return all.filter(c => c.categoryType === 'both' || c.categoryType === type);
}

/**
 * Sync — usa o cache em memória. Só funciona após pelo menos um
 * `await getCustomCategories()` (feito automaticamente pelo context).
 */
export function findCustomCategory(id: string): CustomCategory | undefined {
  return (_cache ?? []).find(c => c.id === id);
}

export function isCustomCategory(id: string): boolean {
  return id.startsWith('custom_');
}

/**
 * Resolve label + cor de qualquer chave de categoria (padrão ou custom).
 * Usa o cache em memória populado pelo CustomCategoryContext na inicialização.
 */
export function resolveCategoryInfo(key: string): { label: string; color: string; icon?: string } {
  const expense = CATEGORY_CONFIG[key as ExpenseCategory];
  if (expense) return { label: expense.label, color: expense.color, icon: expense.icon };

  const income = INCOME_CATEGORY_CONFIG[key as keyof typeof INCOME_CATEGORY_CONFIG];
  if (income) return { label: income.label, color: income.color, icon: income.icon };

  const custom = findCustomCategory(key);
  if (custom) return { label: custom.label, color: custom.color, icon: custom.icon };

  return { label: 'Outros', color: '240 5% 55%' };
}