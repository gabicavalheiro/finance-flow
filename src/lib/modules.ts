/* eslint-disable @typescript-eslint/no-explicit-any */
// ─── Módulos opcionais — estado persistido no Supabase ───────────────────────
// Tabela: user_module_settings  (user_id, module_id, active)
// SQL de criação em: schema_modules.sql

import { supabase } from './supabase';

async function uid(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

// ─── Definição dos módulos disponíveis ───────────────────────────────────────
export interface AppModule {
  id: string;
  label: string;
  description: string;
  icon: string;        // nome do ícone Lucide
  path: string;
  accentColor: string; // HSL sem hsl(), ex: '25 95% 53%'
  priceLabel?: string;
}

export const AVAILABLE_MODULES: AppModule[] = [
  {
    id: 'goals',
    label: 'Metas',
    description: 'Defina objetivos financeiros e veja exatamente quanto economizar por mês para realizá-los. Integrado ao dashboard.',
    icon: 'Target',
    path: '/goals',
    accentColor: '217 91% 60%',
    priceLabel: 'Módulo adicional',
  },
  {
    id: 'loans',
    label: 'Empréstimos',
    description: 'Controle seus empréstimos, parcelas e juros de forma simples.',
    icon: 'Landmark',
    path: '/loans',
    accentColor: '25 95% 53%',
    priceLabel: 'Módulo adicional',
  },
  {
    id: 'investments',
    label: 'Investimentos',
    description: 'Acompanhe seus investimentos, rentabilidade e patrimônio.',
    icon: 'TrendingUp',
    path: '/investments',
    accentColor: '152 69% 45%',
    priceLabel: 'Módulo adicional',
  },
];

// ─── CRUD Supabase ────────────────────────────────────────────────────────────

/** Retorna os IDs dos módulos ativos para o usuário logado. */
export async function getActiveModuleIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_module_settings')
    .select('module_id')
    .eq('active', true);

  if (error) { console.error('getActiveModuleIds:', error); return []; }
  return (data ?? []).map((r: any) => r.module_id as string);
}

/** Ativa um módulo para o usuário logado (upsert). */
export async function activateModule(moduleId: string): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('user_module_settings')
    .upsert(
      { user_id: userId, module_id: moduleId, active: true },
      { onConflict: 'user_id,module_id' },
    );
  if (error) throw error;
}

/** Desativa um módulo para o usuário logado (upsert). */
export async function deactivateModule(moduleId: string): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('user_module_settings')
    .upsert(
      { user_id: userId, module_id: moduleId, active: false },
      { onConflict: 'user_id,module_id' },
    );
  if (error) throw error;
}