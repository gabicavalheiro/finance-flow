/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * store.ts — OTIMIZADO
 *
 * 1. uid() usa cache em memória — zero round-trips extras ao Supabase por mutação
 * 2. Todas as leituras passam pelo queryCache com TTL
 * 3. Cada mutação invalida apenas as chaves afetadas
 * 4. getVariableForMonth e getInvoicesForMonth têm cache por chave de mês
 * 5. getInvoicesForMonthRange: 1 query batch para múltiplos meses (histórico)
 */

import { supabase } from './supabase';
import { queryCache } from './queryCache';
import {
  CreditCard, Expense, FixedExpense, FixedIncome,
  MonthlyInstallment, VariableTransaction,
} from './types';

// ─── uid com cache ────────────────────────────────────────────────────────────
let _cachedUserId: string | null = null;

// Invalida o cache de userId quando a sessão muda (login/logout)
supabase.auth.onAuthStateChange((_, session) => {
  _cachedUserId = session?.user?.id ?? null;
  if (!session) queryCache.invalidateAll();
});

async function uid(): Promise<string> {
  if (_cachedUserId) return _cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  _cachedUserId = user.id;
  return _cachedUserId;
}

// ─── TTLs ─────────────────────────────────────────────────────────────────────
const TTL = {
  STATIC:  5 * 60_000, // 5 min — dados que mudam pouco (cards, gastos fixos, rendas)
  DYNAMIC: 60_000,     // 1 min — dados que mudam mais (variáveis, faturas)
};

// ─── Mappers ──────────────────────────────────────────────────────────────────
function dbToCard(r: any): CreditCard {
  return {
    id: r.id, name: r.name, brand: r.brand,
    lastDigits: r.last_digits, limit: r.limit,
    closingDay: r.closing_day,
    dueDay: r.due_day ?? r.closing_day + 7,
    customGradient: r.custom_gradient ?? undefined,
  };
}
function cardToDb(c: CreditCard, userId: string) {
  return {
    id: c.id, user_id: userId, name: c.name, brand: c.brand,
    last_digits: c.lastDigits, limit: c.limit,
    closing_day: c.closingDay, due_day: c.dueDay,
    custom_gradient: c.customGradient ?? null,
  };
}

function dbToExpense(r: any): Expense {
  return {
    id: r.id, cardId: r.card_id, name: r.name,
    totalAmount: r.total_amount, installments: r.installments,
    category: r.category, date: r.date,
  };
}
function expenseToDb(e: Expense, userId: string) {
  return {
    id: e.id, user_id: userId, card_id: e.cardId, name: e.name,
    total_amount: e.totalAmount, installments: e.installments,
    category: e.category, date: e.date,
  };
}

function dbToFixedExpense(r: any): FixedExpense {
  return {
    id: r.id, name: r.name, amount: r.amount, category: r.category,
    paidMonths: r.paid_months ?? [], paymentMethod: r.payment_method ?? 'pix',
  };
}
function fixedExpenseToDb(f: FixedExpense, userId: string) {
  return {
    id: f.id, user_id: userId, name: f.name, amount: f.amount,
    category: f.category, paid_months: f.paidMonths,
    payment_method: f.paymentMethod ?? 'pix',
  };
}

function dbToIncome(r: any): FixedIncome {
  return {
    id: r.id, name: r.name, amount: r.amount, category: r.category,
    receiveDay: r.receive_day ?? undefined, receivedMonths: r.received_months ?? [],
  };
}
function incomeToDb(i: FixedIncome, userId: string) {
  return {
    id: i.id, user_id: userId, name: i.name, amount: i.amount,
    category: i.category, receive_day: i.receiveDay ?? null,
    received_months: i.receivedMonths,
  };
}

function dbToVariable(r: any): VariableTransaction {
  return {
    id: r.id, name: r.name, amount: r.amount, type: r.type,
    paymentMethod: r.payment_method, category: r.category, date: r.date,
  };
}
function variableToDb(t: VariableTransaction, userId: string) {
  return {
    id: t.id, user_id: userId, name: t.name, amount: t.amount,
    type: t.type, payment_method: t.paymentMethod,
    category: t.category, date: t.date,
  };
}

// ─── Cards ────────────────────────────────────────────────────────────────────
export async function getCards(): Promise<CreditCard[]> {
  return queryCache.get('cards', async () => {
    const { data, error } = await supabase.from('cards').select('*').order('created_at');
    if (error) { console.error(error); return []; }
    return (data ?? []).map(dbToCard);
  }, TTL.STATIC);
}
export async function addCard(card: CreditCard): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('cards').insert(cardToDb(card, userId));
  if (error) throw error;
  queryCache.invalidate('cards');
}
export async function updateCard(card: CreditCard): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('cards').update(cardToDb(card, userId)).eq('id', card.id);
  if (error) throw error;
  queryCache.invalidate('cards');
}
export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id);
  if (error) throw error;
  queryCache.invalidate('cards');
  queryCache.invalidate('expenses');
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
export async function getExpenses(): Promise<Expense[]> {
  return queryCache.get('expenses', async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('created_at');
    if (error) { console.error(error); return []; }
    return (data ?? []).map(dbToExpense);
  }, TTL.STATIC);
}
export async function addExpense(expense: Expense): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('expenses').insert(expenseToDb(expense, userId));
  if (error) throw error;
  queryCache.invalidate('expenses');
}
export async function updateExpense(expense: Expense): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('expenses').update(expenseToDb(expense, userId)).eq('id', expense.id);
  if (error) throw error;
  queryCache.invalidate('expenses');
}
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
  queryCache.invalidate('expenses');
}

// ─── Fixed Expenses ───────────────────────────────────────────────────────────
export async function getFixedExpenses(): Promise<FixedExpense[]> {
  return queryCache.get('fixed_expenses', async () => {
    const { data, error } = await supabase.from('fixed_expenses').select('*').order('created_at');
    if (error) { console.error(error); return []; }
    return (data ?? []).map(dbToFixedExpense);
  }, TTL.STATIC);
}
export async function addFixedExpense(expense: FixedExpense): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('fixed_expenses').insert(fixedExpenseToDb(expense, userId));
  if (error) throw error;
  queryCache.invalidate('fixed_expenses');
}
export async function updateFixedExpense(id: string, fields: Partial<FixedExpense>): Promise<void> {
  const dbFields: any = {};
  if (fields.name          !== undefined) dbFields.name           = fields.name;
  if (fields.amount        !== undefined) dbFields.amount         = fields.amount;
  if (fields.category      !== undefined) dbFields.category       = fields.category;
  if (fields.paidMonths    !== undefined) dbFields.paid_months    = fields.paidMonths;
  if (fields.paymentMethod !== undefined) dbFields.payment_method = fields.paymentMethod;
  const { error } = await supabase.from('fixed_expenses').update(dbFields).eq('id', id);
  if (error) throw error;
  queryCache.invalidate('fixed_expenses');
}
export async function deleteFixedExpense(id: string): Promise<void> {
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
  if (error) throw error;
  queryCache.invalidate('fixed_expenses');
}

// ─── Fixed Incomes ────────────────────────────────────────────────────────────
export async function getIncomes(): Promise<FixedIncome[]> {
  return queryCache.get('fixed_incomes', async () => {
    const { data, error } = await supabase.from('fixed_incomes').select('*').order('created_at');
    if (error) { console.error(error); return []; }
    return (data ?? []).map(dbToIncome);
  }, TTL.STATIC);
}
export async function addIncome(income: FixedIncome): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('fixed_incomes').insert(incomeToDb(income, userId));
  if (error) throw error;
  queryCache.invalidate('fixed_incomes');
}
export async function updateIncome(id: string, fields: Partial<FixedIncome>): Promise<void> {
  const dbFields: any = {};
  if (fields.name           !== undefined) dbFields.name            = fields.name;
  if (fields.amount         !== undefined) dbFields.amount          = fields.amount;
  if (fields.category       !== undefined) dbFields.category        = fields.category;
  if (fields.receiveDay     !== undefined) dbFields.receive_day     = fields.receiveDay;
  if (fields.receivedMonths !== undefined) dbFields.received_months = fields.receivedMonths;
  const { error } = await supabase.from('fixed_incomes').update(dbFields).eq('id', id);
  if (error) throw error;
  queryCache.invalidate('fixed_incomes');
}
export async function deleteIncome(id: string): Promise<void> {
  const { error } = await supabase.from('fixed_incomes').delete().eq('id', id);
  if (error) throw error;
  queryCache.invalidate('fixed_incomes');
}

// ─── Variable Transactions ────────────────────────────────────────────────────
export async function getVariableTransactions(): Promise<VariableTransaction[]> {
  return queryCache.get('variable_all', async () => {
    const { data, error } = await supabase
      .from('variable_transactions').select('*').order('date', { ascending: false });
    if (error) { console.error(error); return []; }
    return (data ?? []).map(dbToVariable);
  }, TTL.DYNAMIC);
}

export async function getVariableForMonth(month: string): Promise<VariableTransaction[]> {
  return queryCache.get(`variable:${month}`, async () => {
    const { data, error } = await supabase
      .from('variable_transactions').select('*')
      .like('date', `${month}%`).order('date', { ascending: false });
    if (error) { console.error(error); return []; }
    return (data ?? []).map(dbToVariable);
  }, TTL.DYNAMIC);
}

export async function addVariableTransaction(tx: VariableTransaction): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('variable_transactions').insert(variableToDb(tx, userId));
  if (error) throw error;
  const month = tx.date.slice(0, 7);
  queryCache.invalidate(`variable:${month}`);
  queryCache.invalidate('variable_all');
}

export async function updateVariableTransaction(id: string, fields: Partial<VariableTransaction>): Promise<void> {
  const dbFields: any = {};
  if (fields.name          !== undefined) dbFields.name           = fields.name;
  if (fields.amount        !== undefined) dbFields.amount         = fields.amount;
  if (fields.type          !== undefined) dbFields.type           = fields.type;
  if (fields.paymentMethod !== undefined) dbFields.payment_method = fields.paymentMethod;
  if (fields.category      !== undefined) dbFields.category       = fields.category;
  if (fields.date          !== undefined) dbFields.date           = fields.date;
  const { error } = await supabase.from('variable_transactions').update(dbFields).eq('id', id);
  if (error) throw error;
  queryCache.invalidate('variable:*');
  queryCache.invalidate('variable_all');
}

export async function deleteVariableTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('variable_transactions').delete().eq('id', id);
  if (error) throw error;
  queryCache.invalidate('variable:*');
  queryCache.invalidate('variable_all');
}

// ─── Card Invoices ────────────────────────────────────────────────────────────
export interface CardInvoice {
  cardId:       string;
  month:        string;
  actualAmount: number;
  notes?:       string;
}

function dbToInvoice(r: any): CardInvoice {
  return {
    cardId:       r.card_id,
    month:        r.month,
    actualAmount: r.actual_amount,
    notes:        r.notes ?? undefined,
  };
}

export async function getInvoicesForMonth(month: string): Promise<CardInvoice[]> {
  return queryCache.get(`invoices:${month}`, async () => {
    const { data, error } = await supabase
      .from('card_invoices').select('*').eq('month', month);
    if (error) { console.error(error); return []; }
    return (data ?? []).map(dbToInvoice);
  }, TTL.DYNAMIC);
}

/**
 * Busca faturas de um intervalo de meses em UMA única query ao Supabase.
 * Aproveita entradas já em cache e só busca os meses ausentes.
 * Usado pelo histórico de FaturaPage para evitar N queries paralelas.
 */
export async function getInvoicesForMonthRange(
  months: string[],
): Promise<Record<string, CardInvoice[]>> {
  if (months.length === 0) return {};

  const result: Record<string, CardInvoice[]> = {};
  const missing: string[] = [];

  // Serve do cache o que já existe
  for (const m of months) {
    if (queryCache.has(`invoices:${m}`)) {
      result[m] = await queryCache.get<CardInvoice[]>(`invoices:${m}`, () => Promise.resolve([]), TTL.DYNAMIC);
    } else {
      missing.push(m);
    }
  }

  // Busca em batch apenas os meses que faltam
  if (missing.length > 0) {
    const { data, error } = await supabase
      .from('card_invoices')
      .select('*')
      .in('month', missing);

    const grouped: Record<string, CardInvoice[]> = {};
    for (const m of missing) grouped[m] = [];

    if (!error && data) {
      for (const row of data) {
        const m = row.month as string;
        if (!grouped[m]) grouped[m] = [];
        grouped[m].push(dbToInvoice(row));
      }
    }

    for (const m of missing) {
      result[m] = grouped[m];
      queryCache.set(`invoices:${m}`, grouped[m], TTL.DYNAMIC);
    }
  }

  return result;
}

export async function upsertInvoice(invoice: CardInvoice): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('card_invoices').upsert(
    {
      card_id:       invoice.cardId,
      user_id:       userId,
      month:         invoice.month,
      actual_amount: invoice.actualAmount,
      notes:         invoice.notes ?? null,
    },
    { onConflict: 'card_id,month' },
  );
  if (error) throw error;
  queryCache.invalidate(`invoices:${invoice.month}`);
}

// ─── Installments (computado, sem query) ─────────────────────────────────────
export function computeInstallmentsForMonth(
  expenses: Expense[],
  cards: CreditCard[],
  month: string,
): MonthlyInstallment[] {
  const result: MonthlyInstallment[] = [];

  for (const exp of expenses) {
    const [ey, em] = exp.date.split('-').map(Number);
    const card = cards.find(c => c.id === exp.cardId);
    if (!card) continue;

    let startYear  = ey;
    let startMonth = em;
    const expDay   = parseInt(exp.date.split('-')[2], 10);
    if (expDay > card.closingDay) {
      startMonth += 1;
      if (startMonth > 12) { startMonth = 1; startYear += 1; }
    }

    for (let i = 0; i < exp.installments; i++) {
      let instMonth = startMonth + i;
      let instYear  = startYear;
      while (instMonth > 12) { instMonth -= 12; instYear += 1; }
      const instMonthStr = `${instYear}-${String(instMonth).padStart(2, '0')}`;
      if (instMonthStr !== month) continue;

      result.push({
        expenseId:          exp.id,
        expenseName:        exp.name,
        cardId:             exp.cardId,
        amount:             exp.totalAmount / exp.installments,
        installmentNumber:  i + 1,
        totalInstallments:  exp.installments,
        month:              instMonthStr,
        category:           exp.category,
      });
    }
  }

  return result;
}

export function computeCategoryTotals(
  installments: MonthlyInstallment[],
  fixedExpenses: FixedExpense[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const i of installments) {
    totals[i.category] = (totals[i.category] ?? 0) + i.amount;
  }
  for (const f of fixedExpenses) {
    totals[f.category] = (totals[f.category] ?? 0) + f.amount;
  }
  return totals;
}