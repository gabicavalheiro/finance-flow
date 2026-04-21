import { supabase } from './supabase';

export interface CustomCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  categoryType: 'expense' | 'income' | 'both';
}

async function uid(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

function dbToCustomCategory(r: any): CustomCategory {
  return {
    id: r.id,
    label: r.label,
    icon: r.icon,
    color: r.color,
    categoryType: r.category_type,
  };
}

export async function getCustomCategories(): Promise<CustomCategory[]> {
  const { data, error } = await supabase
    .from('custom_categories')
    .select('*')
    .order('created_at');
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToCustomCategory);
}

export async function getCustomCategoriesForType(
  type: 'expense' | 'income'
): Promise<CustomCategory[]> {
  const { data, error } = await supabase
    .from('custom_categories')
    .select('*')
    .or(`category_type.eq.${type},category_type.eq.both`)
    .order('created_at');
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToCustomCategory);
}

export async function saveCustomCategory(cat: CustomCategory): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('custom_categories').insert({
    id: cat.id,
    user_id: userId,
    label: cat.label,
    icon: cat.icon,
    color: cat.color,
    category_type: cat.categoryType,
  });
  if (error) throw error;
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const { error } = await supabase.from('custom_categories').delete().eq('id', id);
  if (error) throw error;
}

export function isCustomCategory(id: string): boolean {
  return id.startsWith('custom_');
}
