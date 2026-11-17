import { describe, expect, it } from 'vitest';
import { planPurchaseGoal } from '../plan';
import type { MonthSnapshot } from '../evaluate';

const months = (income: number, expense: number, n = 6): MonthSnapshot[] =>
  Array.from({ length: n }, (_, i) => ({ month: `2027-0${i + 1}`, income, expense }));

describe('planPurchaseGoal', () => {
  it('sugere o prazo pela sobra depois da reserva', () => {
    // sobra 1.500 − reserva 500 = 1.000/mês → 3.000 em 3 meses
    const p = planPurchaseGoal({ price: 3000, months: months(5000, 3500) });
    expect(p).toMatchObject({ available: 1000, months: 3, monthly: 1000, feasible: true });
  });

  it('desconta o que já vai para outras metas', () => {
    const p = planPurchaseGoal({ price: 3000, months: months(5000, 3500), goalsMonthly: 500 });
    expect(p.available).toBe(500);
    expect(p.months).toBe(6);
  });

  it('mês sem sobra não guarda nada — o prazo conta a partir de quando sobra', () => {
    const ms = months(5000, 3500);
    ms[0] = { ...ms[0], expense: 7000 }; // mês atual no vermelho
    const p = planPurchaseGoal({ price: 1000, months: ms });
    // nada no 1º mês, 1.000 no 2º
    expect(p.months).toBe(2);
    expect(p.feasible).toBe(true);
  });

  it('depois dos meses conhecidos repete a média dos últimos três', () => {
    const p = planPurchaseGoal({ price: 9000, months: months(5000, 3500, 3) });
    expect(p.months).toBe(9);
  });

  it('sem sobra não dá para planejar pela sobra', () => {
    const p = planPurchaseGoal({ price: 1200, months: months(3000, 3000) });
    expect(p.feasible).toBe(false);
    expect(p.months).toBe(12);
    expect(p.monthly).toBe(100);
  });

  it('respeita o prazo máximo', () => {
    const p = planPurchaseGoal({ price: 100000, months: months(5000, 3500), maxMonths: 24 });
    expect(p).toMatchObject({ months: 24, feasible: false });
  });
});
