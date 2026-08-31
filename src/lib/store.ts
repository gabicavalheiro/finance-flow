/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * store.ts — migrado de Supabase/Postgres para Firebase/Firestore
 *
 * Estrutura no Firestore: users/{uid}/<coleção>/{id}
 * A segurança por usuário (equivalente ao RLS do Postgres) vem das
 * Security Rules em firestore.rules — cada usuário só acessa o próprio
 * caminho users/{uid}/..., então não existe mais a necessidade de um
 * campo user_id nos documentos nem de mappers snake_case ↔ camelCase
 * (o Firestore guarda os objetos JS praticamente como estão).
 *
 * Continua usando o mesmo queryCache em memória (TTL) de antes, e as
 * mesmas assinaturas de função — o resto do app (páginas, diálogos) não
 * precisou mudar por causa disso.
 */

import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { queryCache } from './queryCache';
import { clearCustomCategoryCache } from './customCategories';
import { addMonths, getInvoiceMonth } from './helpers';
import {
  CreditCard, Expense, FixedExpense, FixedIncome,
  MonthlyInstallment, VariableTransaction,
} from './types';

// ─── uid ──────────────────────────────────────────────────────────────────────
// auth.currentUser já está populado de forma síncrona nesse ponto: o app só
// renderiza as telas que chamam store.ts depois que App.tsx confirma a sessão
// via onAuthStateChanged (ver App.tsx).
function uid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  return user.uid;
}

// Limpa o cache em memória ao trocar de usuário (login/logout) — evita que
// dados de um usuário fiquem visíveis para o próximo que logar no mesmo device.
auth.onAuthStateChanged((user) => {
  if (!user) {
    queryCache.invalidateAll();
    clearCustomCategoryCache();
  }
});

// ─── TTLs ─────────────────────────────────────────────────────────────────────
const TTL = {
  STATIC:  5 * 60_000, // 5 min — dados que mudam pouco (cards, gastos fixos, rendas)
  DYNAMIC: 60_000,     // 1 min — dados que mudam mais (variáveis, faturas)
};

// ─── Helpers genéricos de coleção ─────────────────────────────────────────────
function userCol(name: string) {
  return collection(db, 'users', uid(), name);
}
function userDoc(name: string, id: string) {
  return doc(db, 'users', uid(), name, id);
}

/** Remove chaves com valor `undefined` — o Firestore rejeita `undefined` (null é ok). */
function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean = { ...obj };
  Object.keys(clean).forEach((k) => { if (clean[k] === undefined) delete clean[k]; });
  return clean;
}

async function getAll<T>(
  name: string,
  orderField = 'createdAt',
  direction: 'asc' | 'desc' = 'asc',
): Promise<T[]> {
  try {
    const snap = await getDocs(query(userCol(name), orderBy(orderField, direction)));
    return snap.docs.map((d) => d.data() as T);
  } catch (err) {
    console.error(`getAll(${name}):`, err);
    return [];
  }
}

async function addItem(colName: string, id: string, data: Record<string, any>): Promise<void> {
  await setDoc(userDoc(colName, id), { ...stripUndefined(data), createdAt: serverTimestamp() });
}
async function replaceItem(colName: string, id: string, data: Record<string, any>): Promise<void> {
  // merge: true preserva o createdAt original ao "substituir" um doc existente
  await setDoc(userDoc(colName, id), stripUndefined(data), { merge: true });
}
async function updateItem(colName: string, id: string, fields: Record<string, any>): Promise<void> {
  await updateDoc(userDoc(colName, id), stripUndefined(fields));
}
async function deleteItem(colName: string, id: string): Promise<void> {
  await deleteDoc(userDoc(colName, id));
}

// ─── Cards ────────────────────────────────────────────────────────────────────
export async function getCards(): Promise<CreditCard[]> {
  return queryCache.get('cards', () => getAll<CreditCard>('cards'), TTL.STATIC);
}
export async function addCard(card: CreditCard): Promise<void> {
  await addItem('cards', card.id, card);
  queryCache.invalidate('cards');
}
export async function updateCard(card: CreditCard): Promise<void> {
  await replaceItem('cards', card.id, card);
  queryCache.invalidate('cards');
}
export async function deleteCard(id: string): Promise<void> {
  await deleteItem('cards', id);
  queryCache.invalidate('cards');
  queryCache.invalidate('expenses');
}
export async function setCardActive(id: string, active: boolean): Promise<void> {
  await updateItem('cards', id, { active });
  queryCache.invalidate('cards');
}

export interface CardPendingSummary {
  /** Parcelas ainda não vencidas a partir do mês informado (inclusive) */
  count: number;
  /** Soma dessas parcelas */
  amount: number;
  /** Último mês (YYYY-MM) em que ainda há parcela pendente, ou null se não há nenhuma */
  finalMonth: string | null;
}

/**
 * Quanto ainda falta pagar de compras parceladas num cartão, a partir de um
 * mês de referência (normalmente o mês atual). Usado pra avisar o usuário
 * antes de bloquear um cartão — as parcelas continuam existindo mesmo com o
 * cartão bloqueado, então isso precisa continuar visível em algum lugar.
 */
export function getCardPendingInstallments(
  expenses: Expense[],
  card: CreditCard,
  fromMonth: string,
): CardPendingSummary {
  let count = 0;
  let amount = 0;
  let finalMonth: string | null = null;

  for (const exp of expenses) {
    if (exp.cardId !== card.id) continue;
    const firstInvoiceMonth = getInvoiceMonth(exp.date, card);
    for (let i = 0; i < exp.installments; i++) {
      const instMonth = addMonths(firstInvoiceMonth, i);
      if (instMonth < fromMonth) continue;
      count++;
      amount += exp.totalAmount / exp.installments;
      if (!finalMonth || instMonth > finalMonth) finalMonth = instMonth;
    }
  }

  return { count, amount, finalMonth };
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
export async function getExpenses(): Promise<Expense[]> {
  return queryCache.get('expenses', () => getAll<Expense>('expenses'), TTL.STATIC);
}
export async function addExpense(expense: Expense): Promise<void> {
  await addItem('expenses', expense.id, expense);
  queryCache.invalidate('expenses');
}
export async function updateExpense(expense: Expense): Promise<void> {
  await replaceItem('expenses', expense.id, expense);
  queryCache.invalidate('expenses');
}
export async function deleteExpense(id: string): Promise<void> {
  await deleteItem('expenses', id);
  queryCache.invalidate('expenses');
}

// ─── Fixed Expenses ───────────────────────────────────────────────────────────
export async function getFixedExpenses(): Promise<FixedExpense[]> {
  return queryCache.get('fixed_expenses', () => getAll<FixedExpense>('fixedExpenses'), TTL.STATIC);
}
export async function addFixedExpense(expense: FixedExpense): Promise<void> {
  await addItem('fixedExpenses', expense.id, expense);
  queryCache.invalidate('fixed_expenses');
}
export async function updateFixedExpense(id: string, fields: Partial<FixedExpense>): Promise<void> {
  await updateItem('fixedExpenses', id, fields);
  queryCache.invalidate('fixed_expenses');
}
export async function deleteFixedExpense(id: string): Promise<void> {
  await deleteItem('fixedExpenses', id);
  queryCache.invalidate('fixed_expenses');
}

// ─── Fixed Incomes ────────────────────────────────────────────────────────────
export async function getIncomes(): Promise<FixedIncome[]> {
  return queryCache.get('fixed_incomes', () => getAll<FixedIncome>('fixedIncomes'), TTL.STATIC);
}
export async function addIncome(income: FixedIncome): Promise<void> {
  await addItem('fixedIncomes', income.id, income);
  queryCache.invalidate('fixed_incomes');
}
export async function updateIncome(id: string, fields: Partial<FixedIncome>): Promise<void> {
  await updateItem('fixedIncomes', id, fields);
  queryCache.invalidate('fixed_incomes');
}
export async function deleteIncome(id: string): Promise<void> {
  await deleteItem('fixedIncomes', id);
  queryCache.invalidate('fixed_incomes');
}

// ─── Variable Transactions ────────────────────────────────────────────────────
export async function getVariableTransactions(): Promise<VariableTransaction[]> {
  return queryCache.get(
    'variable_all',
    () => getAll<VariableTransaction>('variableTransactions', 'date', 'desc'),
    TTL.DYNAMIC,
  );
}

export async function getVariableForMonth(month: string): Promise<VariableTransaction[]> {
  return queryCache.get(`variable:${month}`, async () => {
    try {
      const snap = await getDocs(query(
        userCol('variableTransactions'),
        where('date', '>=', `${month}-01`),
        where('date', '<=', `${month}-31`),
        orderBy('date', 'desc'),
      ));
      return snap.docs.map((d) => d.data() as VariableTransaction);
    } catch (err) {
      console.error('getVariableForMonth:', err);
      return [];
    }
  }, TTL.DYNAMIC);
}

export async function addVariableTransaction(tx: VariableTransaction): Promise<void> {
  await addItem('variableTransactions', tx.id, tx);
  const month = tx.date.slice(0, 7);
  queryCache.invalidate(`variable:${month}`);
  queryCache.invalidate('variable_all');
}

export async function updateVariableTransaction(id: string, fields: Partial<VariableTransaction>): Promise<void> {
  await updateItem('variableTransactions', id, fields);
  queryCache.invalidate('variable:*');
  queryCache.invalidate('variable_all');
}

export async function deleteVariableTransaction(id: string): Promise<void> {
  await deleteItem('variableTransactions', id);
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

// Doc id composto (cardId_month) — dá upsert "de graça" via setDoc merge,
// sem precisar de onConflict como no Postgres.
function invoiceDocId(cardId: string, month: string): string {
  return `${cardId}_${month}`;
}

export async function getInvoicesForMonth(month: string): Promise<CardInvoice[]> {
  return queryCache.get(`invoices:${month}`, async () => {
    try {
      const snap = await getDocs(query(userCol('cardInvoices'), where('month', '==', month)));
      return snap.docs.map((d) => d.data() as CardInvoice);
    } catch (err) {
      console.error('getInvoicesForMonth:', err);
      return [];
    }
  }, TTL.DYNAMIC);
}

/**
 * Busca faturas de um intervalo de meses. Aproveita entradas já em cache e
 * só busca os meses ausentes, num único `where('month', 'in', ...)`.
 */
export async function getInvoicesForMonthRange(
  months: string[],
): Promise<Record<string, CardInvoice[]>> {
  if (months.length === 0) return {};

  const result: Record<string, CardInvoice[]> = {};
  const missing: string[] = [];

  for (const m of months) {
    if (queryCache.has(`invoices:${m}`)) {
      result[m] = await queryCache.get<CardInvoice[]>(`invoices:${m}`, () => Promise.resolve([]), TTL.DYNAMIC);
    } else {
      missing.push(m);
    }
  }

  if (missing.length > 0) {
    const grouped: Record<string, CardInvoice[]> = {};
    for (const m of missing) grouped[m] = [];

    try {
      // 'in' aceita até 30 valores — suficiente para o histórico usado no app
      const snap = await getDocs(query(userCol('cardInvoices'), where('month', 'in', missing)));
      for (const d of snap.docs) {
        const inv = d.data() as CardInvoice;
        if (!grouped[inv.month]) grouped[inv.month] = [];
        grouped[inv.month].push(inv);
      }
    } catch (err) {
      console.error('getInvoicesForMonthRange:', err);
    }

    for (const m of missing) {
      result[m] = grouped[m];
      queryCache.set(`invoices:${m}`, grouped[m], TTL.DYNAMIC);
    }
  }

  return result;
}

export async function upsertInvoice(invoice: CardInvoice): Promise<void> {
  const id = invoiceDocId(invoice.cardId, invoice.month);
  await setDoc(
    userDoc('cardInvoices', id),
    stripUndefined({
      cardId: invoice.cardId,
      month: invoice.month,
      actualAmount: invoice.actualAmount,
      notes: invoice.notes,
    }),
    { merge: true },
  );
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
    const card = cards.find(c => c.id === exp.cardId);
    if (!card) continue;

    // Mês de vencimento da 1ª parcela (considera fechamento + vencimento juntos)
    const firstInvoiceMonth = getInvoiceMonth(exp.date, card);

    for (let i = 0; i < exp.installments; i++) {
      // Cada parcela seguinte vence exatamente 1 mês após a anterior
      const instMonthStr = addMonths(firstInvoiceMonth, i);
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
