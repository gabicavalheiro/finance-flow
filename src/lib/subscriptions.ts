// src/lib/subscriptions.ts — migrado de Supabase/Postgres pra Firebase/Firestore
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { MonthlyInstallment, ExpenseCategory } from './types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type BillingCycle = 'monthly' | 'annual';

export const SUBSCRIPTION_CATEGORIES = [
  { value: 'streaming',  label: 'Streaming',      emoji: '🎬' },
  { value: 'music',      label: 'Música',          emoji: '🎵' },
  { value: 'cloud',      label: 'Armazenamento',   emoji: '☁️' },
  { value: 'software',   label: 'Software',        emoji: '💻' },
  { value: 'gaming',     label: 'Games',           emoji: '🎮' },
  { value: 'news',       label: 'Notícias',        emoji: '📰' },
  { value: 'fitness',    label: 'Saúde / Fitness', emoji: '🏋️' },
  { value: 'education',  label: 'Educação',        emoji: '📚' },
  { value: 'security',   label: 'Segurança',       emoji: '🔒' },
  { value: 'other',      label: 'Outros',          emoji: '📦' },
] as const;

export type SubscriptionCategory = typeof SUBSCRIPTION_CATEGORIES[number]['value'];

export interface Subscription {
  id:           string;
  name:         string;
  amount:       number;
  billingCycle: BillingCycle;
  billingDay:   number;
  category:     string;
  active:       boolean;
  paidMonths:   string[];
  cardId?:      string;
  icon?:        string;
  color?:       string;
  url?:         string;
  notes?:       string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna o custo mensal equivalente. Anual ÷ 12. */
export function monthlyAmount(s: Subscription): number {
  return s.billingCycle === 'annual' ? s.amount / 12 : s.amount;
}

/**
 * Converte assinaturas vinculadas a cartão em MonthlyInstallment[],
 * para serem incluídas nos totais de cartão em todo o app.
 */
export function subscriptionsAsInstallments(
  subscriptions: Subscription[],
  month: string,
): MonthlyInstallment[] {
  return subscriptions
    .filter(s => s.active && !!s.cardId)
    .map(s => ({
      expenseId:         s.id,
      expenseName:       `${s.name} (assinatura)`,
      cardId:            s.cardId!,
      amount:            monthlyAmount(s),
      installmentNumber: 1,
      totalInstallments: 1,
      category:          (s.category ?? 'subscription') as ExpenseCategory,
      month,
    }));
}

// ─── Firestore ────────────────────────────────────────────────────────────────

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
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const clean = { ...obj };
  (Object.keys(clean) as Array<keyof T>).forEach((k) => { if (clean[k] === undefined) delete clean[k]; });
  return clean;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getSubscriptions(): Promise<Subscription[]> {
  try {
    const snap = await getDocs(query(userCol('subscriptions'), orderBy('createdAt')));
    return snap.docs.map(d => d.data() as Subscription);
  } catch (err) {
    console.error('getSubscriptions:', err);
    return [];
  }
}

export async function addSubscription(sub: Subscription): Promise<void> {
  await setDoc(userDoc('subscriptions', sub.id), { ...stripUndefined(sub), createdAt: serverTimestamp() });
}

export async function updateSubscription(sub: Subscription): Promise<void> {
  await setDoc(userDoc('subscriptions', sub.id), stripUndefined(sub), { merge: true });
}

export async function deleteSubscription(id: string): Promise<void> {
  await deleteDoc(userDoc('subscriptions', id));
}

export async function toggleSubscriptionPaid(
  sub: Subscription,
  month: string,
): Promise<void> {
  const already = sub.paidMonths.includes(month);
  const newPaid = already
    ? sub.paidMonths.filter(m => m !== month)
    : [...sub.paidMonths, month];
  await updateDoc(userDoc('subscriptions', sub.id), { paidMonths: newPaid });
}

export async function toggleSubscriptionActive(
  id: string,
  active: boolean,
): Promise<void> {
  await updateDoc(userDoc('subscriptions', id), { active });
}
