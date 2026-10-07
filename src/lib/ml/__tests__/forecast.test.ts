import { describe, it, expect } from 'vitest';
import { addMonthsStr, forecastSeries, forecastPortfolio } from '../forecast';
import { buildDiscretionarySeries } from '../spendingSeries';
import type { CreditCard, Expense, VariableTransaction } from '@/lib/types';

// gerador pseudo-aleatório determinístico (testes reprodutíveis)
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe('addMonthsStr', () => {
  it('atravessa virada de ano nos dois sentidos', () => {
    expect(addMonthsStr('2026-11', 3)).toBe('2027-02');
    expect(addMonthsStr('2026-01', -1)).toBe('2025-12');
    expect(addMonthsStr('2026-10', 0)).toBe('2026-10');
  });
});

describe('forecastSeries', () => {
  it('série constante: prevê o mesmo valor e erro de backtest ~0', () => {
    const f = forecastSeries(Array(10).fill(800), { lastMonth: '2026-09', horizon: 3 });
    expect(f.reliable).toBe(true);
    f.points.forEach((p) => expect(p.mean).toBeCloseTo(800, 0));
    expect(f.backtest!.mae).toBeCloseTo(0, 5);
    expect(f.points[0].month).toBe('2026-10');
  });

  it('tendência de alta: prevê acima do último valor e supera o ingênuo', () => {
    const y = Array.from({ length: 14 }, (_, i) => 500 + i * 40);
    const f = forecastSeries(y, { lastMonth: '2026-09', horizon: 3 });
    expect(f.points[0].mean).toBeGreaterThan(y[y.length - 1] - 1);
    expect(f.backtest!.skill).toBeGreaterThan(0);
  });

  it('um gasto atípico não contamina a previsão (modelo robusto)', () => {
    const y = [900, 950, 880, 920, 4000, 910, 940, 900, 930];
    const f = forecastSeries(y, { lastMonth: '2026-09', horizon: 1 });
    expect(f.points[0].mean).toBeLessThan(1300);
  });

  it('poucos dados: devolve previsão marcada como NÃO confiável, sem backtest', () => {
    const f = forecastSeries([700, 900, 800], { lastMonth: '2026-09', horizon: 2 });
    expect(f.reliable).toBe(false);
    expect(f.backtest).toBeNull();
    expect(f.points).toHaveLength(2);
  });

  it('série vazia não quebra e prevê zero', () => {
    const f = forecastSeries([], { lastMonth: '2026-09', horizon: 2 });
    expect(f.points.map((p) => p.mean)).toEqual([0, 0]);
  });

  it('intervalo é coerente: lower ≤ mean ≤ upper, nunca negativo, e alarga com o horizonte', () => {
    const r = rng(7);
    const y = Array.from({ length: 18 }, () => 1000 + (r() - 0.5) * 600);
    const f = forecastSeries(y, { lastMonth: '2026-09', horizon: 6 });
    f.points.forEach((p) => {
      expect(p.lower).toBeGreaterThanOrEqual(0);
      expect(p.lower).toBeLessThanOrEqual(p.mean + 1e-9);
      expect(p.upper).toBeGreaterThanOrEqual(p.mean - 1e-9);
    });
    const w = (i: number) => f.points[i].upper - f.points[i].lower;
    expect(w(5)).toBeGreaterThanOrEqual(w(0));
  });

  it('cobertura do intervalo de 80% fica em faixa plausível em ruído estacionário', () => {
    // vários sorteios: a média da cobertura não deve ficar absurdamente longe de 0,8
    const covs: number[] = [];
    for (let seed = 1; seed <= 30; seed++) {
      const r = rng(seed);
      const y = Array.from({ length: 30 }, () => 1000 + (r() + r() + r() - 1.5) * 400);
      const c = forecastSeries(y, { lastMonth: '2026-09', horizon: 1 }).backtest!.coverage;
      if (c !== null) covs.push(c);
    }
    const avg = covs.reduce((a, b) => a + b, 0) / covs.length;
    expect(avg).toBeGreaterThan(0.6);
    expect(avg).toBeLessThan(0.95);
  });

  it('entradas inválidas (NaN, negativos) são tratadas como zero', () => {
    const f = forecastSeries([100, NaN, -50, 200, 300, 250], { lastMonth: '2026-09', horizon: 1 });
    expect(Number.isFinite(f.points[0].mean)).toBe(true);
  });
});

describe('forecastPortfolio', () => {
  it('total é previsto direto da série somada', () => {
    const a = Array.from({ length: 10 }, (_, i) => 300 + (i % 2) * 20);
    const b = Array.from({ length: 10 }, () => 500);
    const p = forecastPortfolio({ a, b }, { lastMonth: '2026-09', horizon: 2 });
    expect(Object.keys(p.byKey)).toEqual(['a', 'b']);
    expect(p.total).toHaveLength(2);
    expect(p.total[0].mean).toBeGreaterThan(700);
    expect(p.total[0].mean).toBeLessThan(900);
    expect(p.engine).toBe('local');
  });
});

describe('buildDiscretionarySeries', () => {
  const card: CreditCard = {
    id: 'c1', name: 'Nubank', brand: 'mastercard', lastDigits: '1234',
    limit: 5000, closingDay: 10, dueDay: 17, active: true,
  };
  const exp = (over: Partial<Expense>): Expense => ({
    id: Math.random().toString(), cardId: 'c1', name: 'x', totalAmount: 100,
    category: 'food', date: '2026-07-02', installments: 1, ...over,
  });
  const tx = (over: Partial<VariableTransaction>): VariableTransaction => ({
    id: Math.random().toString(), name: 'x', amount: 50, type: 'expense',
    paymentMethod: 'pix', category: 'food', date: '2026-07-20', ...over,
  });

  it('exclui o mês corrente (incompleto) e parcelamentos', () => {
    const s = buildDiscretionarySeries({
      cards: [card], currentMonth: '2026-10',
      expenses: [
        exp({ date: '2026-08-01', totalAmount: 100 }),
        exp({ date: '2026-08-02', totalAmount: 900, installments: 3 }), // compromisso
      ],
      variable: [
        tx({ date: '2026-08-15', amount: 40 }),
        tx({ date: '2026-10-03', amount: 999 }), // mês corrente
        tx({ type: 'income', date: '2026-08-10', amount: 5000 }),
      ],
    });
    expect(s.lastMonth).toBe('2026-09');
    expect(s.months).toContain('2026-08');
    expect(s.months).not.toContain('2026-10');
    const total = Object.values(s.byCategory).flat().reduce((a, b) => a + b, 0);
    expect(total).toBe(140);
  });

  it('compra no cartão após o fechamento cai na fatura do mês seguinte', () => {
    const s = buildDiscretionarySeries({
      cards: [card], currentMonth: '2026-10', variable: [],
      expenses: [exp({ date: '2026-07-25', totalAmount: 200 })], // fecha dia 10 → vence 17/ago ou set
    });
    const idx = Object.values(s.byCategory)[0].findIndex((v) => v === 200);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(s.months[idx] > '2026-07').toBe(true);
  });

  it('agrupa categorias esparsas em "other" e ignora assinatura/empréstimo', () => {
    const variable: VariableTransaction[] = [];
    for (const m of ['2026-05', '2026-06', '2026-07', '2026-08']) {
      variable.push(tx({ date: `${m}-10`, category: 'food', amount: 100 }));
    }
    variable.push(tx({ date: '2026-06-10', category: 'travel', amount: 300 })); // 1 mês só
    variable.push(tx({ date: '2026-06-11', category: 'subscription', amount: 40 }));
    const s = buildDiscretionarySeries({ cards: [], expenses: [], variable, currentMonth: '2026-10' });
    expect(Object.keys(s.byCategory).sort()).toEqual(['food', 'other']);
    expect(s.byCategory.other.reduce((a, b) => a + b, 0)).toBe(300);
  });

  it('sem dados devolve série vazia', () => {
    const s = buildDiscretionarySeries({ cards: [], expenses: [], variable: [], currentMonth: '2026-10' });
    expect(s.months).toEqual([]);
    expect(s.lastMonth).toBeNull();
  });
});
