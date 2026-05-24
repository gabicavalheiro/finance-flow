/**
 * customCategories.ts — CORRIGIDO (segurança)
 *
 * Problema original: usava localStorage como fallback, o que significa que
 * as categorias personalizadas do Usuário A ficavam salvas no navegador e
 * eram lidas quando o Usuário B fazia login no mesmo dispositivo.
 *
 * Solução: localStorage removido completamente. Se o Supabase falhar,
 * retorna array vazio — nada vaza entre usuários.
 *
 * Também: logout limpa o cache em memória (via onAuthStateChange no store.ts).
 */

import { supabase } from './supabase';
import { CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG, ExpenseCategory } from '@/lib/types';

export interface CustomCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  categoryType: 'expense' | 'income' | 'both';
}

// Cache em memória — populado async, usado sync em resolveCategoryInfo
// É limpo automaticamente no logout via queryCache.invalidateAll() no store.ts
let _cache: CustomCategory[] | null = null;

function fromRow(r: Record<string, unknown>): CustomCategory {
  return {
    id:           r.id            as string,
    label:        r.label         as string,
    icon:         r.icon          as string,
    color:        r.color         as string,
    categoryType: r.category_type as CustomCategory['categoryType'],
  };
}

export async function getCustomCategories(): Promise<CustomCategory[]> {
  if (_cache !== null) return _cache;

  try {
    const { data, error } = await supabase
      .from('custom_categories')
      .select('*')
      .order('created_at');

    if (!error && data) {
      _cache = data.map(fromRow);
      return _cache;
    }
  } catch {
    // falha silenciosa — sem localStorage como fallback
  }

  _cache = [];
  return [];
}

export async function saveCustomCategory(cat: CustomCategory): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { error } = await supabase.from('custom_categories').insert({
    id:            cat.id,
    user_id:       user.id,
    label:         cat.label,
    icon:          cat.icon,
    color:         cat.color,
    category_type: cat.categoryType,
  });

  if (error) throw error;

  _cache = null; // invalida cache para forçar re-fetch
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('custom_categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
  _cache = null;
}

export async function getCustomCategoriesForType(
  type: 'expense' | 'income',
): Promise<CustomCategory[]> {
  const all = await getCustomCategories();
  return all.filter(c => c.categoryType === 'both' || c.categoryType === type);
}

/** Invalida o cache — chamar no logout */
export function clearCustomCategoryCache(): void {
  _cache = null;
}

/**
 * Sync — usa o cache em memória.
 * Só funciona após pelo menos um `await getCustomCategories()`.
 */
export function findCustomCategory(id: string): CustomCategory | undefined {
  return (_cache ?? []).find(c => c.id === id);
}

export function isCustomCategory(id: string): boolean {
  return id.startsWith('custom_');
}

/**
 * Resolve label + cor de qualquer chave de categoria (padrão ou custom).
 */
export function resolveCategoryInfo(key: string): {
  label: string;
  color: string;
  icon?: string;
} {
  const expense = CATEGORY_CONFIG[key as ExpenseCategory];
  if (expense) return { label: expense.label, color: expense.color, icon: expense.icon };

  const income = INCOME_CATEGORY_CONFIG[key as keyof typeof INCOME_CATEGORY_CONFIG];
  if (income) return { label: income.label, color: income.color, icon: income.icon };

  const custom = findCustomCategory(key);
  if (custom) return { label: custom.label, color: custom.color, icon: custom.icon };

  return { label: 'Outros', color: '240 5% 55%' };
}