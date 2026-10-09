// src/lib/preferences.ts — preferências do usuário: organização da tela inicial e avisos.
//
// Guardadas no aparelho (localStorage, aplica na hora) e sincronizadas com o Firestore
// (users/{uid}/settings/preferences) para valer em qualquer dispositivo. Se o Firestore
// falhar, o app continua funcionando só com a cópia local.

import { useSyncExternalStore } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// ── Seções da tela inicial ────────────────────────────────────────────────────
export type HomeSectionId = 'summary' | 'cards' | 'goals' | 'checklist' | 'categories' | 'transactions';

export const HOME_SECTIONS: { id: HomeSectionId; label: string; description: string }[] = [
  { id: 'summary',      label: 'Resumo do mês',        description: 'Saldo, pendente a pagar e a receber' },
  { id: 'cards',        label: 'Cartões',              description: 'Carrossel com o gasto de cada cartão' },
  { id: 'goals',        label: 'Metas',                description: 'Progresso das suas metas (se o módulo estiver ativo)' },
  { id: 'checklist',    label: 'Checklist do mês',     description: 'Contas a pagar e ganhos a receber' },
  { id: 'categories',   label: 'Gastos por categoria', description: 'Gráfico de categorias' },
  { id: 'transactions', label: 'Lançamentos',          description: 'Lista de gastos e ganhos do mês' },
];

// ── Avisos ────────────────────────────────────────────────────────────────────
export interface AlertPrefs {
  /** Janela "Avisos do dia" ao abrir Faturas ou trocar de mês. Desligada = nenhum aviso. */
  daily: boolean;
  dueDates: boolean;   // fatura vencendo hoje ou nos próximos dias
  cashflow: boolean;   // saldo negativo previsto antes do próximo recebimento
  balance: boolean;    // balanço do mês (déficit ou saudável)
  incomes: boolean;    // recebimentos de hoje e dos próximos dias
  nextMonth: boolean;  // prévia do mês seguinte
}

export interface Preferences {
  homeOrder: HomeSectionId[];
  homeHidden: HomeSectionId[];
  /** Resumo e orçamentos na lateral da tela inicial */
  showSidebar: boolean;
  alerts: AlertPrefs;
  /** Textos explicativos (dicas) nas telas */
  hints: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  homeOrder: HOME_SECTIONS.map(s => s.id),
  homeHidden: [],
  showSidebar: true,
  alerts: { daily: true, dueDates: true, cashflow: true, balance: true, incomes: true, nextMonth: true },
  hints: true,
};

const IDS = new Set<string>(HOME_SECTIONS.map(s => s.id));

/** Completa o que faltar com os padrões e remove o que não existe mais. */
export function normalizePreferences(raw: unknown): Preferences {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Preferences>;
  const order = Array.isArray(r.homeOrder) ? r.homeOrder.filter((id, i, a) => IDS.has(id) && a.indexOf(id) === i) : [];
  for (const s of HOME_SECTIONS) if (!order.includes(s.id)) order.push(s.id); // seção nova entra no fim
  const hidden = Array.isArray(r.homeHidden) ? r.homeHidden.filter((id, i, a) => IDS.has(id) && a.indexOf(id) === i) : [];
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const a = (r.alerts ?? {}) as Partial<AlertPrefs>;
  const d = DEFAULT_PREFERENCES.alerts;
  return {
    homeOrder: order as HomeSectionId[],
    homeHidden: hidden as HomeSectionId[],
    showSidebar: bool(r.showSidebar, true),
    hints: bool(r.hints, true),
    alerts: {
      daily: bool(a.daily, d.daily), dueDates: bool(a.dueDates, d.dueDates), cashflow: bool(a.cashflow, d.cashflow),
      balance: bool(a.balance, d.balance), incomes: bool(a.incomes, d.incomes), nextMonth: bool(a.nextMonth, d.nextMonth),
    },
  };
}

/** Move um item uma posição para cima (-1) ou para baixo (+1). */
export function moveSection(order: HomeSectionId[], id: HomeSectionId, dir: -1 | 1): HomeSectionId[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Seções que aparecem na tela inicial, na ordem escolhida. */
export function visibleSections(p: Preferences): HomeSectionId[] {
  return p.homeOrder.filter(id => !p.homeHidden.includes(id));
}

/** A qual grupo de aviso um alerta do "Avisos do dia" pertence (pelo id dele). */
export function alertAllowed(alertId: string, a: AlertPrefs): boolean {
  if (!a.daily) return false;
  if (alertId.startsWith('card-')) return a.dueDates;
  if (alertId.startsWith('cashflow-')) return a.cashflow;
  if (alertId.startsWith('balance-')) return a.balance;
  if (alertId.startsWith('inc-')) return a.incomes;
  if (alertId.startsWith('next-')) return a.nextMonth;
  return true;
}

// ── Armazenamento ─────────────────────────────────────────────────────────────
const LS_KEY = 'ff-preferences';
const listeners = new Set<() => void>();

function readLocal(): Preferences {
  try {
    const s = localStorage.getItem(LS_KEY);
    return normalizePreferences(s ? JSON.parse(s) : null);
  } catch { return DEFAULT_PREFERENCES; }
}

let current: Preferences = readLocal();
let loadedFor: string | null = null;

function emit() { listeners.forEach(l => l()); }

function writeLocal(p: Preferences) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* localStorage indisponível */ }
}

function prefDoc() {
  const user = auth.currentUser;
  if (!user) return null;
  return doc(db, 'users', user.uid, 'settings', 'preferences');
}

/** Busca as preferências salvas na conta (uma vez por usuário) e aplica. */
export async function loadPreferences(): Promise<void> {
  const ref = prefDoc();
  const uid = auth.currentUser?.uid ?? null;
  if (!ref || loadedFor === uid) return;
  loadedFor = uid;
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      current = normalizePreferences(snap.data());
      writeLocal(current);
      emit();
    } else {
      await setDoc(ref, current); // primeira vez: leva para a conta o que já estava neste aparelho
    }
  } catch (err) {
    console.warn('preferências: usando só a cópia local —', err);
  }
}

export function getPreferences(): Preferences { return current; }

/** Atualiza (parcialmente) as preferências: vale na hora e é salvo na conta. */
export async function updatePreferences(patch: Partial<Preferences> | ((p: Preferences) => Partial<Preferences>)): Promise<void> {
  const part = typeof patch === 'function' ? patch(current) : patch;
  current = normalizePreferences({ ...current, ...part, alerts: { ...current.alerts, ...(part.alerts ?? {}) } });
  writeLocal(current);
  emit();
  const ref = prefDoc();
  if (!ref) return;
  try { await setDoc(ref, current); }
  catch (err) { console.warn('preferências: não consegui salvar na conta —', err); }
}

export async function resetPreferences(): Promise<void> {
  current = DEFAULT_PREFERENCES;
  writeLocal(current);
  emit();
  const ref = prefDoc();
  if (!ref) return;
  try { await setDoc(ref, current); } catch { /* best-effort */ }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Preferências atuais; re-renderiza quando mudam. */
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, getPreferences);
}
