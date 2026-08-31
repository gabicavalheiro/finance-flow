/**
 * customCategories.ts — migrado de Supabase/Postgres pra Firebase/Firestore
 *
 * Continua sem localStorage como fallback — se o Firestore falhar, retorna
 * array vazio, nada vaza entre usuários. Cache em memória limpo no logout
 * via clearCustomCategoryCache() (chamado a partir do listener de auth).
 */

import { collection, doc, getDocs, setDoc, deleteDoc, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { CATEGORY_CONFIG, INCOME_CATEGORY_CONFIG, ExpenseCategory } from '@/lib/types';

export interface CustomCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  categoryType: 'expense' | 'income' | 'both';
}

// Cache em memória — populado async, usado sync em resolveCategoryInfo
let _cache: CustomCategory[] | null = null;

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

export async function getCustomCategories(): Promise<CustomCategory[]> {
  if (_cache !== null) return _cache;

  try {
    const snap = await getDocs(query(userCol('customCategories'), orderBy('createdAt')));
    _cache = snap.docs.map(d => d.data() as CustomCategory);
    return _cache;
  } catch {
    // falha silenciosa — sem localStorage como fallback
  }

  _cache = [];
  return [];
}

export async function saveCustomCategory(cat: CustomCategory): Promise<void> {
  if (!auth.currentUser) throw new Error('Não autenticado');
  await setDoc(userDoc('customCategories', cat.id), { ...cat, createdAt: serverTimestamp() });
  _cache = null; // invalida cache para forçar re-fetch
}

export async function deleteCustomCategory(id: string): Promise<void> {
  await deleteDoc(userDoc('customCategories', id));
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
