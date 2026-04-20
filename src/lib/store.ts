/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from './supabase';
import { CreditCard, Expense, FixedExpense, FixedIncome, MonthlyInstallment, VariableTransaction } from './types';

async function uid(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
  return user.id;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────
function dbToCard(r: any): CreditCard {
  return {
    id: r.id, name: r.name, brand: r.brand,
    lastDigits: r.last_digits, limit: r.limit,
    closingDay: r.closing_day,
    dueDay: r.due_day ?? r.closing_day + 7,   // fallback: fechamento + 7 dias
    customGradient: r.custom_gradient ?? undefined,
  };
}
function cardToDb(c: CreditCard, userId: string) {
  return {
    id: c.id, user_id: userId, name: c.name, brand: c.brand,
    last_digits: c.lastDigits, limit: c.limit,
    closing_day: c.closingDay,
    due_day: c.dueDay,
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

// ─── Cards ───────────────────────────────────────────────────────────────────
export async function getCards(): Promise<CreditCard[]> {
  const { data, error } = await supabase.from('cards').select('*').order('created_at');
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToCard);
}
export async function addCard(card: CreditCard): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('cards').insert(cardToDb(card, userId));
  if (error) throw error;
}
export async function updateCard(card: CreditCard): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('cards').update(cardToDb(card, userId)).eq('id', card.id);
  if (error) throw error;
}
export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id);
  if (error) throw error;
}

// ─── Expenses ────────────────────────────────────────────────────────────────
export async function getExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('*').order('created_at');
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToExpense);
}
export async function addExpense(expense: Expense): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('expenses').insert(expenseToDb(expense, userId));
  if (error) throw error;
}
export async function updateExpense(expense: Expense): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('expenses').update(expenseToDb(expense, userId)).eq('id', expense.id);
  if (error) throw error;
}
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

// ─── Fixed Expenses ──────────────────────────────────────────────────────────
export async function getFixedExpenses(): Promise<FixedExpense[]> {
  const { data, error } = await supabase.from('fixed_expenses').select('*').order('created_at');
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToFixedExpense);
}
export async function addFixedExpense(expense: FixedExpense): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('fixed_expenses').insert(fixedExpenseToDb(expense, userId));
  if (error) throw error;
}
export async function updateFixedExpense(id: string, fields: Partial<FixedExpense>): Promise<void> {
  const dbFields: any = {};
  if (fields.name !== undefined)           dbFields.name           = fields.name;
  if (fields.amount !== undefined)         dbFields.amount         = fields.amount;
  if (fields.category !== undefined)       dbFields.category       = fields.category;
  if (fields.paidMonths !== undefined)     dbFields.paid_months    = fields.paidMonths;
  if (fields.paymentMethod !== undefined)  dbFields.payment_method = fields.paymentMethod;
  const { error } = await supabase.from('fixed_expenses').update(dbFields).eq('id', id);
  if (error) throw error;
}
export async function deleteFixedExpense(id: string): Promise<void> {
  const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
  if (error) throw error;
}

// ─── Fixed Incomes ───────────────────────────────────────────────────────────
export async function getIncomes(): Promise<FixedIncome[]> {
  const { data, error } = await supabase.from('fixed_incomes').select('*').order('created_at');
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToIncome);
}
export async function addIncome(income: FixedIncome): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('fixed_incomes').insert(incomeToDb(income, userId));
  if (error) throw error;
}
export async function updateIncome(id: string, fields: Partial<FixedIncome>): Promise<void> {
  const dbFields: any = {};
  if (fields.name !== undefined)            dbFields.name             = fields.name;
  if (fields.amount !== undefined)          dbFields.amount           = fields.amount;
  if (fields.category !== undefined)        dbFields.category         = fields.category;
  if (fields.receiveDay !== undefined)      dbFields.receive_day      = fields.receiveDay;
  if (fields.receivedMonths !== undefined)  dbFields.received_months  = fields.receivedMonths;
  const { error } = await supabase.from('fixed_incomes').update(dbFields).eq('id', id);
  if (error) throw error;
}
export async function deleteIncome(id: string): Promise<void> {
  const { error } = await supabase.from('fixed_incomes').delete().eq('id', id);
  if (error) throw error;
}

// ─── Variable Transactions ───────────────────────────────────────────────────
export async function getVariableTransactions(): Promise<VariableTransaction[]> {
  const { data, error } = await supabase
    .from('variable_transactions').select('*').order('date', { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToVariable);
}
export async function getVariableForMonth(month: string): Promise<VariableTransaction[]> {
  const { data, error } = await supabase
    .from('variable_transactions').select('*')
    .like('date', `${month}%`).order('date', { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToVariable);
}
export async function addVariableTransaction(tx: VariableTransaction): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('variable_transactions').insert(variableToDb(tx, userId));
  if (error) throw error;
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
}
export async function deleteVariableTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('variable_transactions').delete().eq('id', id);
  if (error) throw error;
}

// ─── Pure computation helpers ────────────────────────────────────────────────

/**
 * Determina o mês de faturamento de uma compra.
 * Se o dia da compra > closingDay → entra na fatura do próximo mês.
 */
function getBillingMonth(purchaseDate: Date, closingDay: number): { year: number; month: number } {
  const day   = purchaseDate.getDate();
  let   year  = purchaseDate.getFullYear();
  let   month = purchaseDate.getMonth(); // 0-indexed
  if (day > closingDay) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return { year, month };
}

export function computeInstallmentsForMonth(
  expenses: Expense[], cards: CreditCard[], month: string,
): MonthlyInstallment[] {
  const cardMap = new Map(cards.map(c => [c.id, c]));
  const results: MonthlyInstallment[] = [];
  for (const exp of expenses) {
    const expDate    = new Date(exp.date + 'T12:00:00');
    const card       = cardMap.get(exp.cardId);
    const closingDay = card?.closingDay ?? 1;
    const { year: billingYear, month: billingMonth } = getBillingMonth(expDate, closingDay);
    for (let i = 0; i < exp.installments; i++) {
      const d         = new Date(billingYear, billingMonth + i, 1);
      const instMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (instMonth === month) {
        results.push({
          expenseId: exp.id, expenseName: exp.name, cardId: exp.cardId,
          amount: exp.totalAmount / exp.installments,
          installmentNumber: i + 1, totalInstallments: exp.installments,
          category: exp.category, month,
        });
      }
    }
  }
  return results;
}

export function computeCategoryTotals(
  installments: MonthlyInstallment[], fixedExpenses: FixedExpense[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const i of installments) totals[i.category] = (totals[i.category] || 0) + i.amount;
  for (const f of fixedExpenses) totals[f.category] = (totals[f.category] || 0) + f.amount;
  return totals;
}

export function computeIncomeCategoryTotals(incomes: FixedIncome[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const i of incomes) totals[i.category] = (totals[i.category] || 0) + i.amount;
  return totals;
}

// ─── Card Invoices (fatura real) ─────────────────────────────────────────────
export interface CardInvoice {
  id?: string;
  cardId: string;
  month: string;      // 'YYYY-MM'
  actualAmount: number;
  notes?: string;
}

function dbToInvoice(r: any): CardInvoice {
  return {
    id: r.id, cardId: r.card_id, month: r.month,
    actualAmount: r.actual_amount, notes: r.notes ?? undefined,
  };
}

export async function getInvoicesForMonth(month: string): Promise<CardInvoice[]> {
  const { data, error } = await supabase
    .from('card_invoices').select('*').eq('month', month);
  if (error) { console.error(error); return []; }
  return (data ?? []).map(dbToInvoice);
}

export async function upsertInvoice(invoice: CardInvoice): Promise<void> {
  const userId = await uid();
  const { error } = await supabase.from('card_invoices').upsert({
    user_id: userId,
    card_id: invoice.cardId,
    month: invoice.month,
    actual_amount: invoice.actualAmount,
    notes: invoice.notes ?? null,
  }, { onConflict: 'user_id,card_id,month' });
  if (error) throw error;
}