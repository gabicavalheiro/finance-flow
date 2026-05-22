/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/subscriptions.ts
import { supabase } from './supabase';
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

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function uid(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

function dbToSub(r: any): Subscription {
  return {
    id:           r.id,
    name:         r.name,
    amount:       r.amount,
    billingCycle: (r.billing_cycle ?? 'monthly') as BillingCycle,
    billingDay:   r.billing_day ?? 1,
    category:     r.category ?? 'other',
    active:       r.active ?? true,
    paidMonths:   r.paid_months ?? [],
    cardId:       r.card_id   ?? undefined,
    icon:         r.icon      ?? undefined,
    color:        r.color     ?? undefined,
    url:          r.url       ?? undefined,
    notes:        r.notes     ?? undefined,
  };
}

function subToDb(s: Subscription, userId: string) {
  return {
    id:            s.id,
    user_id:       userId,
    name:          s.name,
    amount:        s.amount,
    billing_cycle: s.billingCycle,
    billing_day:   s.billingDay,
    category:      s.category,
    active:        s.active,
    paid_months:   s.paidMonths,
    card_id:       s.cardId ?? null,
    icon:          s.icon   ?? null,
    color:         s.color  ?? null,
    url:           s.url    ?? null,
    notes:         s.notes  ?? null,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at');
  if (error) { console.error('getSubscriptions:', error); return []; }
  return (data ?? []).map(dbToSub);
}

export async function addSubscription(sub: Subscription): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('subscriptions').insert(subToDb(sub, userId));
  if (error) throw error;
}

export async function updateSubscription(sub: Subscription): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('subscriptions')
    .update(subToDb(sub, userId))
    .eq('id', sub.id);
  if (error) throw error;
}

export async function deleteSubscription(id: string): Promise<void> {
  const { error } = await supabase.from('subscriptions').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleSubscriptionPaid(
  sub: Subscription,
  month: string,
): Promise<void> {
  const already = sub.paidMonths.includes(month);
  const newPaid = already
    ? sub.paidMonths.filter(m => m !== month)
    : [...sub.paidMonths, month];
  const { error } = await supabase
    .from('subscriptions')
    .update({ paid_months: newPaid })
    .eq('id', sub.id);
  if (error) throw error;
}

export async function toggleSubscriptionActive(
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ active })
    .eq('id', id);
  if (error) throw error;
}