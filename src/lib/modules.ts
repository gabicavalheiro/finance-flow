// src/lib/modules.ts — recursos do app, todos sempre disponíveis (sem ativação).
// A lista alimenta o menu principal. `getActiveModuleIds` é mantido por compatibilidade
// com o Dashboard e o contexto de dados: agora devolve todos os recursos.

export interface AppModule {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export const AVAILABLE_MODULES: AppModule[] = [
  { id: 'subscriptions',      label: 'Assinaturas',   icon: 'Repeat2',    path: '/subscriptions' },
  { id: 'goals',              label: 'Metas',         icon: 'Target',     path: '/goals' },
  { id: 'loans',              label: 'Empréstimos',   icon: 'Landmark',   path: '/loans' },
  { id: 'investments',        label: 'Investimentos', icon: 'TrendingUp', path: '/investments' },
  { id: 'expense-classifier', label: 'Classificador', icon: 'Tags',       path: '/classifier' },
  { id: 'intelligence',       label: 'Inteligência',  icon: 'Brain',      path: '/inteligencia' },
];

export async function getActiveModuleIds(): Promise<string[]> {
  return AVAILABLE_MODULES.map((m) => m.id);
}
