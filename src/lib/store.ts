import {
  CreditCard,
  Expense,
  ExpenseCategory,
  FixedExpense,
  FixedIncome,
  MonthlyInstallment,
  VariableTransaction,
} from './types';

const KEYS = {
  cards:        'ff_cards',
  expenses:     'ff_expenses',
  fixedExpenses:'ff_fixed',
  incomes:      'ff_incomes',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getCards(): CreditCard[]            { return load(KEYS.cards, []); }
export function saveCards(c: CreditCard[])           { save(KEYS.cards, c); }
export function deleteCard(id: string) {
  const cards = getCards().filter(card => card.id !== id);
  const expenses = getExpenses().filter(expense => expense.cardId !== id);
  saveCards(cards);
  saveExpenses(expenses);
}

export function getExpenses(): Expense[]             { return load(KEYS.expenses, []); }
export function saveExpenses(e: Expense[])           { save(KEYS.expenses, e); }
export function deleteExpense(id: string) {
  saveExpenses(getExpenses().filter(expense => expense.id !== id));
}

export function getFixedExpenses(): FixedExpense[]   { return load(KEYS.fixedExpenses, []); }
export function saveFixedExpenses(f: FixedExpense[]) { save(KEYS.fixedExpenses, f); }
export function updateFixedExpense(id: string, patch: Partial<FixedExpense>) {
  const next = getFixedExpenses().map(item => (item.id === id ? { ...item, ...patch } : item));
  saveFixedExpenses(next);
}
export function deleteFixedExpense(id: string) {
  saveFixedExpenses(getFixedExpenses().filter(item => item.id !== id));
}

export function getIncomes(): FixedIncome[]          { return load(KEYS.incomes, []); }
export function saveIncomes(i: FixedIncome[])        { save(KEYS.incomes, i); }
export function updateIncome(id: string, patch: Partial<FixedIncome>) {
  const next = getIncomes().map(item => (item.id === id ? { ...item, ...patch } : item));
  saveIncomes(next);
}
export function deleteIncome(id: string) {
  saveIncomes(getIncomes().filter(item => item.id !== id));
}

/**
 * Determines the billing month for a purchase given the card's closing day.
 *
 * Rule: if the purchase day is AFTER the closing day, it falls into the
 * NEXT month's bill. Otherwise it stays in the current month's bill.
 *
 * Example — closing day 10:
 *   • purchase on 2026-03-05  →  March bill  (05 ≤ 10)
 *   • purchase on 2026-03-15  →  April bill  (15 > 10)
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

export function getInstallmentsForMonth(month: string): MonthlyInstallment[] {
  const expenses = getExpenses();
  const cards    = getCards();
  const cardMap  = new Map(cards.map(c => [c.id, c]));
  const results: MonthlyInstallment[] = [];

  for (const exp of expenses) {
    // Use noon to avoid UTC offset shifting the date
    const expDate    = new Date(exp.date + 'T12:00:00');
    const card       = cardMap.get(exp.cardId);
    const closingDay = card?.closingDay ?? 1;

    const { year: billingYear, month: billingMonth } = getBillingMonth(expDate, closingDay);

    for (let i = 0; i < exp.installments; i++) {
      const d         = new Date(billingYear, billingMonth + i, 1);
      const instMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (instMonth === month) {
        results.push({
          expenseId:          exp.id,
          expenseName:        exp.name,
          cardId:             exp.cardId,
          amount:             exp.totalAmount / exp.installments,
          installmentNumber:  i + 1,
          totalInstallments:  exp.installments,
          category:           exp.category,
          month,
        });
      }
    }
  }

  return results;
}

export function computeInstallmentsForMonth(
  expenses: Expense[],
  cards: CreditCard[],
  month: string,
): MonthlyInstallment[] {
  const cardMap  = new Map(cards.map(c => [c.id, c]));
  const results: MonthlyInstallment[] = [];

  for (const exp of expenses) {
    const expDate = new Date(`${exp.date}T12:00:00`);
    const card = cardMap.get(exp.cardId);
    const closingDay = card?.closingDay ?? 1;
    const { year: billingYear, month: billingMonth } = getBillingMonth(expDate, closingDay);

    for (let i = 0; i < exp.installments; i++) {
      const d = new Date(billingYear, billingMonth + i, 1);
      const instMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (instMonth === month) {
        results.push({
          expenseId: exp.id,
          expenseName: exp.name,
          cardId: exp.cardId,
          amount: exp.totalAmount / exp.installments,
          installmentNumber: i + 1,
          totalInstallments: exp.installments,
          category: exp.category,
          month,
        });
      }
    }
  }

  return results;
}

export function getTotalForMonth(month: string): number {
  const installments = getInstallmentsForMonth(month);
  const fixed        = getFixedExpenses();
  return installments.reduce((s, i) => s + i.amount, 0)
       + fixed.reduce((s, f) => s + f.amount, 0);
}

export function getTotalIncomeForMonth(_month: string): number {
  return getIncomes().reduce((s, i) => s + i.amount, 0);
}

export function getBalanceForMonth(month: string): number {
  return getTotalIncomeForMonth(month) - getTotalForMonth(month);
}

export function getCategoryTotalsForMonth(month: string): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const i of getInstallmentsForMonth(month))
    totals[i.category] = (totals[i.category] || 0) + i.amount;
  for (const f of getFixedExpenses())
    totals[f.category] = (totals[f.category] || 0) + f.amount;
  return totals;
}

export function computeCategoryTotals(
  installments: MonthlyInstallment[],
  fixedExpenses: FixedExpense[],
): Record<ExpenseCategory, number> {
  const totals: Partial<Record<ExpenseCategory, number>> = {};

  for (const installment of installments) {
    totals[installment.category] = (totals[installment.category] ?? 0) + installment.amount;
  }

  for (const fixed of fixedExpenses) {
    totals[fixed.category] = (totals[fixed.category] ?? 0) + fixed.amount;
  }

  return totals as Record<ExpenseCategory, number>;
}

export function getIncomeCategoryTotals(): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const i of getIncomes())
    totals[i.category] = (totals[i.category] || 0) + i.amount;
  return totals;
}

const VAR_KEY = 'ff_variable';

export function getVariableTransactions(): VariableTransaction[] {
  return load(VAR_KEY, []);
}
export function saveVariableTransactions(t: VariableTransaction[]) {
  save(VAR_KEY, t);
}
export function deleteVariableTransaction(id: string) {
  saveVariableTransactions(getVariableTransactions().filter(item => item.id !== id));
}

export function getVariableForMonth(month: string): VariableTransaction[] {
  return getVariableTransactions().filter(t => t.date.startsWith(month));
}

export function getVariableIncomeForMonth(month: string): number {
  return getVariableForMonth(month)
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
}

export function getVariableExpenseForMonth(month: string): number {
  return getVariableForMonth(month)
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
}