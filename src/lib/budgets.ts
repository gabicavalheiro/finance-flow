// src/lib/budgets.ts
import { supabase } from './supabase';

export interface Budget {
  category: string;
  amount: number;
}

async function uid(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

/** Busca todos os orçamentos do usuário */
export async function getBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('category, amount')
    .order('category');
  if (error) { console.error(error); return []; }
  return (data ?? []) as Budget[];
}

/** Salva (upsert) um orçamento por categoria */
export async function upsertBudget(category: string, amount: number): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('budgets').upsert(
    {
      id:       `${userId}_${category}`,
      user_id:  userId,
      category,
      amount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,category' },
  );
  if (error) throw error;
}

/** Remove um orçamento de uma categoria */
export async function deleteBudget(category: string): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', userId)
    .eq('category', category);
  if (error) throw error;
}
