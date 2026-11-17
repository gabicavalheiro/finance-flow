import { describe, expect, it } from 'vitest';
import { evaluatePurchase, suggestInstallments, type MonthSnapshot } from '../evaluate';

// Renda 5.000, gastos 3.500 → sobra 1.500; reserva 10% = 500
const months = (n = 12, income = 5000, expense = 3500): MonthSnapshot[] =>
  Array.from({ length: n }, (_, i) => ({
    month: `2026-${String(11 + i > 12 ? (11 + i) - 12 : 11 + i).padStart(2, '0')}`,
    income, expense,
  }));

describe('evaluatePurchase', () => {
  it('pode ir quando sobra mais que a reserva', () => {
    const r = evaluatePurchase({ price: 800, installments: 1, months: months() });
    expect(r.verdict).toBe('go');
    expect(r.worst?.freeAfter).toBe(700);
  });

  it('cabe com custo quando come a reserva', () => {
    const r = evaluatePurchase({ price: 1200, installments: 1, months: months() });
    expect(r.verdict).toBe('cost');
    expect(r.reasons[0]).toMatch(/reserva/);
  });

  it('cabe com custo quando atrapalha as metas', () => {
    const r = evaluatePurchase({ price: 800, installments: 1, months: months(), goalsMonthly: 400 });
    expect(r.verdict).toBe('cost');
    expect(r.reasons[0]).toMatch(/metas/);
  });

  it('não recomenda quando deixa o mês negativo', () => {
    const r = evaluatePurchase({ price: 2000, installments: 1, months: months() });
    expect(r.verdict).toBe('no');
    expect(r.shortfall).toBe(500);
  });

  it('parcelado olha todos os meses e acha o mais apertado', () => {
    const ms = months();
    ms[2] = { ...ms[2], expense: 4900 }; // terceiro mês só sobra 100
    const r = evaluatePurchase({ price: 1500, installments: 3, months: ms });
    expect(r.impacts).toHaveLength(3);
    expect(r.verdict).toBe('no');
    expect(r.worst?.month).toBe(ms[2].month);
  });

  it('última parcela absorve o arredondamento', () => {
    const r = evaluatePurchase({ price: 100, installments: 3, months: months() });
    const total = r.impacts.reduce((s, m) => s + m.charge, 0);
    expect(total).toBeCloseTo(100, 2);
  });

  it('estourar orçamento da categoria vira "com custo"', () => {
    const r = evaluatePurchase({
      price: 300, installments: 1, months: months(),
      categoryBudget: { label: 'Compras', limit: 400, spent: 200 },
    });
    expect(r.verdict).toBe('cost');
    expect(r.reasons.some(x => x.includes('orçamento de Compras'))).toBe(true);
  });

  it('sem ganhos cadastrados não avalia', () => {
    const r = evaluatePurchase({ price: 100, installments: 1, months: months(3, 0, 0) });
    expect(r.verdict).toBe('unknown');
  });

  it('valor zero não avalia', () => {
    expect(evaluatePurchase({ price: 0, installments: 1, months: months() }).verdict).toBe('unknown');
  });
});

describe('suggestInstallments', () => {
  it('sugere o menor parcelamento que cabe', () => {
    const s = suggestInstallments({ price: 3000, installments: 1, months: months() });
    // 2x de 1.500 deixa 0 (cabe com custo)
    expect(s).toEqual({ installments: 2, verdict: 'cost' });
  });

  it('não sugere quando nada cabe', () => {
    expect(suggestInstallments({ price: 1000, installments: 1, months: months(12, 1000, 1200) })).toBeNull();
  });
});
