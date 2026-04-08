import { CreditCard, Expense, FixedExpense, MonthlyInstallment } from './types';

const KEYS = {
  cards: 'ff_cards',
  expenses: 'ff_expenses',
  fixedExpenses: 'ff_fixed',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getCards(): CreditCard[] { return load(KEYS.cards, []); }
export function saveCards(c: CreditCard[]) { save(KEYS.cards, c); }

export function getExpenses(): Expense[] { return load(KEYS.expenses, []); }
export function saveExpenses(e: Expense[]) { save(KEYS.expenses, e); }

export function getFixedExpenses(): FixedExpense[] { return load(KEYS.fixedExpenses, []); }
export function saveFixedExpenses(f: FixedExpense[]) { save(KEYS.fixedExpenses, f); }

export function getInstallmentsForMonth(month: string): MonthlyInstallment[] {
  const expenses = getExpenses();
  const results: MonthlyInstallment[] = [];

  for (const exp of expenses) {
    const expDate = new Date(exp.date);
    const expMonth = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;

    for (let i = 0; i < exp.installments; i++) {
      const d = new Date(expDate.getFullYear(), expDate.getMonth() + i, 1);
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
  const fixed = getFixedExpenses();
  const instTotal = installments.reduce((s, i) => s + i.amount, 0);
  const fixedTotal = fixed.reduce((s, f) => s + f.amount, 0);
  return instTotal + fixedTotal;
}

export function getCategoryTotalsForMonth(month: string): Record<string, number> {
  const installments = getInstallmentsForMonth(month);
  const fixed = getFixedExpenses();
  const totals: Record<string, number> = {};

  for (const i of installments) {
    totals[i.category] = (totals[i.category] || 0) + i.amount;
  }
  for (const f of fixed) {
    totals[f.category] = (totals[f.category] || 0) + f.amount;
  }

  return totals;
}
