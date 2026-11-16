import { describe, it, expect, vi } from 'vitest';

// store.ts importa o Firebase; aqui só usamos funções puras, então o cliente é irrelevante.
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, db: {} }));

import { computeInstallmentsForMonth } from '@/lib/store';
import type { Subscription } from '@/lib/subscriptions';
import type { CreditCard, Expense, FixedExpense, FixedIncome, VariableTransaction } from '@/lib/types';
import {
  applyExtractFilters, availableExtractCategories, buildExtractItems, EMPTY_EXTRACT_FILTERS,
  filterExtractItems, summarizeExtract,
} from '../extract';

const card: CreditCard = {
  id: 'c1', name: 'Nubank', brand: 'mastercard', lastDigits: '1234',
  limit: 5000, closingDay: 10, dueDay: 17, active: true,
};
const cardMap = new Map([[card.id, card]]);

const exp = (o: Partial<Expense> = {}): Expense => ({
  id: 'e1', cardId: 'c1', name: 'Mercado Livre', totalAmount: 300, category: 'shopping',
  date: '2026-09-05', installments: 1, ...o,
});
const fx = (o: Partial<FixedExpense> = {}): FixedExpense => ({
  id: 'f1', name: 'Aluguel', amount: 1000, category: 'home', paidMonths: [], paymentMethod: 'pix', ...o,
});
const inc = (o: Partial<FixedIncome> = {}): FixedIncome => ({
  id: 'i1', name: 'Salário Empresa X', amount: 5000, category: 'salary', receiveDay: 5, receivedMonths: [], ...o,
});
const varTx = (o: Partial<VariableTransaction> = {}): VariableTransaction => ({
  id: 'v1', name: 'Uber trabalho', amount: 25, type: 'expense', paymentMethod: 'pix',
  category: 'transport', date: '2026-10-12', ...o,
});
const sub = (o: Partial<Subscription> = {}): Subscription => ({
  id: 's1', name: 'Netflix', amount: 39.9, billingCycle: 'monthly', billingDay: 8,
  category: 'streaming', active: true, paidMonths: [], ...o,
});

describe('buildExtractItems', () => {
  const month = '2026-10';
  const installments = computeInstallmentsForMonth([exp()], [card], month);

  it('junta cartão, fixo, assinatura, renda e variável numa lista só, ordenada por data', () => {
    const items = buildExtractItems({
      month, installments, fixed: [fx()], incomes: [inc()], varTxs: [varTx()],
      subscriptions: [sub()], cardMap,
    });
    expect(items).toHaveLength(4);
    expect(items.map(i => i.source)).toEqual(['Fixo', 'Renda', 'Assinatura', 'Variável']);
    // ordenado por data crescente (dia 1, 5, 8, 12)
    expect(items.map(i => i.date)).toEqual(['2026-10-01', '2026-10-05', '2026-10-08', '2026-10-12']);
  });

  it('marca o tipo certo (renda = income, resto conforme o lançamento variável)', () => {
    const items = buildExtractItems({
      month, installments: [], fixed: [], incomes: [inc()],
      varTxs: [varTx({ id: 'v2', type: 'income', name: 'Reembolso' })],
      subscriptions: [], cardMap,
    });
    expect(items.find(i => i.source === 'Renda')?.type).toBe('income');
    expect(items.find(i => i.name === 'Reembolso')?.type).toBe('income');
  });

  it('ignora assinatura inativa', () => {
    const items = buildExtractItems({
      month, installments: [], fixed: [], incomes: [], varTxs: [],
      subscriptions: [sub({ active: false })], cardMap,
    });
    expect(items).toHaveLength(0);
  });

  it('inclui o detalhe da parcela e o nome do cartão nos lançamentos de cartão', () => {
    const multi = computeInstallmentsForMonth([exp({ installments: 3 })], [card], month);
    const items = buildExtractItems({
      month, installments: multi, fixed: [], incomes: [], varTxs: [], subscriptions: [], cardMap,
    });
    expect(items[0].detail).toContain('Nubank');
    expect(items[0].detail).toMatch(/\/3/);
  });
});

describe('filterExtractItems', () => {
  const items = buildExtractItems({
    month: '2026-10', installments: [], fixed: [fx({ name: 'Aluguel apê' })],
    incomes: [], varTxs: [varTx({ name: 'iFood sexta' })], subscriptions: [], cardMap,
  });

  it('acha por substring, ignorando acento e caixa', () => {
    expect(filterExtractItems(items, 'IFOOD').map(i => i.name)).toEqual(['iFood sexta']);
    expect(filterExtractItems(items, 'alugu').map(i => i.name)).toEqual(['Aluguel apê']);
  });

  it('string vazia devolve tudo', () => {
    expect(filterExtractItems(items, '  ')).toHaveLength(2);
  });

  it('sem match devolve lista vazia', () => {
    expect(filterExtractItems(items, 'xyz-nao-existe')).toHaveLength(0);
  });
});

describe('availableExtractCategories', () => {
  it('lista categorias distintas presentes, ordenadas por label, sem duplicar', () => {
    const items = buildExtractItems({
      month: '2026-10', installments: [], fixed: [fx({ category: 'home' }), fx({ id: 'f2', category: 'home' })],
      incomes: [inc({ category: 'salary' })], varTxs: [], subscriptions: [], cardMap,
    });
    expect(availableExtractCategories(items).map(c => c.key)).toEqual(['home', 'salary']);
  });
});

describe('applyExtractFilters', () => {
  const items = buildExtractItems({
    month: '2026-10',
    installments: [],
    fixed: [fx({ id: 'f1', name: 'Aluguel apê', category: 'home' })],
    incomes: [inc({ id: 'i1', name: 'Salário Empresa X', category: 'salary', receiveDay: 5 })],
    varTxs: [varTx({ id: 'v1', name: 'iFood sexta', category: 'food', date: '2026-10-20' })],
    subscriptions: [], cardMap,
  });

  it('sem filtro nenhum devolve tudo', () => {
    expect(applyExtractFilters(items, EMPTY_EXTRACT_FILTERS)).toHaveLength(3);
  });

  it('combina busca por nome com categoria', () => {
    const r = applyExtractFilters(items, { ...EMPTY_EXTRACT_FILTERS, search: 'a', category: 'home' });
    expect(r.map(i => i.name)).toEqual(['Aluguel apê']);
  });

  it('filtra por categoria sozinha', () => {
    expect(applyExtractFilters(items, { ...EMPTY_EXTRACT_FILTERS, category: 'salary' }).map(i => i.name))
      .toEqual(['Salário Empresa X']);
  });

  it('filtra por intervalo de data (dateFrom/dateTo)', () => {
    // só o fixo (dia 1) e a renda (dia 5) ficam antes do dia 10; o iFood é dia 20
    const r = applyExtractFilters(items, { ...EMPTY_EXTRACT_FILTERS, dateTo: '2026-10-10' });
    expect(r.map(i => i.name).sort()).toEqual(['Aluguel apê', 'Salário Empresa X'].sort());
  });

  it('dateFrom e dateTo juntos fecham o intervalo', () => {
    const r = applyExtractFilters(items, { ...EMPTY_EXTRACT_FILTERS, dateFrom: '2026-10-15', dateTo: '2026-10-25' });
    expect(r.map(i => i.name)).toEqual(['iFood sexta']);
  });
});

describe('summarizeExtract', () => {
  it('soma receitas e gastos separadamente e calcula saldo', () => {
    const items = buildExtractItems({
      month: '2026-10', installments: [], fixed: [fx({ amount: 1000 })],
      incomes: [inc({ amount: 5000 })], varTxs: [], subscriptions: [], cardMap,
    });
    expect(summarizeExtract(items)).toEqual({ income: 5000, expense: 1000, balance: 4000, count: 2 });
  });

  it('lista vazia devolve tudo zero', () => {
    expect(summarizeExtract([])).toEqual({ income: 0, expense: 0, balance: 0, count: 0 });
  });
});
