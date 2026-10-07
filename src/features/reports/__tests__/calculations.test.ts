import { describe, it, expect, vi } from 'vitest';

// store.ts importa o Firebase; aqui só usamos funções puras, então o cliente é irrelevante.
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {} }));

import { computeInstallmentsForMonth } from '@/lib/store';
import type { Subscription } from '@/lib/subscriptions';
import type { CreditCard, Expense, FixedExpense, FixedIncome, VariableTransaction } from '@/lib/types';
import {
  buildBarDataHist, buildCategoryDetails, buildCategoryList, buildCommittedByMonth,
  buildDailyFlow, buildForecasts, buildInsights, type CategoryRow,
} from '../calculations';
import { monthLabel } from '../format';

const card: CreditCard = {
  id: 'c1', name: 'Nubank', brand: 'mastercard', lastDigits: '1234',
  limit: 5000, closingDay: 10, dueDay: 17, active: true,
};
// compra dia 5 (antes do fechamento no dia 10): 3 parcelas de 100 em set, out e nov/2026
const exp = (o: Partial<Expense> = {}): Expense => ({
  id: 'e1', cardId: 'c1', name: 'Mercado', totalAmount: 300, category: 'food',
  date: '2026-09-05', installments: 3, ...o,
});
const fx = (o: Partial<FixedExpense> = {}): FixedExpense => ({
  id: 'f1', name: 'Aluguel', amount: 1000, category: 'home', paidMonths: [], paymentMethod: 'pix', ...o,
});
const row = (label: string, value: number): CategoryRow => ({ label, value, color: '0 0% 50%', sampleKey: 'other' });

describe('buildCategoryDetails / buildCategoryList', () => {
  const cardMap = new Map([[card.id, card]]);
  const expenseMap = new Map([['e1', exp()]]);
  const installments = computeInstallmentsForMonth([exp()], [card], '2026-10');

  it('agrupa por label: categorias desconhecidas e "other" caem juntas em "Outros"', () => {
    const details = buildCategoryDetails({
      installments,
      fixed: [fx(), fx({ id: 'f2', category: 'other', amount: 50 }), fx({ id: 'f3', category: 'categoria-apagada' as never, amount: 70 })],
      subscriptions: [], cardMap, expenseMap,
    });
    expect([...details.keys()].sort()).toEqual(['Alimentação', 'Casa', 'Outros']);
    expect(details.get('Outros')!.items).toHaveLength(2);
  });

  it('parcela do cartão traz detalhe "n/N · cartão" e o gasto original', () => {
    const details = buildCategoryDetails({ installments, fixed: [], subscriptions: [], cardMap, expenseMap });
    const item = details.get('Alimentação')!.items[0];
    expect(item.detail).toBe('2/3 · Nubank');
    expect(item.amount).toBeCloseTo(100);
    expect(item.expense?.id).toBe('e1');
  });

  it('assinaturas ativas entram em "Assinatura" (anual é rateada); inativas são ignoradas', () => {
    const sub = (o: Partial<Subscription>): Subscription => ({
      id: 's1', name: 'iCloud', amount: 1200, billingCycle: 'annual', billingDay: 5,
      category: 'cloud', active: true, paidMonths: [], cardId: 'c1', ...o,
    });
    const details = buildCategoryDetails({
      installments: [], fixed: [], cardMap, expenseMap,
      subscriptions: [sub({}), sub({ id: 's2', active: false })],
    });
    const items = details.get('Assinatura')!.items;
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBeCloseTo(100);
  });

  it('lista ordenada do maior para o menor valor', () => {
    const details = buildCategoryDetails({
      installments, fixed: [fx({ amount: 1000 })], subscriptions: [], cardMap, expenseMap,
    });
    const list = buildCategoryList(details);
    expect(list.map(c => c.label)).toEqual(['Casa', 'Alimentação']);
  });
});

describe('buildInsights', () => {
  const list = [row('Alimentação', 600), row('Casa', 400)];

  it('sem gastos não gera mensagens', () => {
    expect(buildInsights({ categoryList: [], totalHist: 0, prevCategoryTotals: new Map() })).toEqual([]);
  });

  it('categoria dominante (≥30%) gera o alerta de "passou"', () => {
    const [first] = buildInsights({ categoryList: list, totalHist: 1000, prevCategoryTotals: new Map() });
    expect(first.icon).toBe('flame');
    expect(first.text).toContain('alimentação');
    expect(first.text).toContain('60%');
  });

  it('aumento ≥25% sobre o mês anterior vira insight; bases < R$ 20 são ignoradas', () => {
    const msgs = buildInsights({
      categoryList: list, totalHist: 1000,
      prevCategoryTotals: new Map([['Casa', 200], ['Alimentação', 5]]),
    });
    expect(msgs.some(m => m.text.includes('Casa subiu 100%'))).toBe(true);
    expect(msgs.some(m => m.text.includes('Alimentação subiu'))).toBe(false);
  });

  it('queda ≥25% gera parabéns', () => {
    const msgs = buildInsights({
      categoryList: list, totalHist: 1000, prevCategoryTotals: new Map([['Alimentação', 1000]]),
    });
    expect(msgs.some(m => m.icon === 'party' && m.text.includes('caiu 40%'))).toBe(true);
  });

  it('no máximo 3 mensagens', () => {
    const many = buildInsights({
      categoryList: list, totalHist: 1000,
      prevCategoryTotals: new Map([['Casa', 100], ['Alimentação', 2000]]),
    });
    expect(many.length).toBeLessThanOrEqual(3);
  });
});

describe('buildDailyFlow', () => {
  const income = (o: Partial<FixedIncome> = {}): FixedIncome => ({
    id: 'i1', name: 'Salário', amount: 3000, category: 'salary', receiveDay: 5, receivedMonths: [], ...o,
  });
  const tx: VariableTransaction = {
    id: 't1', name: 'Pizza', amount: 50, type: 'expense', paymentMethod: 'pix', category: 'food', date: '2026-10-20',
  };
  const flow = buildDailyFlow({
    month: '2026-10',
    incomes: [income()],
    cards: [card],
    installments: computeInstallmentsForMonth([exp()], [card], '2026-10'),
    fixed: [fx()],
    varTxs: [tx],
  });

  it('um ponto por dia do mês', () => expect(flow).toHaveLength(31));

  it('fixos saem no dia 1, receita no dia do recebimento, fatura no vencimento do cartão', () => {
    expect(flow[0].dSaida).toBe(1000);
    expect(flow[4].dEntrada).toBe(3000);
    expect(flow[16].dSaida).toBeCloseTo(100);
    expect(flow[19].dSaida).toBe(50);
  });

  it('saldo acumulado = entradas − saídas e fecha o mês na soma de tudo', () => {
    flow.forEach(p => expect(p.saldo).toBeCloseTo(p.entradas - p.saidas));
    expect(flow[30].saldo).toBeCloseTo(3000 - 1000 - 100 - 50);
  });

  it('receitas sem dia definido caem no dia 1', () => {
    const f = buildDailyFlow({
      month: '2026-02', incomes: [income({ receiveDay: undefined })], cards: [], installments: [], fixed: [], varTxs: [],
    });
    expect(f).toHaveLength(28);
    expect(f[0].dEntrada).toBe(3000);
  });
});

describe('buildForecasts / buildCommittedByMonth / buildBarDataHist', () => {
  const cardMap = new Map([[card.id, card]]);
  const forecasts = buildForecasts({
    expenses: [exp()], cards: [card], totalFixedExpense: 1000, totalFixedIncome: 5000, cardMap, current: '2026-10',
  });

  it('7 meses: anterior, atual e 5 futuros, com as flags certas', () => {
    expect(forecasts.map(f => f.month)).toEqual(
      ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
    expect(forecasts[0].isPast).toBe(true);
    expect(forecasts[1].isCurrent).toBe(true);
    expect(forecasts.slice(2).every(f => f.isFuture)).toBe(true);
  });

  it('soma parcelas + fixos e calcula o saldo; parcelas acabam na 3ª', () => {
    expect(forecasts[1].cardExpenses).toBeCloseTo(100);
    expect(forecasts[1].totalExpense).toBeCloseTo(1100);
    expect(forecasts[1].balance).toBeCloseTo(3900);
    expect(forecasts[3].cardExpenses).toBe(0); // dezembro: sem parcela
  });

  it('compromissos conhecidos ignoram compras à vista (evita contar em dobro com o ML)', () => {
    const avista = exp({ id: 'e2', installments: 1, totalAmount: 500, date: '2026-10-05' });
    const committed = buildCommittedByMonth({
      expenses: [exp(), avista], cards: [card], forecasts, totalFixedExpense: 1000,
    });
    expect(committed['2026-10']).toBeCloseTo(100 + 1000);
  });

  it('histórico: 6 meses terminando no mês selecionado, receita constante', () => {
    const bars = buildBarDataHist({
      month: '2026-10', expenses: [exp()], cards: [card], fixed: [fx()], totalFixedIncome: 5000,
    });
    expect(bars).toHaveLength(6);
    expect(bars[5].name).toBe(monthLabel('2026-10'));
    expect(bars.every(b => b.receitas === 5000)).toBe(true);
  });
});
