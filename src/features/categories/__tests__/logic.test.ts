import { describe, it, expect } from 'vitest';
import type { CustomCategory } from '@/lib/customCategories';
import {
  buildCategoryList, computeUsage, findDuplicateGroups, labelsLookAlike,
  normalizeLabel, planMerge, type CategoryData,
} from '../logic';

const custom = (id: string, label: string, categoryType: CustomCategory['categoryType'] = 'expense'): CustomCategory =>
  ({ id, label, icon: 'Star', color: '0 0% 60%', categoryType });

const data = (over: Partial<CategoryData> = {}): CategoryData => ({
  expenses: [], fixedExpenses: [], fixedIncomes: [], variable: [], budgets: [], ...over,
});

describe('computeUsage', () => {
  it('conta lançamentos de todas as coleções e marca o tipo de uso', () => {
    const u = computeUsage(data({
      expenses:      [{ id: 'e1', category: 'food' }, { id: 'e2', category: 'food' }],
      fixedExpenses: [{ id: 'f1', category: 'food' }],
      variable:      [{ id: 'v1', category: 'custom_x' as never, type: 'income' }],
      budgets:       [{ category: 'food', amount: 500 }],
    }));
    expect(u.get('food')).toMatchObject({ count: 3, budget: 500, usedAs: { expense: true, income: false } });
    expect(u.get('food')!.byCollection).toMatchObject({ expenses: 2, fixedExpenses: 1 });
    expect(u.get('custom_x')).toMatchObject({ count: 1, usedAs: { expense: false, income: true } });
  });
});

describe('buildCategoryList', () => {
  it('inclui ids usados que não existem mais como "Categoria removida"', () => {
    const items = buildCategoryList([custom('custom_a', 'Pet')], data({
      expenses: [{ id: 'e1', category: 'custom_apagada' as never }],
    }));
    const orphan = items.find(i => i.id === 'custom_apagada');
    expect(orphan).toMatchObject({ origin: 'orphan', label: 'Categoria removida', scope: 'expense' });
    expect(items.find(i => i.id === 'custom_a')?.origin).toBe('custom');
    expect(items.find(i => i.id === 'food')?.origin).toBe('standard');
  });
});

describe('planMerge', () => {
  const customs = [custom('custom_merc', 'Mercado'), custom('custom_super', 'Supermercado'), custom('custom_free', 'Bico', 'income')];
  const d = data({
    expenses:      [{ id: 'e1', category: 'custom_merc' as never }, { id: 'e2', category: 'food' }],
    fixedExpenses: [{ id: 'f1', category: 'custom_super' as never }],
    variable:      [{ id: 'v1', category: 'custom_merc' as never, type: 'expense' }],
    budgets:       [{ category: 'custom_merc', amount: 300 }, { category: 'food', amount: 200 }],
  });
  const items = buildCategoryList(customs, d);

  it('move os lançamentos, soma orçamentos e apaga as personalizadas de origem', () => {
    const r = planMerge(d, items, ['custom_merc', 'custom_super'], 'food');
    expect(r.ok).toBe(true);
    const plan = r.plan!;
    expect(plan.updates).toEqual([
      { collection: 'expenses', id: 'e1' },
      { collection: 'fixedExpenses', id: 'f1' },
      { collection: 'variableTransactions', id: 'v1' },
    ]);
    expect(plan.counts.total).toBe(3);
    expect(plan.budget).toEqual({ amount: 500, removeIds: ['custom_merc'] });
    expect(plan.deleteCustomIds).toEqual(['custom_merc', 'custom_super']);
    expect(plan.mlRelabel).toBeNull();
  });

  it('ignora o próprio destino na lista de origens', () => {
    const r = planMerge(d, items, ['food'], 'food');
    expect(r.ok).toBe(false);
  });

  it('bloqueia destino padrão que não aceita o tipo dos lançamentos', () => {
    const d2 = data({ fixedIncomes: [{ id: 'i1', category: 'custom_free' as never }] });
    const r = planMerge(d2, buildCategoryList(customs, d2), ['custom_free'], 'food');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/não aceita ganhos/);
  });

  it('amplia um destino personalizado para "gastos e ganhos" quando preciso', () => {
    const d2 = data({ fixedIncomes: [{ id: 'i1', category: 'custom_free' as never }] });
    const r = planMerge(d2, buildCategoryList(customs, d2), ['custom_free'], 'custom_merc');
    expect(r.plan?.widenTarget).toBe(true);
  });

  it('padrão de origem continua existindo e renomeia rótulos do Classificador', () => {
    const d2 = data({ expenses: [{ id: 'e1', category: 'travel' }] });
    const r = planMerge(d2, buildCategoryList([], d2), ['travel'], 'entertainment');
    expect(r.ok).toBe(true);
    expect(r.plan?.keptStandardIds).toEqual(['travel']);
    expect(r.plan?.deleteCustomIds).toEqual([]);
    expect(r.plan?.mlRelabel).toEqual({ from: ['travel'], to: 'entertainment' });
  });

  it('não aceita "Categoria removida" como destino', () => {
    const d2 = data({ expenses: [{ id: 'e1', category: 'custom_sumiu' as never }] });
    const r = planMerge(d2, buildCategoryList([], d2), ['food'], 'custom_sumiu');
    expect(r.ok).toBe(false);
  });
});

describe('nomes parecidos', () => {
  it('normaliza acento, caixa e plural', () => {
    expect(normalizeLabel('Refeições')).toBe('refeicao');
    expect(normalizeLabel('  Mercados ')).toBe('mercado');
  });

  it.each([
    ['Mercado', 'mercado'],
    ['Mercado', 'Supermercado'],
    ['Academia', 'Acdemia'],
    ['Alimentação', 'Alimentacao'],
    ['Farmácia', 'Farmacias'],
  ])('%s ~ %s', (a, b) => expect(labelsLookAlike(a, b)).toBe(true));

  it.each([
    ['Casa', 'Casamento'],
    ['Pet', 'Pix'],
    ['Lazer', 'Saúde'],
  ])('%s ≠ %s', (a, b) => expect(labelsLookAlike(a, b)).toBe(false));

  it('agrupa e sugere a categoria padrão como destino', () => {
    const customs = [custom('custom_1', 'alimentacao'), custom('custom_2', 'Pet'), custom('custom_3', 'Pets')];
    const items = buildCategoryList(customs);
    const groups = findDuplicateGroups(items, new Map());
    expect(groups).toContainEqual({ ids: ['food', 'custom_1'], suggestedTargetId: 'food' });
    expect(groups.find(g => g.ids.includes('custom_2'))?.ids.sort()).toEqual(['custom_2', 'custom_3']);
  });

  it('não sugere unir gasto com ganho', () => {
    const items = buildCategoryList([custom('custom_s', 'Salario', 'expense')]);
    expect(findDuplicateGroups(items, new Map())).toEqual([]);
  });
});
