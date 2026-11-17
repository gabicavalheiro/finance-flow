import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {} }));

import { buildPurchaseSnapshots } from '../buildSnapshots';
import type { FixedExpense, FixedIncome, VariableTransaction } from '@/lib/types';

const income: FixedIncome = { id: 'i1', name: 'Salário', amount: 5000, category: 'salary', receivedMonths: [] };
const rent: FixedExpense = {
  id: 'f1', name: 'Aluguel', amount: 2000, category: 'home', paidMonths: [], paymentMethod: 'pix',
};
const lunch: VariableTransaction = {
  id: 'v1', name: 'Almoço', amount: 300, type: 'expense', paymentMethod: 'pix', category: 'food', date: '2026-11-05',
};

const base = {
  currentMonth: '2026-11', horizon: 3,
  cards: [], expenses: [], subscriptions: [], invoicesByMonth: {},
  incomes: [income], fixedExpenses: [rent], varTxsByMonth: { '2026-11': [lunch] },
  today: new Date(2026, 10, 17),
};

describe('buildPurchaseSnapshots', () => {
  it('a sobra de cada mês é a mesma do Início (sem previsão somada)', () => {
    const r = buildPurchaseSnapshots({
      ...base,
      forecast: [{ month: '2026-11', mean: 800, lower: 600, upper: 1000 }],
    });
    expect(r.months.map(m => m.expense)).toEqual([2300, 2000, 2000]);
    expect(r.spentByCategory.food).toBe(300);
  });

  it('a previsão vira só o extra ainda não lançado de cada mês', () => {
    const r = buildPurchaseSnapshots({
      ...base,
      forecast: [
        { month: '2026-11', mean: 800, lower: 600, upper: 1000 },
        { month: '2026-12', mean: 900, lower: 700, upper: 1100 },
      ],
    });
    // nov: 800 previsto − 300 já lançado; dez: 900; jan repete o último mês previsto
    expect(r.extraByMonth).toEqual([500, 900, 900]);
  });

  it('sem previsão o extra é zero', () => {
    expect(buildPurchaseSnapshots({ ...base, forecast: [] }).extraByMonth).toEqual([0, 0, 0]);
  });
});
