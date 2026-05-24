/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/modules.ts — OTIMIZADO: cache em memória para getActiveModuleIds
import { supabase } from './supabase';

async function uid(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

export interface AppModule {
  id: string;
  label: string;
  description: string;
  icon: string;
  path: string;
  accentColor: string;
  priceLabel?: string;
}

export const AVAILABLE_MODULES: AppModule[] = [
  {
    id: 'subscriptions',
    label: 'Assinaturas',
    description: 'Gerencie suas assinaturas recorrentes (Netflix, Spotify, iCloud…). Elas aparecem automaticamente todo mês nos seus gastos.',
    icon: 'Repeat2',
    path: '/subscriptions',
    accentColor: '262 83% 65%',
    priceLabel: 'Módulo adicional',
  },
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

// ─── Cache de módulos ativos ──────────────────────────────────────────────────
let _moduleCache: string[] | null = null;
let _moduleCacheExpiry = 0;
const MODULE_CACHE_TTL = 5 * 60_000; // 5 minutos

/** Invalida o cache (chamar após activate/deactivate). */
export function invalidateModuleCache(): void {
  _moduleCache = null;
  _moduleCacheExpiry = 0;
}

export async function getActiveModuleIds(): Promise<string[]> {
  if (_moduleCache && Date.now() < _moduleCacheExpiry) {
    return _moduleCache;
  }
  const { data, error } = await supabase
    .from('user_module_settings')
    .select('module_id')
    .eq('active', true);
  if (error) { console.error('getActiveModuleIds:', error); return []; }
  _moduleCache = (data ?? []).map((r: any) => r.module_id as string);
  _moduleCacheExpiry = Date.now() + MODULE_CACHE_TTL;
  return _moduleCache;
}

export async function activateModule(moduleId: string): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('user_module_settings')
    .upsert(
      { user_id: userId, module_id: moduleId, active: true },
      { onConflict: 'user_id,module_id' },
    );
  if (error) throw error;
  invalidateModuleCache();
}

export async function deactivateModule(moduleId: string): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('user_module_settings')
    .upsert(
      { user_id: userId, module_id: moduleId, active: false },
      { onConflict: 'user_id,module_id' },
    );
  if (error) throw error;
  invalidateModuleCache();
}