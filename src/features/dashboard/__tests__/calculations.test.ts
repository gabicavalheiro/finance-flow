import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {} }));

import type { CreditCard, Expense, FixedExpense, FixedIncome, VariableTransaction } from '@/lib/types';
import type { Subscription } from '@/lib/subscriptions';
import { computeMonthSummary, buildPieData, type MonthSummaryInput } from '../calculations';

const card: CreditCard = {
  id: 'c1', name: 'Nubank', brand: 'mastercard', lastDigits: '1234',
  limit: 5000, closingDay: 10, dueDay: 17, active: true,
};
// compra dia 5 (antes do fechamento): 3 parcelas de 100 em set, out e nov/2026
const exp: Expense = {
  id: 'e1', cardId: 'c1', name: 'Mercado', totalAmount: 300, category: 'food',
  date: '2026-09-05', installments: 3,
};
const fixed = (o: Partial<FixedExpense> = {}): FixedExpense => ({
  id: 'f1', name: 'Aluguel', amount: 1000, category: 'home', paidMonths: [], paymentMethod: 'pix', ...o,
});
const income = (o: Partial<FixedIncome> = {}): FixedIncome => ({
  id: 'i1', name: 'Salário', amount: 5000, receivedMonths: [], ...o,
} as FixedIncome);
const vtx = (o: Partial<VariableTransaction> = {}): VariableTransaction => ({
  id: 'v1', type: 'expense', name: 'Café', amount: 20, category: 'food', date: '2026-10-03', ...o,
} as VariableTransaction);

const base: MonthSummaryInput = {
  month: '2026-10', cards: [card], expenses: [exp], fixedExpenses: [], incomes: [],
  subscriptions: [], varTxs: [], invoices: [], currentMonth: '2026-10', today: new Date(2026, 9, 10),
};

describe('computeMonthSummary', () => {
  it('soma parcelas do mês, fixos e variáveis em totalExpense e calcula o saldo', () => {
    const s = computeMonthSummary({
      ...base,
      fixedExpenses: [fixed()],
      incomes: [income()],
      varTxs: [vtx(), vtx({ id: 'v2', type: 'income', amount: 300 })],
    });
    expect(s.totalCardSpent).toBe(100);
    expect(s.totalExpense).toBe(100 + 1000 + 20);
    expect(s.totalIncome).toBe(5300);
    expect(s.balance).toBe(5300 - 1120);
    expect(s.txCount).toBe(1 + 2);
  });

  it('prefere o valor confirmado da fatura ao calculado', () => {
    const s = computeMonthSummary({
      ...base,
      invoices: [{ cardId: 'c1', month: '2026-10', actualAmount: 180 }],
    });
    expect(s.installmentsByCard.get('c1')).toBe(180);
    expect(s.totalCardSpent).toBe(180);
    expect(s.totalCardCalculated).toBe(100);
  });

  it('pendente desconta fixos pagos e faturas confirmadas; a receber desconta receitas recebidas', () => {
    const s = computeMonthSummary({
      ...base,
      fixedExpenses: [fixed({ paidMonths: ['2026-10'] }), fixed({ id: 'f2', amount: 200 })],
      incomes: [income({ receivedMonths: ['2026-10'] }), income({ id: 'i2', amount: 1000 })],
    });
    expect(s.totalExpense).toBe(100 + 1200);
    expect(s.paidExpense).toBe(1000);
    expect(s.pendingExpense).toBe(300);
    expect(s.receivedIncome).toBe(5000);
    expect(s.toReceive).toBe(1000);
  });

  it('pendente e a receber nunca ficam negativos', () => {
    const s = computeMonthSummary({
      ...base,
      fixedExpenses: [fixed({ paidMonths: ['2026-10'] })],
      invoices: [{ cardId: 'c1', month: '2026-10', actualAmount: 5000 }],
    });
    expect(s.pendingExpense).toBe(0);
    expect(s.toReceive).toBe(0);
  });

  it('assinatura sem cartão entra no total; com cartão vira parcela', () => {
    const sub = (o: Partial<Subscription>): Subscription => ({
      id: 's1', name: 'Streaming', amount: 40, billingCycle: 'monthly', billingDay: 5,
      category: 'streaming', icon: '🎬', active: true, paidMonths: [], ...o,
    } as Subscription);
    const noCard = computeMonthSummary({ ...base, expenses: [], subscriptions: [sub({})] });
    expect(noCard.totalSubsNoCard).toBe(40);
    expect(noCard.totalExpense).toBe(40);
    const withCard = computeMonthSummary({ ...base, expenses: [], subscriptions: [sub({ cardId: 'c1' })] });
    expect(withCard.totalSubsNoCard).toBe(0);
    expect(withCard.allInstallments).toHaveLength(1);
    expect(withCard.totalCardSpent).toBe(40);
  });

  it('média diária: mês corrente usa o dia de hoje; outro mês usa os dias do mês', () => {
    const cur = computeMonthSummary({ ...base, fixedExpenses: [fixed({ amount: 900 })], expenses: [] });
    expect(cur.daysElapsed).toBe(10);
    expect(cur.avgDaily).toBe(90);
    const past = computeMonthSummary({ ...base, month: '2026-02', currentMonth: '2026-10', fixedExpenses: [fixed({ amount: 280 })], expenses: [] });
    expect(past.daysInMonth).toBe(28);
    expect(past.avgDaily).toBe(10);
  });

  it('expenseRatio limita em 100% e é 0 sem renda', () => {
    expect(computeMonthSummary({ ...base, fixedExpenses: [fixed()] }).expenseRatio).toBe(0);
    const over = computeMonthSummary({ ...base, fixedExpenses: [fixed({ amount: 9000 })], incomes: [income()] });
    expect(over.expenseRatio).toBe(100);
  });

  it('mês sem dados retorna zeros', () => {
    const s = computeMonthSummary({ ...base, expenses: [], cards: [] });
    expect(s.totalExpense).toBe(0);
    expect(s.balance).toBe(0);
    expect(s.avgDaily).toBe(0);
    expect(s.pieData).toEqual([]);
  });
});

describe('buildPieData', () => {
  it('agrupa por rótulo, ordena decrescente e limita a 8 fatias', () => {
    const slices = buildPieData([], [fixed({ amount: 300 })], [vtx({ amount: 50 }), vtx({ id: 'v2', category: 'home', amount: 100 })]);
    expect(slices[0]).toEqual({ name: 'Casa', value: 400 });
    expect(slices[1]).toEqual({ name: 'Alimentação', value: 50 });
  });
});
