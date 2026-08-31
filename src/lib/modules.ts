// src/lib/modules.ts — migrado de Supabase/Postgres pra Firebase/Firestore
// Cache em memória para getActiveModuleIds mantido igual ao original.
import { collection, doc, getDocs, setDoc, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';

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

function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  return user.uid;
}
function userCol(name: string) {
  return collection(db, 'users', uid(), name);
}
function userDoc(name: string, id: string) {
  return doc(db, 'users', uid(), name, id);
}

/** Invalida o cache (chamar após activate/deactivate). */
export function invalidateModuleCache(): void {
  _moduleCache = null;
  _moduleCacheExpiry = 0;
}

export async function getActiveModuleIds(): Promise<string[]> {
  if (_moduleCache && Date.now() < _moduleCacheExpiry) {
    return _moduleCache;
  }
  try {
    const snap = await getDocs(query(userCol('moduleSettings'), where('active', '==', true)));
    // O id do módulo é o próprio id do documento (users/{uid}/moduleSettings/{moduleId})
    _moduleCache = snap.docs.map((d) => d.id);
    _moduleCacheExpiry = Date.now() + MODULE_CACHE_TTL;
    return _moduleCache;
  } catch (err) {
    console.error('getActiveModuleIds:', err);
    return [];
  }
}

export async function activateModule(moduleId: string): Promise<void> {
  await setDoc(userDoc('moduleSettings', moduleId), { active: true }, { merge: true });
  invalidateModuleCache();
}

export async function deactivateModule(moduleId: string): Promise<void> {
  await setDoc(userDoc('moduleSettings', moduleId), { active: false }, { merge: true });
  invalidateModuleCache();
}
