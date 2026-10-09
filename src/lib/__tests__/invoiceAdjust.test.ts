import { describe, it, expect } from 'vitest';
import { alignInstallmentsToInvoices } from '../invoiceAdjust';
import type { MonthlyInstallment } from '../types';

const inst = (cardId: string, amount: number, category = 'food'): MonthlyInstallment => ({
  expenseId: `${cardId}-${amount}`, expenseName: 'x', cardId, amount,
  installmentNumber: 1, totalInstallments: 1, category: category as never, month: '2026-10',
});

describe('alignInstallmentsToInvoices', () => {
  it('sem fatura informada mantém os valores', () => {
    const list = [inst('a', 100)];
    expect(alignInstallmentsToInvoices(list, [])).toBe(list);
  });

  it('redistribui proporcionalmente até o valor final da fatura', () => {
    const out = alignInstallmentsToInvoices(
      [inst('a', 100), inst('a', 300), inst('b', 50)],
      [{ cardId: 'a', actualAmount: 500 }],
    );
    expect(out.filter(i => i.cardId === 'a').reduce((s, i) => s + i.amount, 0)).toBeCloseTo(500);
    expect(out[0].amount).toBeCloseTo(125);
    expect(out[2].amount).toBe(50);
  });

  it('cria item de fatura quando não há lançamentos calculados', () => {
    const out = alignInstallmentsToInvoices([], [{ cardId: 'a', actualAmount: 200 }], '2026-10');
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(200);
  });
});
