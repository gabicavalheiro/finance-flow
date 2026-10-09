import { describe, it, expect } from 'vitest';
import {
  fixedAmountForMonth, isFixedAdjusted, resolveFixedForMonth, withFixedAmountForMonth,
} from '@/lib/fixedExpenses';
import type { FixedExpense } from '@/lib/types';

const med: FixedExpense = {
  id: 'f1', name: 'Medicamentos', amount: 300, category: 'other',
  paidMonths: [], paymentMethod: 'pix', variable: true,
  amountByMonth: { '2026-10': 420 },
};

describe('fixedExpenses', () => {
  it('usa o valor padrão quando o mês não tem ajuste', () => {
    expect(fixedAmountForMonth(med, '2026-11')).toBe(300);
    expect(isFixedAdjusted(med, '2026-11')).toBe(false);
  });
  it('usa o ajuste do mês quando existe', () => {
    expect(fixedAmountForMonth(med, '2026-10')).toBe(420);
    expect(isFixedAdjusted(med, '2026-10')).toBe(true);
  });
  it('resolveFixedForMonth troca só o amount do mês ajustado', () => {
    const [r] = resolveFixedForMonth([med], '2026-10');
    expect(r.amount).toBe(420);
    expect(med.amount).toBe(300); // não muta o original
  });
  it('gasto sem amountByMonth continua com o valor padrão', () => {
    const plain = { ...med, amountByMonth: undefined };
    expect(fixedAmountForMonth(plain, '2026-10')).toBe(300);
  });
  it('withFixedAmountForMonth define e remove ajuste', () => {
    const set = withFixedAmountForMonth(med, '2026-12', 350);
    expect(set).toEqual({ '2026-10': 420, '2026-12': 350 });
    expect(withFixedAmountForMonth({ ...med, amountByMonth: set }, '2026-10', null)).toEqual({ '2026-12': 350 });
  });
});
